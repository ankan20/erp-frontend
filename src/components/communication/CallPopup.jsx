"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Phone, PhoneOff, PhoneCall, Mic, MicOff,
  Video, VideoOff, Minimize2, Maximize2,
} from "lucide-react";
import { useComm } from "@/context/CommContext";
import { answerCall, endCall, sendSignal, pollSignals } from "@/lib/commApi";

// ── Draggable wrapper ────────────────────────────────────────────────────────
function Draggable({ children, initialX, initialY }) {
  const ref = useRef(null);
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
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup",   onUp);
    };
  }, [onMove, onUp]);

  return (
    <div ref={ref} onMouseDown={onDown}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999 }}
      className="select-none">
      {children}
    </div>
  );
}

// ── Incoming call toast ───────────────────────────────────────────────────────
function IncomingCallToast({ call }) {
  const { answerIncomingCall, endActiveCall } = useComm();
  const [loading, setLoading] = useState(false);

  const handleAnswer = async () => {
    setLoading(true);
    try {
      await answerCall(call.callId);
      // Mark as receiver so WebRTC knows to wait for offer
      answerIncomingCall({ ...call, isInitiator: false });
    } catch {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    try { await endCall(call.callId); } catch {}
    // CommContext poll will clear incomingCall on next cycle
  };

  return (
    <Draggable initialX={window.innerWidth - 320} initialY={16}>
      <div className="w-72 bg-[#1e2a3a] rounded-2xl shadow-2xl overflow-hidden text-white"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
        <div data-drag-handle
          className="flex items-center gap-3 px-4 pt-4 pb-3 cursor-grab active:cursor-grabbing">
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
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600
              rounded-xl py-2.5 text-sm font-medium transition">
            <PhoneOff size={15} /> Decline
          </button>
          <button onClick={handleAnswer} disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600
              rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-60">
            <Phone size={15} /> Answer
          </button>
        </div>
      </div>
    </Draggable>
  );
}

// ── Active call window ────────────────────────────────────────────────────────
function ActiveCallWindow({ call }) {
  const { endActiveCall, myId } = useComm();
  const [muted,     setMuted]     = useState(false);
  const [videoOff,  setVideoOff]  = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const [status,    setStatus]    = useState("connecting"); // "connecting" | "connected" | "ended"

  const localVideo  = useRef(null);
  const remoteVideo = useRef(null);
  const pcRef       = useRef(null);
  const streamRef   = useRef(null);
  const signalPollRef = useRef(null);
  const statusPollRef = useRef(null);
  const timerRef      = useRef(null);

  const isVideo     = call.callType === "video";
  // Initiator creates offer; receiver waits for offer and sends answer
  const isInitiator = call.isInitiator !== false; // default true (the one who clicked Call)

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }, []);

  const cleanup = useCallback(() => {
    clearInterval(signalPollRef.current);
    clearInterval(statusPollRef.current);
    clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
  }, []);

  useEffect(() => {
    const me = myId();

    const log = (...a) => console.log("[WebRTC]", ...a);

    const setup = async () => {
      log("setup start — isInitiator:", isInitiator, "callId:", call.callId, "me:", me, "participants:", call.participants);

      // Get media — audio for both, video only for video calls
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia(
          isVideo ? { video: true, audio: true } : { audio: true, video: false }
        );
        log("getUserMedia OK, tracks:", stream.getTracks().map(t => t.kind));
      } catch (e) {
        console.error("[WebRTC] getUserMedia FAILED:", e.name, e.message);
        setStatus("ended");
        return;
      }
      streamRef.current = stream;
      if (localVideo.current) localVideo.current.srcObject = stream;

      // Build peer connection
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });
      pcRef.current = pc;

      stream.getTracks().forEach(t => pc.addTrack(t, stream));

      pc.ontrack = (e) => {
        log("ontrack fired — streams:", e.streams.length);
        if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0];
        startTimer();
        setStatus("connected");
      };

      pc.onconnectionstatechange = () => {
        log("connectionState →", pc.connectionState);
        if (pc.connectionState === "connected") { startTimer(); setStatus("connected"); }
        if (pc.connectionState === "disconnected" || pc.connectionState === "failed") setStatus("ended");
      };

      pc.onicecandidate = async (e) => {
        if (!e.candidate) return;
        const others = (call.participants || []).filter(p => p.userId !== me);
        log("ICE candidate → sending to", others.map(p => p.userId));
        for (const p of others) {
          await sendSignal(call.callId, p.userId, "ice", { candidate: e.candidate }).catch(err => log("ICE send error:", err));
        }
      };

      pc.onsignalingstatechange = () => log("signalingState →", pc.signalingState);
      pc.onicegatheringstatechange = () => log("iceGatheringState →", pc.iceGatheringState);

      // Initiator creates and sends the offer
      if (isInitiator) {
        log("creating offer…");
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const others = (call.participants || []).filter(p => p.userId !== me);
        log("sending offer to:", others.map(p => p.userId));
        for (const p of others) {
          const r = await sendSignal(call.callId, p.userId, "offer", { sdp: offer }).catch(e => ({ error: e.message }));
          log("offer send result:", r);
        }
      } else {
        log("receiver role — waiting for offer via signal poll");
      }
    };

    setup();

    // Poll for WebRTC signals
    signalPollRef.current = setInterval(async () => {
      try {
        const signals = await pollSignals(call.callId);
        if (signals?.length) console.log("[WebRTC] signals received:", signals.map(s => s.signalType));
        const pc = pcRef.current;
        if (!pc) return;
        for (const sig of signals || []) {
          if (sig.signalType === "offer" && !isInitiator) {
            // Receiver handles offer → creates answer
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal(call.callId, sig.senderId, "answer", { sdp: answer }).catch(() => {});
          } else if (sig.signalType === "answer" && isInitiator) {
            // Initiator handles answer
            if (pc.signalingState === "have-local-offer") {
              await pc.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
            }
          } else if (sig.signalType === "ice") {
            try { await pc.addIceCandidate(new RTCIceCandidate(sig.payload.candidate)); } catch {}
          } else if (sig.signalType === "ended") {
            setStatus("ended");
          }
        }
      } catch {}
    }, 1500);

    // Poll call status to detect remote hang-up
    statusPollRef.current = setInterval(async () => {
      try {
        const { default: apiRequest } = await import("@/lib/apiClient").catch(() => ({}));
        if (!apiRequest) return;
        // Use pollSignals response implicitly or fetch call detail
      } catch {}
    }, 4000);

    return () => cleanup();
  }, [call.callId]);

  // Detect remote hang-up by checking if call still exists via signal poll returning nothing
  // More reliable: watch for "ended" signal type
  useEffect(() => {
    if (status === "ended") {
      cleanup();
      endActiveCall();
    }
  }, [status]);

  const handleEnd = async () => {
    cleanup();
    try { await endCall(call.callId); } catch {}
    endActiveCall();
  };

  const toggleMute = () => {
    const tracks = streamRef.current?.getAudioTracks() || [];
    tracks.forEach(t => { t.enabled = muted; }); // muted=true means currently muted, so enable
    setMuted(m => !m);
  };

  const toggleVideo = () => {
    const tracks = streamRef.current?.getVideoTracks() || [];
    tracks.forEach(t => { t.enabled = videoOff; });
    setVideoOff(v => !v);
  };

  return (
    <Draggable initialX={window.innerWidth - 340} initialY={16}>
      <div className={`bg-[#1e2a3a] rounded-2xl shadow-2xl overflow-hidden text-white transition-all
        ${minimised ? "w-64" : isVideo ? "w-[320px]" : "w-72"}`}
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>

        {/* Header / drag handle */}
        <div data-drag-handle
          className="flex items-center gap-3 px-4 py-3 bg-[#162030] cursor-grab active:cursor-grabbing">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
            ${status === "connected" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}>
            {isVideo ? <Video size={14} /> : <Phone size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{call.initiatorName || "Call"}</p>
            <p className="text-[10px] text-gray-400">
              {status === "connected" ? fmt(elapsed) : status === "connecting" ? "Connecting…" : "Call ended"}
            </p>
          </div>
          <button onClick={() => setMinimised(m => !m)}
            className="p-1 rounded hover:bg-[#1e2a3a] transition">
            {minimised ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>

        {!minimised && (
          <>
            {/* Video area */}
            {isVideo && (
              <div className="relative bg-black" style={{ height: 180 }}>
                <video ref={remoteVideo} autoPlay playsInline
                  className="w-full h-full object-cover" />
                <video ref={localVideo} autoPlay playsInline muted
                  className="absolute bottom-2 right-2 w-20 h-14 object-cover rounded-lg border border-white/20" />
                {videoOff && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                    <VideoOff size={32} className="text-gray-400" />
                  </div>
                )}
                {status === "connecting" && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 gap-2">
                    <div className="w-12 h-12 rounded-full bg-[#003b8e] flex items-center justify-center text-lg font-bold">
                      {(call.initiatorName || "?")?.[0]?.toUpperCase()}
                    </div>
                    <p className="text-xs text-gray-300">Connecting…</p>
                  </div>
                )}
              </div>
            )}

            {/* Voice-only avatar */}
            {!isVideo && (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-16 h-16 rounded-full bg-[#003b8e] flex items-center justify-center text-xl font-bold">
                  {(call.initiatorName || "?")?.[0]?.toUpperCase()}
                </div>
                <p className="text-xs text-gray-400">
                  {status === "connected" ? "Connected · " + fmt(elapsed) : "Calling…"}
                </p>
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-center gap-4 px-4 pb-4 pt-3">
              <button onClick={toggleMute}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition
                  ${muted ? "bg-red-500 hover:bg-red-600" : "bg-[#2d3d52] hover:bg-[#3a4f67]"}`}>
                {muted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>

              {isVideo && (
                <button onClick={toggleVideo}
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

// ── Remote hang-up detection via call status poll ─────────────────────────────
function CallStatusWatcher({ callId, onEnded }) {
  useEffect(() => {
    if (!callId) return;
    const ref = setInterval(async () => {
      try {
        const mod = await import("@/lib/apiClient");
        const apiRequest = mod.apiRequest || mod.default;
        const r = await apiRequest({ url: `/comm/calls/${callId}` });
        if (r?.status === "ended" || r?.status === "missed" || r?.status === "rejected") {
          onEnded();
        }
      } catch {}
    }, 4000);
    return () => clearInterval(ref);
  }, [callId, onEnded]);
  return null;
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function CallPopup() {
  const { incomingCall, activeCall, endActiveCall } = useComm();

  if (activeCall) return (
    <>
      <ActiveCallWindow call={activeCall} />
      <CallStatusWatcher callId={activeCall.callId} onEnded={endActiveCall} />
    </>
  );
  if (incomingCall) return <IncomingCallToast call={incomingCall} />;
  return null;
}
