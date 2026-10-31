"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Phone, PhoneOff, PhoneCall, Mic, MicOff,
  Video, VideoOff, Minimize2, Maximize2, AlertTriangle,
} from "lucide-react";
import { useComm } from "@/context/CommContext";
import { answerCall, endCall, sendSignal, pollSignals, getTurnCredentials } from "@/lib/commApi";
import { apiRequest } from "@/lib/apiClient";
import { getCookie } from "@/lib/cookies";
import { getLocalStorage } from "@/lib/localStorage";
import API_BASE_URL from "@/config/api.config";
import { startRingtone, stopRingtone } from "@/lib/commSounds";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

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

function waitIce(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") return resolve();
    const handler = () => {
      if (pc.iceGatheringState === "complete") {
        pc.removeEventListener("icegatheringstatechange", handler);
        resolve();
      }
    };
    pc.addEventListener("icegatheringstatechange", handler);
    setTimeout(resolve, 4000);
  });
}

async function getLocalMedia(isVideo) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    return { stream: null, error: "Camera/mic need HTTPS. This page is on plain HTTP, so you can hear/see the other person but they can't hear/see you." };
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia(isVideo ? { video: true, audio: true } : { audio: true });
    return { stream, error: null };
  } catch (e) {
    if (isVideo) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return { stream, error: "Camera unavailable — joined with audio only." };
      } catch {}
    }
    return { stream: null, error: `Mic/camera blocked (${e.name}). Allow access in the browser address bar.` };
  }
}

// ── WebRTC hook ───────────────────────────────────────────────────────────────
// Non-trickle ICE: one complete offer + one complete answer over REST polling.
function useWebRTC({ call, isInitiator, onConnected, onEnded }) {
  const [localStream,  setLocalStream]  = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [mediaError,   setMediaError]   = useState(null);
  const [stage,        setStage]        = useState(isInitiator ? "Starting…" : "Waiting for caller's offer…");
  const streamRef = useRef(null);
  const pcRef     = useRef(null);
  const isVideo   = call.callType === "video";

  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;
    const callId  = call.callId;
    const myId    = Number(getCookie("userId") || 0);
    const others  = (call.participants || [])
      .map(p => Number(p.userId ?? p.user_id))
      .filter(id => id && id !== myId);

    const run = async () => {
      const { stream, error } = await getLocalMedia(isVideo);
      if (cancelled) { stream?.getTracks().forEach(t => t.stop()); return; }
      if (error) setMediaError(error);
      streamRef.current = stream;
      setLocalStream(stream);

      let turn = [];
      try {
        const r = await getTurnCredentials();
        if (Array.isArray(r?.iceServers)) turn = r.iceServers;
      } catch {}
      if (cancelled) { stream?.getTracks().forEach(t => t.stop()); return; }

      const pc = new RTCPeerConnection({ iceServers: [...ICE_SERVERS, ...turn] });
      pcRef.current = pc;
      pc.oniceconnectionstatechange = () => {
        if (!cancelled) setStage(`Network: ${pc.iceConnectionState}${turn.length ? "" : " (no TURN)"}`);
      };

      if (stream) {
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
      }
      // Ensure we can still receive media even if we couldn't capture our own
      if (!stream?.getAudioTracks().length) pc.addTransceiver("audio", { direction: "recvonly" });
      if (isVideo && !stream?.getVideoTracks().length) pc.addTransceiver("video", { direction: "recvonly" });

      const remote = new MediaStream();
      pc.ontrack = (e) => {
        remote.addTrack(e.track);
        setRemoteStream(new MediaStream(remote.getTracks()));
      };

      pc.onconnectionstatechange = () => {
        if (cancelled) return;
        if (pc.connectionState === "connected") onConnected();
        if (pc.connectionState === "failed") onEnded(true);
      };

      if (isInitiator && others.length) {
        await pc.setLocalDescription(await pc.createOffer());
        await waitIce(pc);
        if (cancelled) return;
        let sent = 0;
        let lastErr = "";
        for (const uid of others) {
          try { await sendSignal(callId, uid, "offer", { sdp: pc.localDescription }); sent++; }
          catch (e) { lastErr = e?.message || String(e); }
        }
        setStage(sent ? "Offer sent — waiting for answer…" : `Could not send offer: ${lastErr}`);
      }

      pollTimer = setInterval(async () => {
        if (cancelled) return;
        let sigs;
        try { sigs = await pollSignals(callId); } catch { return; }
        if (!Array.isArray(sigs) || !sigs.length) return;

        if (sigs.some(s => s.signalType === "ended")) { onEnded(false); return; }

        if (!isInitiator) {
          const offer = [...sigs].reverse().find(s => s.signalType === "offer");
          if (offer && pc.signalingState === "stable") {
            try {
              setStage("Offer received — answering…");
              await pc.setRemoteDescription(offer.payload.sdp);
              await pc.setLocalDescription(await pc.createAnswer());
              await waitIce(pc);
              await sendSignal(callId, offer.senderId, "answer", { sdp: pc.localDescription });
              setStage("Answer sent — connecting…");
            } catch (e) {
              console.error("[call] offer handling failed", e);
              setStage(`Answer failed: ${e?.message || e}`);
            }
          }
        } else {
          const answer = [...sigs].reverse().find(s => s.signalType === "answer");
          if (answer && pc.signalingState === "have-local-offer") {
            try {
              await pc.setRemoteDescription(answer.payload.sdp);
              setStage("Answer received — connecting…");
            } catch (e) {
              console.error("[call] answer handling failed", e);
              setStage(`Answer apply failed: ${e?.message || e}`);
            }
          }
        }
      }, 1200);
    };

    run();

    return () => {
      cancelled = true;
      clearInterval(pollTimer);
      streamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
    };
  }, [call.callId]);

  const toggleTrack = (kind) => {
    const tracks = kind === "audio"
      ? streamRef.current?.getAudioTracks() || []
      : streamRef.current?.getVideoTracks() || [];
    if (!tracks.length) return null;
    const enabled = !tracks[0].enabled;
    tracks.forEach(t => { t.enabled = enabled; });
    return enabled;
  };

  return { localStream, remoteStream, mediaError, stage, toggleTrack };
}

