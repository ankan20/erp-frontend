"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Phone, PhoneOff, PhoneCall, Mic, MicOff,
  Video, VideoOff, Minimize2, Maximize2,
} from "lucide-react";
import { useComm } from "@/context/CommContext";
import { answerCall, endCall, sendSignal, pollSignals } from "@/lib/commApi";
import { apiRequest } from "@/lib/apiClient";
import { getCookie } from "@/lib/cookies";

// ── Draggable wrapper ────────────────────────────────────────────────────────
function Draggable({ children, initialX, initialY }) {
  const drag = useRef({ on: false, ox: 0, oy: 0 });
  const [pos, setPos] = useState({ x: initialX, y: initialY });

  const onDown = (e) => {
    if (!e.target.closest("[data-drag-handle]")) return;
    drag.current = { on: true, ox: e.clientX - pos.x, oy: e.clientY - pos.y };
    e.preventDefault();
  };
  const onMove = useCallback((e) => {
    if (!drag.current.on) return;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth  - 280, e.clientX - drag.current.ox)),
      y: Math.max(0, Math.min(window.innerHeight - 200, e.clientY - drag.current.oy)),
    });
  }, []);
  const onUp = useCallback(() => { drag.current.on = false; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [onMove, onUp]);

  return (
    <div onMouseDown={onDown}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999 }}
      className="select-none">
      {children}
    </div>
  );
}

// ── Wait for ICE gathering to complete ───────────────────────────────────────
function waitIce(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") { resolve(); return; }
    const handler = () => { if (pc.iceGatheringState === "complete") { pc.removeEventListener("icegatheringstatechange", handler); resolve(); } };
    pc.addEventListener("icegatheringstatechange", handler);
    // Fallback timeout — 5s max wait
    setTimeout(resolve, 5000);
  });
}

// ── Shared WebRTC hook ────────────────────────────────────────────────────────
function useWebRTC({ call, isInitiator, localVideoRef, remoteVideoRef, onConnected, onEnded }) {
  const streamRef = useRef(null);
  const pcRef     = useRef(null);
  const pollRef   = useRef(null);
  const isVideo   = call.callType === "video";

  useEffect(() => {
    let cancelled = false;
    const callId = call.callId;

    // ── Get the list of "other" participant IDs ──────────────────────────────
    // For initiator: call.participants only has target user(s)
    // For receiver:  call.participants has everyone; exclude self
    const myId = Number(getCookie("userId") || 0);
    const others = (call.participants || [])
      .map(p => Number(p.userId || p.user_id))
      .filter(id => id && id !== myId);

    console.log("[WebRTC] start — initiator:", isInitiator, "callId:", callId, "myId:", myId, "others:", others);

    const run = async () => {
      // 1. Get microphone (+ camera for video)
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(
          isVideo ? { video: true, audio: true } : { audio: true }
        );
      } catch (err) {
        console.error("[WebRTC] getUserMedia failed:", err.name, err.message);
        onEnded();
        return;
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }
      streamRef.current = stream;
      if (localVideoRef?.current) localVideoRef.current.srcObject = stream;
      console.log("[WebRTC] media OK:", stream.getTracks().map(t => t.kind));

      // 2. Build PeerConnection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;
      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        console.log("[WebRTC] remote track received:", e.track.kind);
        if (remoteVideoRef?.current && e.streams[0]) remoteVideoRef.current.srcObject = e.streams[0];
        if (!cancelled) onConnected();
      };

      pc.onconnectionstatechange = () => {
        console.log("[WebRTC] connectionState:", pc.connectionState);
        if (pc.connectionState === "connected" && !cancelled) onConnected();
        if ((pc.connectionState === "failed" || pc.connectionState === "closed") && !cancelled) onEnded();
      };

      // 3. INITIATOR — create offer, wait for full ICE, send once
      if (isInitiator && others.length > 0) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await waitIce(pc);
        console.log("[WebRTC] sending offer to:", others);
        for (const uid of others) {
          const r = await sendSignal(callId, uid, "offer", { sdp: pc.localDescription }).catch(e => e);
          console.log("[WebRTC] offer send →", uid, r);
        }
      }

      // 4. Poll for signals (offer→answer / answer→connected / ended)
      pollRef.current = setInterval(async () => {
        if (cancelled || !pcRef.current) return;
        let sigs;
        try { sigs = await pollSignals(callId); } catch { return; }
        if (!Array.isArray(sigs) || !sigs.length) return;

        console.log("[WebRTC] signals:", sigs.map(s => s.signalType));

        for (const sig of sigs) {
          const p = pcRef.current;
          if (!p) continue;

          if (sig.signalType === "offer" && !isInitiator) {
            // RECEIVER — apply offer, create answer, wait for full ICE, send
            try {
              await p.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
              const answer = await p.createAnswer();
              await p.setLocalDescription(answer);
              await waitIce(p);
              const senderId = sig.senderId;
              console.log("[WebRTC] sending answer to:", senderId);
              await sendSignal(callId, senderId, "answer", { sdp: p.localDescription }).catch(e => console.error("[WebRTC] answer send error:", e));
            } catch (e) { console.error("[WebRTC] offer handling error:", e); }

          } else if (sig.signalType === "answer" && isInitiator) {
            // INITIATOR — apply answer
            try {
              if (p.signalingState === "have-local-offer") {
                await p.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
                console.log("[WebRTC] answer applied — waiting for connection…");
              }
            } catch (e) { console.error("[WebRTC] answer handling error:", e); }

          } else if (sig.signalType === "ended") {
            console.log("[WebRTC] remote ended call");
            if (!cancelled) onEnded();
          }
        }
      }, 1500);
    };

    run();

    return () => {
      cancelled = true;
      clearInterval(pollRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
    };
  }, [call.callId]);

  return {
    toggleMute: () => {
      const tracks = streamRef.current?.getAudioTracks() || [];
      const newEnabled = !tracks[0]?.enabled;
      tracks.forEach(t => { t.enabled = newEnabled; });
      return newEnabled; // true = unmuted
    },
    toggleVideo: () => {
      const tracks = streamRef.current?.getVideoTracks() || [];
      const newEnabled = !tracks[0]?.enabled;
      tracks.forEach(t => { t.enabled = newEnabled; });
      return newEnabled;
    },
  };
}

