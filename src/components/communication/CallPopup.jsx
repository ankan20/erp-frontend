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
  const dragState = useRef({ dragging: false, ox: 0, oy: 0 });
  const [pos, setPos] = useState({ x: initialX, y: initialY });

  const onMouseDown = (e) => {
    // Only drag from the header bar (first child)
    if (!e.target.closest("[data-drag-handle]")) return;
    dragState.current = { dragging: true, ox: e.clientX - pos.x, oy: e.clientY - pos.y };
    e.preventDefault();
  };

  const onMouseMove = useCallback((e) => {
    if (!dragState.current.dragging) return;
    setPos({
      x: Math.max(0, Math.min(window.innerWidth - 280, e.clientX - dragState.current.ox)),
      y: Math.max(0, Math.min(window.innerHeight - 200, e.clientY - dragState.current.oy)),
    });
  }, []);

  const onMouseUp = useCallback(() => {
    dragState.current.dragging = false;
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onMouseMove, onMouseUp]);

  return (
    <div
      ref={ref}
      onMouseDown={onMouseDown}
      style={{ position: "fixed", left: pos.x, top: pos.y, zIndex: 9999 }}
      className="select-none"
    >
      {children}
    </div>
  );
}

// ── Incoming call toast ───────────────────────────────────────────────────────
function IncomingCallToast({ call }) {
  const { answerIncomingCall, setIncomingCall } = useComm();
  const [loading, setLoading] = useState(false);

  const handleAnswer = async () => {
    setLoading(true);
    try {
      await answerCall(call.callId);
      answerIncomingCall(call);
    } catch {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    try { await endCall(call.callId); } catch {}
    // CommContext poll will clear incomingCall in next cycle
  };

  return (
    <Draggable initialX={window.innerWidth - 320} initialY={16}>
      <div className="w-72 bg-[#1e2a3a] rounded-2xl shadow-2xl overflow-hidden text-white"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
        {/* Drag handle */}
        <div data-drag-handle className="flex items-center gap-3 px-4 pt-4 pb-3 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 animate-pulse">
            <PhoneCall size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">
              Incoming {call.callType === "video" ? "Video" : "Voice"} Call
            </p>
            <p className="font-semibold text-base truncate">
              {call.initiatorName || "Someone"}
            </p>
          </div>
        </div>

        <div className="flex gap-3 px-4 pb-4">
          <button
            onClick={handleDecline}
            className="flex-1 flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600
              rounded-xl py-2.5 text-sm font-medium transition"
          >
            <PhoneOff size={15} />
            Decline
          </button>
          <button
            onClick={handleAnswer}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600
              rounded-xl py-2.5 text-sm font-medium transition disabled:opacity-60"
          >
            <Phone size={15} />
            Answer
          </button>
        </div>
      </div>
    </Draggable>
  );
}

// ── Active call window ────────────────────────────────────────────────────────
function ActiveCallWindow({ call }) {
  const { endActiveCall } = useComm();
  const [muted,      setMuted]      = useState(false);
  const [videoOff,   setVideoOff]   = useState(false);
  const [minimised,  setMinimised]  = useState(false);
  const [elapsed,    setElapsed]    = useState(0);
  const localVideo  = useRef(null);
  const remoteVideo = useRef(null);
  const pcRef       = useRef(null);
  const streamRef   = useRef(null);
  const signalPollRef = useRef(null);

  // Elapsed timer
  useEffect(() => {
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // WebRTC setup
  useEffect(() => {
    if (call.callType !== "video") return;

    const setup = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        streamRef.current = stream;
        if (localVideo.current) localVideo.current.srcObject = stream;

        const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
        pcRef.current = pc;
        stream.getTracks().forEach(t => pc.addTrack(t, stream));

        pc.ontrack = (e) => {
          if (remoteVideo.current) remoteVideo.current.srcObject = e.streams[0];
        };

        pc.onicecandidate = async (e) => {
          if (e.candidate) {
            const parts = call.participants?.filter(p => p.userId !== call.myId) || [];
            for (const p of parts) {
              await sendSignal(call.callId, p.userId, "ice", { candidate: e.candidate }).catch(() => {});
            }
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        const parts = call.participants?.filter(p => p.userId !== call.myId) || [];
        for (const p of parts) {
          await sendSignal(call.callId, p.userId, "offer", { sdp: offer }).catch(() => {});
        }
      } catch {}
    };
    setup();

    // Poll signals
    signalPollRef.current = setInterval(async () => {
      try {
        const signals = await pollSignals(call.callId);
        for (const sig of signals) {
          const pc = pcRef.current;
          if (!pc) continue;
          if (sig.signalType === "offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            await sendSignal(call.callId, sig.senderId, "answer", { sdp: answer }).catch(() => {});
          } else if (sig.signalType === "answer") {
            await pc.setRemoteDescription(new RTCSessionDescription(sig.payload.sdp));
          } else if (sig.signalType === "ice") {
            await pc.addIceCandidate(new RTCIceCandidate(sig.payload.candidate));
          }
        }
      } catch {}
    }, 1500);

    return () => {
      clearInterval(signalPollRef.current);
      streamRef.current?.getTracks().forEach(t => t.stop());
      pcRef.current?.close();
    };
  }, [call]);

  const handleEnd = async () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    pcRef.current?.close();
    try { await endCall(call.callId); } catch {}
    endActiveCall();
  };

  const toggleMute = () => {
    streamRef.current?.getAudioTracks().forEach(t => { t.enabled = muted; });
    setMuted(m => !m);
  };

  const toggleVideo = () => {
    streamRef.current?.getVideoTracks().forEach(t => { t.enabled = videoOff; });
    setVideoOff(v => !v);
  };

  const isVideo = call.callType === "video";

  return (
    <Draggable initialX={window.innerWidth - 340} initialY={16}>
      <div className={`bg-[#1e2a3a] rounded-2xl shadow-2xl overflow-hidden text-white transition-all
        ${minimised ? "w-64" : isVideo ? "w-[320px]" : "w-72"}`}
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>

        {/* Header / drag handle */}
        <div data-drag-handle
          className="flex items-center gap-3 px-4 py-3 bg-[#162030] cursor-grab active:cursor-grabbing">
          <div className="w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
            {isVideo ? <Video size={14} /> : <Phone size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">
              {call.initiatorName || "Call"} — {fmt(elapsed)}
            </p>
            <p className="text-[10px] text-gray-400">{isVideo ? "Video call" : "Voice call"}</p>
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
              </div>
            )}

            {/* Voice-only avatar */}
            {!isVideo && (
              <div className="flex items-center justify-center py-8">
                <div className="w-16 h-16 rounded-full bg-[#003b8e] flex items-center justify-center text-xl font-bold">
                  {(call.initiatorName || "?")[0]?.toUpperCase()}
                </div>
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

// ── Root export ───────────────────────────────────────────────────────────────
export default function CallPopup() {
  const { incomingCall, activeCall } = useComm();

  if (activeCall) return <ActiveCallWindow call={activeCall} />;
  if (incomingCall) return <IncomingCallToast call={incomingCall} />;
  return null;
}