// Attaches a MediaStream to a <video>/<audio> element whenever either changes
function useAttach(ref, stream) {
  useEffect(() => {
    if (ref.current && ref.current.srcObject !== stream) {
      ref.current.srcObject = stream || null;
      if (stream) ref.current.play?.().catch(() => {});
    }
  });
}

// ── Incoming call toast ───────────────────────────────────────────────────────
function IncomingCallToast({ call }) {
  const { answerIncomingCall } = useComm();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    startRingtone();
    return () => stopRingtone();
  }, []);

  const handleAnswer = async () => {
    setLoading(true);
    setError(null);
    try {
      await answerCall(call.callId);
      answerIncomingCall({ ...call, isInitiator: false });
    } catch (e) {
      setError(e?.message || "Could not answer");
      setLoading(false);
    }
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
        {error && <p className="px-4 pb-2 text-xs text-red-300">{error}</p>}
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
  const remoteAudio = useRef(null);
  const isInitiator = call.isInitiator !== false;
  const isVideo     = call.callType === "video";

  const onConnected = useCallback(() => {
    setConnected(true);
    if (!timerRef.current) timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }, []);

  const finish = useCallback(async (notifyServer) => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    if (notifyServer) { try { await endCall(call.callId); } catch {} }
    endActiveCall();
  }, [call.callId, endActiveCall]);

  const onEnded = useCallback((notifyServer) => finish(notifyServer), [finish]);

  const { localStream, remoteStream, mediaError, stage, toggleTrack } =
    useWebRTC({ call, isInitiator, onConnected, onEnded });

  // Remote audio always plays through a dedicated element (survives minimise and voice calls)
  useAttach(remoteAudio, remoteStream);
  useAttach(remoteVideo, remoteStream);
  useAttach(localVideo,  localStream);

  useEffect(() => () => clearInterval(timerRef.current), []);

  // Closing or reloading the tab mid-call must end it on the server, or the
  // other side and the directory keep showing "In a call"
  useEffect(() => {
    const onHide = () => {
      const token = getLocalStorage("token");
      fetch(`${API_BASE_URL}/comm/calls/${call.callId}/end`, {
        method: "POST",
        keepalive: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => {});
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [call.callId]);

  // Unanswered or never-connected calls must not hang around forever
  useEffect(() => {
    if (connected) return;
    const t = setTimeout(() => finish(true), 45000);
    return () => clearTimeout(t);
  }, [connected, finish]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const peerName = isInitiator ? (call.peerName || call.initiatorName) : call.initiatorName;

  return (
    <Draggable initialX={window.innerWidth - (isVideo ? 380 : 310)} initialY={16}>
      <audio ref={remoteAudio} autoPlay playsInline />
      <div className={`bg-[#1e2a3a] rounded-2xl shadow-2xl overflow-hidden text-white
        ${minimised ? "w-64" : isVideo ? "w-[360px]" : "w-72"}`}
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>

        <div data-drag-handle className="flex items-center gap-3 px-4 py-3 bg-[#162030] cursor-grab active:cursor-grabbing">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
            ${connected ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}>
            {isVideo ? <Video size={14} /> : <Phone size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{peerName || "Call"}</p>
            <p className="text-[10px] text-gray-400">
              {connected ? fmt(elapsed) : isInitiator ? "Ringing…" : "Connecting…"}
            </p>
          </div>
          <button onClick={() => setMinimised(m => !m)} className="p-1 rounded hover:bg-[#1e2a3a] transition">
            {minimised ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>

        {!minimised && (
          <>
            {mediaError && (
              <div className="flex gap-2 items-start px-4 py-2 bg-amber-500/15 text-amber-200 text-[11px]">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span>{mediaError}</span>
              </div>
            )}

            {isVideo ? (
              <div className="relative bg-black" style={{ height: 220 }}>
                <video ref={remoteVideo} autoPlay playsInline muted className="w-full h-full object-cover" />
                {localStream?.getVideoTracks().length > 0 && (
                  <video ref={localVideo} autoPlay playsInline muted
                    className="absolute bottom-2 right-2 w-24 h-16 object-cover rounded-lg border border-white/20" />
                )}
                {!connected && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 gap-2">
                    <div className="w-12 h-12 rounded-full bg-[#003b8e] flex items-center justify-center text-lg font-bold">
                      {(peerName || "?")[0]?.toUpperCase()}
                    </div>
                    <p className="text-xs text-gray-300 animate-pulse">{isInitiator ? "Ringing…" : "Connecting…"}</p>
                    <p className="text-[10px] text-gray-500 px-4 text-center">{stage}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <div className="w-16 h-16 rounded-full bg-[#003b8e] flex items-center justify-center text-xl font-bold">
                  {(peerName || "?")[0]?.toUpperCase()}
                </div>
                <p className="text-xs text-gray-400">{connected ? fmt(elapsed) : isInitiator ? "Ringing…" : "Connecting…"}</p>
                {!connected && <p className="text-[10px] text-gray-500 px-4 text-center">{stage}</p>}
              </div>
            )}

            <div className="flex items-center justify-center gap-4 px-4 pb-4 pt-3">
              <button onClick={() => { const on = toggleTrack("audio"); if (on !== null) setMuted(!on); }}
                disabled={!localStream?.getAudioTracks().length}
                className={`w-10 h-10 rounded-full flex items-center justify-center transition disabled:opacity-40
                  ${muted ? "bg-red-500 hover:bg-red-600" : "bg-[#2d3d52] hover:bg-[#3a4f67]"}`}>
                {muted ? <MicOff size={16} /> : <Mic size={16} />}
              </button>
              {isVideo && (
                <button onClick={() => { const on = toggleTrack("video"); if (on !== null) setVideoOff(!on); }}
                  disabled={!localStream?.getVideoTracks().length}
                  className={`w-10 h-10 rounded-full flex items-center justify-center transition disabled:opacity-40
                    ${videoOff ? "bg-red-500 hover:bg-red-600" : "bg-[#2d3d52] hover:bg-[#3a4f67]"}`}>
                  {videoOff ? <VideoOff size={16} /> : <Video size={16} />}
                </button>
              )}
              <button onClick={() => finish(true)}
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

  // Backup hang-up detection: if the call is ended/rejected on the server, close locally
  useEffect(() => {
    if (!activeCall?.callId) return;
    const t = setInterval(async () => {
      try {
        const r = await apiRequest({ url: `/comm/calls/${activeCall.callId}` });
        if (["ended", "missed", "rejected"].includes(r?.status)) endActiveCall();
      } catch {}
    }, 3000);
    return () => clearInterval(t);
  }, [activeCall?.callId, endActiveCall]);

  if (activeCall)   return <ActiveCallWindow key={activeCall.callId} call={activeCall} />;
  if (incomingCall) return <IncomingCallToast call={incomingCall} />;
  return null;
}