// ── Incoming call toast ───────────────────────────────────────────────────────
function IncomingCallToast({ call }) {
  const { answerIncomingCall } = useComm();
  const [loading, setLoading] = useState(false);

  const handleAnswer = async () => {
    setLoading(true);
    try {
      await answerCall(call.callId);
      answerIncomingCall({ ...call, isInitiator: false });
    } catch { setLoading(false); }
  };

  const handleDecline = async () => {
    try { await endCall(call.callId); } catch {}
  };

  return (
    <Draggable initialX={window.innerWidth - 320} initialY={16}>
      <div className="w-72 bg-[#1e2a3a] rounded-2xl shadow-2xl overflow-hidden text-white"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
        <div data-drag-handle className="flex items-center gap-3 px-4 pt-4 pb-3 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 animate-pulse">
            <PhoneCall size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">
              Incoming {call.callType === "video" ? "Video" : "Voice"} Call
            </p>
            <p className="font-semibold text-base truncate">{call.initiatorName || "Someone"}</p>
          </div>
        </div>
        <div className="flex gap-3 px-4 pb-4">
          <button onClick={handleDecline}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 rounded-xl py-2.5 text-sm font-medium transition">
            <PhoneOff size={15} /> Decline
          </button>
          <button onClick={handleAnswer} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-60">
            <Phone size={15} /> Answer
          </button>
        </div>
      </div>
    </Draggable>
  );
}

// ── Active call window ────────────────────────────────────────────────────────
function ActiveCallWindow({ call }) {
  const { endActiveCall } = useComm();
  const [muted,     setMuted]     = useState(false);
  const [videoOff,  setVideoOff]  = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const [connected, setConnected] = useState(false);
  const timerRef    = useRef(null);
  const localVideo  = useRef(null);
  const remoteVideo = useRef(null);
  const isInitiator = call.isInitiator !== false;
  const isVideo     = call.callType === "video";

  const onConnected = useCallback(() => {
    if (!timerRef.current) {
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    }
    setConnected(true);
  }, []);

  const onEnded = useCallback(() => {
    clearInterval(timerRef.current);
    endActiveCall();
  }, [endActiveCall]);

  const { toggleMute, toggleVideo } = useWebRTC({
    call, isInitiator,
    localVideoRef:  isVideo ? localVideo  : null,
    remoteVideoRef: isVideo ? remoteVideo : null,
    onConnected,
    onEnded,
  });

  useEffect(() => () => clearInterval(timerRef.current), []);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const handleEnd = async () => {
    clearInterval(timerRef.current);
    try { await endCall(call.callId); } catch {}
    endActiveCall();
  };

  return (
    <Draggable initialX={window.innerWidth - 340} initialY={16}>
      <div className={`bg-[#1e2a3a] rounded-2xl shadow-2xl overflow-hidden text-white
        ${minimised ? "w-64" : isVideo ? "w-[320px]" : "w-72"}`}
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>

        <div data-drag-handle className="flex items-center gap-3 px-4 py-3 bg-[#162030] cursor-grab active:cursor-grabbing">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
            ${connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}>
            {isVideo ? <Video size={14} /> : <Phone size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{call.initiatorName || "Call"}</p>
            <p className="text-[10px] text-gray-400">
              {connected ? fmt(elapsed) : "Connecting…"}
            </p>
          </div>
          <button onClick={() => setMinimised(m => !m)} className="p-1 rounded hover:bg-[#1e2a3a] transition">
            {minimised ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>

        {!minimised && (
          <>
            {isVideo ? (
              <div className="relative bg-black" style={{ height: 180 }}>
                <video ref={remoteVideo} autoPlay playsInline className="w-full h-full object-cover" />
                <video ref={localVideo}  autoPlay playsInline muted
                  className="absolute bottom-2 right-2 w-20 h-14 object-cover rounded-lg border border-white/20" />
                {!connected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-2">
                    <div className="w-12 h-12 rounded-full bg-[#003b8e] flex items-center justify-center text-lg font-bold">
                      {(call.initiatorName || "?")?.[0]?.toUpperCase()}
                    </div>
                    <p className="text-xs text-gray-300 animate-pulse">Connecting…</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-16 h-16 rounded-full bg-[#003b8e] flex items-center justify-center text-xl font-bold">
                  {(call.initiatorName || "?")?.[0]?.toUpperCase()}
                </div>
                <p className="text-xs text-gray-400">
                  {connected ? `🔊 ${fmt(elapsed)}` : "Calling…"}
                </p>
              </div>
            )}

            <div className="flex items-center justify-center gap-4 px-4 pb-4 pt-3">
              <button onClick={() => { const on = toggleMute(); setMuted(!on); }}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition
                  ${muted ? "bg-red-500 hover:bg-red-600" : "bg-[#2d3d52] hover:bg-[#3a4f67]"}`}>
                {muted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              {isVideo && (
                <button onClick={() => { const on = toggleVideo(); setVideoOff(!on); }}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition
                    ${videoOff ? "bg-red-500 hover:bg-red-600" : "bg-[#2d3d52] hover:bg-[#3a4f67]"}`}>
                  {videoOff ? <VideoOff size={16} /> : <Video size={16} />}
                </button>
              )}
              <button onClick={handleEnd}
                className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center transition">
                <PhoneOff size={18} />
              </button>
            </div>
          </>
        )}
      </div>
    </Draggable>
  );
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function CallPopup() {
  const { incomingCall, activeCall, endActiveCall } = useComm();

  // Poll active call status to detect remote hang-up
  useEffect(() => {
    if (!activeCall?.callId) return;
    const ref = setInterval(async () => {
      try {
        const r = await apiRequest({ url: `/comm/calls/${activeCall.callId}` });
        if (r?.status === "ended" || r?.status === "missed" || r?.status === "rejected") endActiveCall();
      } catch {}
    }, 3000);
    return () => clearInterval(ref);
  }, [activeCall?.callId, endActiveCall]);

  if (activeCall)    return <ActiveCallWindow call={activeCall} />;
  if (incomingCall)  return <IncomingCallToast call={incomingCall} />;
  return null;
}
