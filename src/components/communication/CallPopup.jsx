"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Phone, PhoneOff, PhoneCall, Mic, MicOff, Video, VideoOff,
  Minimize2, Maximize2, AlertTriangle, MonitorUp, MonitorX, Expand, Shrink, Users,
  Navigation, Eye, X,
} from "lucide-react";
import { useComm } from "@/context/CommContext";
import { useFollowMe } from "./useFollowMe";
import {
  answerCall, leaveCall, sendSignal, pollSignals, getTurnCredentials, getCallDetail,
} from "@/lib/commApi";
import { getCookie } from "@/lib/cookies";
import { getLocalStorage } from "@/lib/localStorage";
import API_BASE_URL from "@/config/api.config";
import { startRingtone, stopRingtone } from "@/lib/commSounds";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

const NO_ROUTE_MSG =
  "Couldn't connect — your networks can't reach each other directly. A TURN relay server is needed (ask admin to set TURN_HOST / TURN_SECRET).";
const NET_MSG = "Couldn't connect — check both networks and try again.";

const myUserId = () => Number(getCookie("userId") || 0);

// ── Draggable wrapper ────────────────────────────────────────────────────────
function Draggable({ children, initialX, initialY, width = 280 }) {
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
      x: Math.max(0, e.clientX - drag.current.ox),
      y: Math.max(0, Math.min(window.innerHeight - 120, e.clientY - drag.current.oy)),
    });
  }, []);
  const onUp = useCallback(() => { drag.current.on = false; }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [onMove, onUp]);

  // Keep the window on screen when it grows (group grid, expand)
  const left = Math.max(0, Math.min(pos.x, window.innerWidth - width - 8));

  return (
    <div onMouseDown={onDown}
      style={{ position: "fixed", left, top: pos.y, zIndex: 9999 }}
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

const videoSender = (pc) =>
  pc.getTransceivers().find(t => t.receiver.track?.kind === "video")?.sender;

// ── Mesh call hook ───────────────────────────────────────────────────────────
// One RTCPeerConnection per other participant. The lower user id always sends
// the offer, so two people never offer to each other at once. Signalling is
// non-trickle ICE over REST polling; the participant list comes from the call
// detail endpoint, so late joiners and leavers are picked up automatically.
//
// peers: { [userId]: { name, state: "ringing"|"connecting"|"connected"|"failed",
//                      stream, cam, mic, sharing } }
// extraSignalRef: optional ref to a handler for any other signal types
// (e.g. "Follow me" uses it), so features can ride on the same channel.
function useMeshCall({ call, onEnded, extraSignalRef }) {
  const callId  = call.callId;
  const isVideo = call.callType === "video";

  const [localStream,  setLocalStream]  = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [peers,        setPeers]        = useState({});
  const [mediaError,   setMediaError]   = useState(null);
  const [stage,        setStage]        = useState("Starting…");
  const [hasTurn,      setHasTurn]      = useState(false);
  const [failReason,   setFailReason]   = useState(null);
  const [micOn,        setMicOn]        = useState(true);
  const [camOn,        setCamOn]        = useState(true);

  // Live call internals shared with the control callbacks
  const ctx = useRef({ pcs: new Map(), stream: null, screenTrack: null, media: { cam: false, mic: false, sharing: false } });
  const onEndedRef = useRef(onEnded);
  useEffect(() => { onEndedRef.current = onEnded; });

  useEffect(() => {
    let cancelled = false;
    let sigTimer = null;
    let detailTimer = null;
    let busy = false;
    const c     = ctx.current;
    const pcs   = new Map();
    c.pcs       = pcs;
    const myId  = myUserId();
    const names = {};
    let iceServers = ICE_SERVERS;

    (call.participants || []).forEach(p => {
      const id = Number(p.userId ?? p.user_id);
      if (id) names[id] = p.userName || p.user_name;
    });

    // Merge a patch into one peer; skip the render when nothing changed
    const setPeer = (uid, patch) => setPeers(prev => {
      const cur = prev[uid] || {};
      if (Object.keys(patch).every(k => cur[k] === patch[k])) return prev;
      return { ...prev, [uid]: { ...cur, ...patch } };
    });
    const dropPeer = (uid) => {
      const e = pcs.get(uid);
      if (e) { clearTimeout(e.failTimer); e.pc.close(); pcs.delete(uid); }
      setPeers(prev => {
        if (!prev[uid]) return prev;
        const next = { ...prev };
        delete next[uid];
        return next;
      });
    };
    const signal = (uid, type, payload = {}) => sendSignal(callId, uid, type, payload);

    const createPeer = (uid, asOfferer) => {
      const pc    = new RTCPeerConnection({ iceServers });
      const entry = { pc, restarted: false, failTimer: null, remote: new MediaStream(), tracksSet: false };
      pcs.set(uid, entry);

      if (asOfferer) {
        // Always one audio + one video slot, so screen share works even in voice calls
        const s = c.stream;
        pc.addTransceiver(s?.getAudioTracks()[0] || "audio", { direction: "sendrecv" });
        pc.addTransceiver(c.screenTrack || s?.getVideoTracks()[0] || "video", { direction: "sendrecv" });
        entry.tracksSet = true;
      }

      pc.ontrack = (e) => {
        entry.remote.addTrack(e.track);
        const bump = () => setPeer(uid, { tick: Date.now() });
        e.track.onmute = bump;
        e.track.onunmute = bump;
        e.track.onended = bump;
        setPeer(uid, { stream: new MediaStream(entry.remote.getTracks()) });
      };

      pc.onconnectionstatechange = () => {
        if (cancelled) return;
        const st = pc.connectionState;
        if (st === "connected") {
          clearTimeout(entry.failTimer);
          entry.failTimer = null;
          setPeer(uid, { state: "connected" });
          signal(uid, "media", c.media).catch(() => {});
        }
        // Not over yet: the offerer retries once with fresh routes; give up after 15s
        if (st === "failed") {
          setPeer(uid, { state: "connecting" });
          setStage("Connection failed — retrying…");
          if (myId < uid && !entry.restarted) {
            entry.restarted = true;
            offerTo(uid, { iceRestart: true }).catch(() => {});
          }
          if (!entry.failTimer) {
            entry.failTimer = setTimeout(() => {
              entry.failTimer = null;
              if (!cancelled && pc.connectionState !== "connected") setPeer(uid, { state: "failed" });
            }, 15000);
          }
        }
      };

      setPeer(uid, { state: "connecting", name: names[uid] });
      return entry;
    };

    const offerTo = async (uid, opts) => {
      const { pc } = pcs.get(uid) || createPeer(uid, true);
      await pc.setLocalDescription(await pc.createOffer(opts));
      await waitIce(pc);
      if (cancelled) return;
      await signal(uid, "offer", { sdp: pc.localDescription });
      setStage("Offer sent — waiting for answer…");
    };

    const handle = async (s) => {
      const uid = Number(s.senderId);
      switch (s.signalType) {
        case "ended":
          onEndedRef.current(false);
          return;
        case "left":
          dropPeer(uid);
          return;
        case "media":
          setPeer(uid, { cam: !!s.payload?.cam, mic: !!s.payload?.mic, sharing: !!s.payload?.sharing });
          return;
        case "offer": {
          const entry = pcs.get(uid) || createPeer(uid, false);
          const { pc } = entry;
          if (pc.signalingState !== "stable") return;
          setStage("Offer received — answering…");
          await pc.setRemoteDescription(s.payload.sdp);
          if (!entry.tracksSet) {
            // Send our media on the slots the offer created
            const st = c.stream;
            for (const t of pc.getTransceivers()) {
              const kind  = t.receiver.track?.kind;
              const track = kind === "audio" ? st?.getAudioTracks()[0]
                          : kind === "video" ? (c.screenTrack || st?.getVideoTracks()[0]) : null;
              t.direction = "sendrecv";
              if (track) await t.sender.replaceTrack(track);
            }
            entry.tracksSet = true;
          }
          await pc.setLocalDescription(await pc.createAnswer());
          await waitIce(pc);
          if (cancelled) return;
          await signal(uid, "answer", { sdp: pc.localDescription });
          setStage("Answer sent — connecting…");
          return;
        }
        case "answer": {
          const e = pcs.get(uid);
          if (e?.pc.signalingState === "have-local-offer") {
            await e.pc.setRemoteDescription(s.payload.sdp);
            setStage("Answer received — connecting…");
          }
          return;
        }
        default:
          extraSignalRef?.current?.(s);
      }
    };

    const sync = (detail) => {
      if (!detail || cancelled) return;
      if (["ended", "missed"].includes(detail.status)) { onEndedRef.current(false); return; }
      for (const p of detail.participants || []) {
        const uid = Number(p.userId);
        if (!uid || uid === myId) continue;
        if (p.userName) names[uid] = p.userName;
        if (p.state === "in_call") {
          if (pcs.has(uid)) continue;
          if (myId < uid) {
            offerTo(uid).catch(e => setStage(`Could not send offer: ${e?.message || e}`));
          } else {
            // Their offer is on its way
            setPeers(prev => prev[uid] && prev[uid].state !== "ringing" ? prev
              : { ...prev, [uid]: { ...(prev[uid] || {}), state: "connecting", name: names[uid] } });
          }
        } else if (p.state === "ringing") {
          setPeers(prev => prev[uid] ? prev : { ...prev, [uid]: { state: "ringing", name: names[uid] } });
        } else {
          dropPeer(uid);
        }
      }
    };

    const pollSigs = async () => {
      if (busy || cancelled) return;
      busy = true;
      try {
        const sigs = await pollSignals(callId);
        for (const s of Array.isArray(sigs) ? sigs : []) {
          if (cancelled) break;
          try { await handle(s); } catch (e) { console.error("[call] signal failed", s.signalType, e); }
        }
      } catch {} finally { busy = false; }
    };
    const pollDetail = async () => {
      try { sync(await getCallDetail(callId)); } catch {}
    };

    (async () => {
      const { stream, error } = await getLocalMedia(isVideo);
      if (cancelled) { stream?.getTracks().forEach(t => t.stop()); return; }
      if (error) setMediaError(error);
      c.stream = stream;
      c.media  = { cam: !!stream?.getVideoTracks().length, mic: !!stream?.getAudioTracks().length, sharing: false };
      setLocalStream(stream);
      setCamOn(c.media.cam);
      setMicOn(c.media.mic);

      let turn = [];
      try {
        const r = await getTurnCredentials();
        if (Array.isArray(r?.iceServers)) turn = r.iceServers;
      } catch {}
      if (cancelled) return;
      iceServers = [...ICE_SERVERS, ...turn];
      setHasTurn(turn.length > 0);
      setStage(turn.length ? "Waiting for others…" : "Waiting for others… (no TURN)");

      await pollDetail();
      if (cancelled) return;
      sigTimer    = setInterval(pollSigs, 1200);
      detailTimer = setInterval(pollDetail, 2500);
    })();

    return () => {
      cancelled = true;
      clearInterval(sigTimer);
      clearInterval(detailTimer);
      pcs.forEach(e => { clearTimeout(e.failTimer); e.pc.close(); });
      pcs.clear();
      c.stream?.getTracks().forEach(t => t.stop());
      c.screenTrack?.stop();
      c.screenTrack = null;
    };
  }, [callId]);

  // Tell everyone connected what we're sending (camera/mic/screen)
  const broadcastMedia = useCallback((patch) => {
    const c = ctx.current;
    c.media = { ...c.media, ...patch };
    c.pcs.forEach((e, uid) => {
      if (e.pc.connectionState === "connected") sendSignal(callId, uid, "media", c.media).catch(() => {});
    });
  }, [callId]);

  const toggleMic = useCallback(() => {
    const tracks = ctx.current.stream?.getAudioTracks() || [];
    if (!tracks.length) return;
    const on = !tracks[0].enabled;
    tracks.forEach(t => { t.enabled = on; });
    setMicOn(on);
    broadcastMedia({ mic: on });
  }, [broadcastMedia]);

  const toggleCam = useCallback(() => {
    const tracks = ctx.current.stream?.getVideoTracks() || [];
    if (!tracks.length) return;
    const on = !tracks[0].enabled;
    tracks.forEach(t => { t.enabled = on; });
    setCamOn(on);
    broadcastMedia({ cam: on });
  }, [broadcastMedia]);

  const stopShare = useCallback(() => {
    const c = ctx.current;
    const t = c.screenTrack;
    if (!t) return;
    c.screenTrack = null;
    t.onended = null;
    t.stop();
    const cam = c.stream?.getVideoTracks()[0] || null;
    c.pcs.forEach(e => { videoSender(e.pc)?.replaceTrack(cam).catch(() => {}); });
    setScreenStream(null);
    broadcastMedia({ sharing: false });
  }, [broadcastMedia]);

  const startShare = useCallback(async () => {
    let s;
    try { s = await navigator.mediaDevices.getDisplayMedia({ video: true }); } catch { return; }
    const track = s.getVideoTracks()[0];
    if (!track) return;
    const c = ctx.current;
    c.screenTrack = track;
    track.onended = stopShare;           // browser's own "Stop sharing" bar
    c.pcs.forEach(e => { videoSender(e.pc)?.replaceTrack(track).catch(() => {}); });
    setScreenStream(s);
    broadcastMedia({ sharing: true });
  }, [broadcastMedia, stopShare]);

  const fail = useCallback((reason) => {
    setFailReason(reason || (hasTurn ? NET_MSG : NO_ROUTE_MSG));
  }, [hasTurn]);

  return {
    localStream, screenStream, peers, mediaError, stage, hasTurn, failReason, fail,
    micOn, camOn, toggleMic, toggleCam, startShare, stopShare,
  };
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

function RemoteAudio({ stream }) {
  const ref = useRef(null);
  useAttach(ref, stream);
  return <audio ref={ref} autoPlay playsInline />;
}

const remoteHasVideo = (p) =>
  !!p?.stream?.getVideoTracks().some(t => t.readyState === "live" && !t.muted) &&
  (p.cam !== false || p.sharing);

const PEER_STATE_TEXT = { ringing: "Ringing…", connecting: "Connecting…", failed: "Couldn't connect" };

// One person's square in the call: video when there is any, otherwise their initial
function Tile({ name, stream, showVideo, status, micOff, presenting, mirror, className = "", small = false, action = null }) {
  const ref = useRef(null);
  useAttach(ref, showVideo ? stream : null);
  return (
    <div className={`relative bg-[#0f1722] rounded-lg overflow-hidden flex items-center justify-center ${className}`}>
      {showVideo ? (
        <video ref={ref} autoPlay playsInline muted
          className={`w-full h-full ${presenting ? "object-contain" : "object-cover"} ${mirror ? "-scale-x-100" : ""}`} />
      ) : (
        <div className="flex flex-col items-center gap-1">
          <div className={`${small ? "w-8 h-8 text-sm" : "w-12 h-12 text-lg"} rounded-full bg-[#003b8e] flex items-center justify-center font-bold`}>
            {(name || "?")[0]?.toUpperCase()}
          </div>
          {status && !small && <p className={`text-[10px] ${status === "Couldn't connect" ? "text-red-300" : "text-gray-400 animate-pulse"}`}>{status}</p>}
        </div>
      )}
      <div className="absolute bottom-1 left-1 flex items-center gap-1 bg-black/50 rounded px-1.5 py-0.5 text-[10px] max-w-[90%]">
        {micOff && <MicOff size={10} className="text-red-300 shrink-0" />}
        {presenting && <MonitorUp size={10} className="text-emerald-300 shrink-0" />}
        <span className="truncate">{name}</span>
      </div>
      {action && <div className="absolute top-1 right-1">{action}</div>}
    </div>
  );
}

// ── "Follow me" bars: requests, who follows whom, access notices ─────────────
function FollowBars({ follow }) {
  const { requests, following, followers, notice, leaderPage, nameOf } = follow;
  const bar = "flex items-center gap-2 px-3 py-1.5 text-[11px] border-b border-white/5";
  const small = "rounded px-2 py-0.5 text-[10px] font-semibold transition";
  return (
    <>
      {requests.map(uid => (
        <div key={`req-${uid}`} className={`${bar} bg-indigo-500/20 text-indigo-100`}>
          <Navigation size={12} className="shrink-0" />
          <span className="flex-1 min-w-0"><b>{nameOf(uid)}</b> wants to follow your page</span>
          <button onClick={() => follow.decline(uid)} className={`${small} bg-white/10 hover:bg-white/20`}>Decline</button>
          <button onClick={() => follow.allow(uid)} className={`${small} bg-emerald-500 hover:bg-emerald-600`}>Allow</button>
        </div>
      ))}
      {following && (
        <div className={`${bar} bg-emerald-500/15 text-emerald-100`}>
          <Navigation size={12} className="shrink-0" />
          <span className="flex-1 min-w-0 truncate">
            Following <b>{nameOf(following)}</b>{leaderPage ? ` — ${leaderPage}` : ""}
          </span>
          <button onClick={follow.stopFollowing} className={`${small} bg-white/10 hover:bg-white/20`}>Stop</button>
        </div>
      )}
      {followers.length > 0 && (
        <div className={`${bar} bg-sky-500/15 text-sky-100`}>
          <Eye size={12} className="shrink-0" />
          <span className="flex-1 min-w-0 truncate">
            <b>{followers.map(nameOf).join(", ")}</b> {followers.length > 1 ? "are" : "is"} following your page
          </span>
          <button onClick={follow.stopLeading} className={`${small} bg-white/10 hover:bg-white/20`}>Stop</button>
        </div>
      )}
      {notice && (
        <div className={`${bar} ${notice.tone === "warn" ? "bg-amber-500/15 text-amber-200" : "bg-white/5 text-gray-300"}`}>
          {notice.tone === "warn" ? <AlertTriangle size={12} className="shrink-0" /> : <Navigation size={12} className="shrink-0" />}
          <span className="flex-1 min-w-0">{notice.text}</span>
          <button onClick={follow.dismissNotice} className="p-0.5 rounded hover:bg-white/10" title="Dismiss"><X size={11} /></button>
        </div>
      )}
    </>
  );
}

// ── Incoming call toast ───────────────────────────────────────────────────────
function IncomingCallToast({ call }) {
  const { answerIncomingCall } = useComm();
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const others = (call.participants || []).length - 2;

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

  // Declining only removes me; a group call carries on for the others
  const handleDecline = async () => {
    try { await leaveCall(call.callId); } catch {}
  };

  return (
    <Draggable initialX={window.innerWidth - 320} initialY={16} width={288}>
      <div className="w-72 bg-[#1e2a3a] rounded-2xl shadow-2xl overflow-hidden text-white"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>
        <div data-drag-handle className="flex items-center gap-3 px-4 pt-4 pb-3 cursor-grab active:cursor-grabbing">
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 animate-pulse">
            {others > 0 ? <Users size={18} /> : <PhoneCall size={18} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-gray-400 uppercase tracking-wide">
              Incoming {others > 0 ? "Group " : ""}{call.callType === "video" ? "Video" : "Voice"} Call
            </p>
            <p className="font-semibold text-base truncate">
              {call.initiatorName || "Someone"}{others > 0 ? ` + ${others} other${others > 1 ? "s" : ""}` : ""}
            </p>
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
  const [minimised, setMinimised] = useState(false);
  const [expanded,  setExpanded]  = useState(false);
  const [elapsed,   setElapsed]   = useState(0);
  const timerRef    = useRef(null);
  const isInitiator = call.isInitiator !== false;
  const isVideo     = call.callType === "video";
  const canShare    = typeof navigator !== "undefined" && !!navigator.mediaDevices?.getDisplayMedia;

  const finish = useCallback(async (notifyServer) => {
    clearInterval(timerRef.current);
    timerRef.current = null;
    if (notifyServer) { try { await leaveCall(call.callId); } catch {} }
    endActiveCall();
  }, [call.callId, endActiveCall]);

  const onEnded = useCallback((notifyServer) => finish(notifyServer), [finish]);

  const extraSignalRef = useRef(null);
  const {
    localStream, screenStream, peers, mediaError, stage, hasTurn, failReason, fail,
    micOn, camOn, toggleMic, toggleCam, startShare, stopShare,
  } = useMeshCall({ call, onEnded, extraSignalRef });

  const follow = useFollowMe({ callId: call.callId, peers });
  useEffect(() => { extraSignalRef.current = follow.handleSignal; });

  const peerList  = Object.entries(peers).map(([id, p]) => ({ id: Number(id), ...p }));
  const joined    = peerList.filter(p => p.state !== "ringing");
  const anyLive   = peerList.some(p => p.state === "connected");
  const allFailed = joined.length > 0 && joined.every(p => p.state === "failed")
                    && !peerList.some(p => p.state === "ringing");
  const phase = failReason || allFailed ? "failed"
    : anyLive ? "connected"
    : joined.length ? "connecting"
    : isInitiator ? "ringing" : "connecting";
  const failText  = failReason || (hasTurn ? NET_MSG : NO_ROUTE_MSG);

  // Call timer runs from the first connection
  useEffect(() => {
    if (phase !== "connected" || timerRef.current) return;
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
  }, [phase]);
  useEffect(() => () => clearInterval(timerRef.current), []);

  // 45s to be answered, 30s to connect; a failure stays on screen briefly
  useEffect(() => {
    let t;
    if (phase === "ringing")    t = setTimeout(() => fail("No answer."), 45000);
    if (phase === "connecting") t = setTimeout(() => fail(), 30000);
    if (phase === "failed")     t = setTimeout(() => finish(true), 8000);
    return () => clearTimeout(t);
  }, [phase, fail, finish]);

  // Closing or reloading the tab mid-call must take us out of it on the server
  useEffect(() => {
    const onHide = () => {
      const token = getLocalStorage("token");
      fetch(`${API_BASE_URL}/comm/calls/${call.callId}/leave`, {
        method: "POST",
        keepalive: true,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      }).catch(() => {});
    };
    window.addEventListener("pagehide", onHide);
    return () => window.removeEventListener("pagehide", onHide);
  }, [call.callId]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  const myId      = myUserId();
  const invited   = (call.participants || []).filter(p => Number(p.userId ?? p.user_id) !== myId);
  const isGroup   = invited.length > 1 || peerList.length > 1;
  const title     = isGroup ? "Group call"
    : (peerList[0]?.name || (isInitiator ? (call.peerName || invited[0]?.userName || call.initiatorName) : call.initiatorName) || "Call");
  const inCall    = peerList.filter(p => p.state === "connected").length + 1;
  const statusText = phase === "failed" ? "Call failed"
    : phase === "connected" ? `${fmt(elapsed)}${isGroup ? ` · ${inCall} in call` : ""}`
    : phase === "ringing" ? "Ringing…" : "Connecting…";

  const sharing    = !!screenStream;
  const myVideo    = sharing ? screenStream : (camOn && localStream?.getVideoTracks().length ? localStream : null);
  const presenter  = sharing ? "me" : peerList.find(p => p.sharing && remoteHasVideo(p))?.id;
  const anyVideo   = !!myVideo || peerList.some(remoteHasVideo);

  const width = expanded ? Math.min(960, Math.round(window.innerWidth * 0.92))
    : minimised ? 256
    : (isGroup || presenter) ? 560 : (isVideo || anyVideo) ? 360 : 288;
  const stageH = expanded ? "62vh" : (isGroup || presenter) ? 300 : (isVideo || anyVideo) ? 220 : 170;

  const meTile = (props) => (
    <Tile key="me" name="You" stream={myVideo} showVideo={!!myVideo} micOff={!micOn}
      presenting={sharing} mirror={!sharing} {...props} />
  );
  // Follow button on each connected person: opens the pages they open
  const followBtn = (p) => {
    if (p.state !== "connected") return null;
    const on      = follow.following === p.id;
    const waiting = follow.pendingTo === p.id;
    return (
      <button type="button" disabled={waiting}
        onClick={(e) => { e.stopPropagation(); if (on) follow.stopFollowing(); else follow.askToFollow(p.id); }}
        title={on ? "Stop following" : `Follow ${p.name || "this person"}'s page`}
        className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition disabled:opacity-60
          ${on ? "bg-emerald-500 text-white" : "bg-black/50 text-gray-200 hover:bg-black/70"}`}>
        <Navigation size={10} />{on ? "Following" : waiting ? "Asking…" : "Follow"}
      </button>
    );
  };
  const peerTile = (p, props) => (
    <Tile key={p.id} name={p.name || `User ${p.id}`} stream={p.stream} showVideo={remoteHasVideo(p)}
      status={PEER_STATE_TEXT[p.state]} micOff={p.mic === false} presenting={p.sharing}
      action={props?.small ? null : followBtn(p)} {...props} />
  );

  let stageView;
  if (presenter) {
    // Shared screen large, everyone else in a strip underneath
    const main = presenter === "me" ? meTile({ className: "flex-1 min-h-0" })
      : peerTile(peerList.find(p => p.id === presenter), { className: "flex-1 min-h-0" });
    const rest = [
      ...(presenter === "me" ? [] : [meTile({ className: "w-24 h-16 shrink-0", small: true })]),
      ...peerList.filter(p => p.id !== presenter).map(p => peerTile(p, { className: "w-24 h-16 shrink-0", small: true })),
    ];
    stageView = (
      <div className="flex flex-col gap-1 p-1 bg-black" style={{ height: stageH }}>
        {main}
        {rest.length > 0 && <div className="flex gap-1 overflow-x-auto shrink-0">{rest}</div>}
      </div>
    );
  } else if (!isGroup) {
    // 1:1 — the other person large, me as a small picture-in-picture
    const other = peerList[0];
    stageView = (
      <div className="relative bg-black" style={{ height: stageH }}>
        {other && phase !== "failed"
          ? peerTile(other, { className: "w-full h-full rounded-none" })
          : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
              <div className="w-14 h-14 rounded-full bg-[#003b8e] flex items-center justify-center text-xl font-bold">
                {(title || "?")[0]?.toUpperCase()}
              </div>
              <p className={`text-xs ${phase === "failed" ? "text-red-300" : "text-gray-300 animate-pulse"}`}>{statusText}</p>
            </div>
          )}
        {myVideo && meTile({ className: "absolute bottom-2 right-2 w-24 h-16 border border-white/20", small: true })}
        {phase !== "connected" && (
          <p className="absolute top-1 inset-x-0 text-[10px] text-gray-500 px-4 text-center">{stage}</p>
        )}
      </div>
    );
  } else {
    // Group — everyone in an even grid
    const count = peerList.length + 1;
    const cols  = count <= 4 ? 2 : 3;
    stageView = (
      <div className="grid gap-1 p-1 bg-black"
        style={{ height: stageH, gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, gridAutoRows: "1fr" }}>
        {meTile({ className: "min-h-0" })}
        {peerList.map(p => peerTile(p, { className: "min-h-0" }))}
      </div>
    );
  }

  const btn = "w-10 h-10 rounded-full flex items-center justify-center transition disabled:opacity-40";

  return (
    <Draggable key={expanded ? "big" : "normal"} width={width}
      initialX={expanded ? (window.innerWidth - width) / 2 : window.innerWidth - width - 16} initialY={16}>
      {peerList.map(p => p.stream && <RemoteAudio key={p.id} stream={p.stream} />)}
      <div className="bg-[#1e2a3a] rounded-2xl shadow-2xl overflow-hidden text-white"
        style={{ width, boxShadow: "0 8px 40px rgba(0,0,0,0.5)" }}>

        <div data-drag-handle className="flex items-center gap-3 px-4 py-3 bg-[#162030] cursor-grab active:cursor-grabbing">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
            ${phase === "failed" ? "bg-red-500" : phase === "connected" ? "bg-emerald-500" : "bg-amber-500 animate-pulse"}`}>
            {isGroup ? <Users size={14} /> : isVideo ? <Video size={14} /> : <Phone size={14} />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold truncate">{title}</p>
            <p className={`text-[10px] ${phase === "failed" ? "text-red-300" : "text-gray-400"}`}>{statusText}</p>
          </div>
          {!minimised && (
            <button onClick={() => setExpanded(x => !x)} title={expanded ? "Smaller" : "Bigger"}
              className="p-1 rounded hover:bg-[#1e2a3a] transition">
              {expanded ? <Shrink size={13} /> : <Expand size={13} />}
            </button>
          )}
          <button onClick={() => { setMinimised(m => !m); setExpanded(false); }} title={minimised ? "Restore" : "Minimise"}
            className="p-1 rounded hover:bg-[#1e2a3a] transition">
            {minimised ? <Maximize2 size={13} /> : <Minimize2 size={13} />}
          </button>
        </div>

        <FollowBars follow={follow} />

        {!minimised && (
          <>
            {mediaError && (
              <div className="flex gap-2 items-start px-4 py-2 bg-amber-500/15 text-amber-200 text-[11px]">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span>{mediaError}</span>
              </div>
            )}
            {phase === "failed" && (
              <div className="flex gap-2 items-start px-4 py-2 bg-red-500/15 text-red-200 text-[11px]">
                <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                <span>{failText} Closing…</span>
              </div>
            )}

            {stageView}

            <div className="flex items-center justify-center gap-3 px-4 pb-4 pt-3">
              <button onClick={toggleMic} disabled={!localStream?.getAudioTracks().length} title={micOn ? "Mute" : "Unmute"}
                className={`${btn} ${!micOn ? "bg-red-500 hover:bg-red-600" : "bg-[#2d3d52] hover:bg-[#3a4f67]"}`}>
                {micOn ? <Mic size={16} /> : <MicOff size={16} />}
              </button>
              {localStream?.getVideoTracks().length > 0 && (
                <button onClick={toggleCam} title={camOn ? "Turn camera off" : "Turn camera on"}
                  className={`${btn} ${!camOn ? "bg-red-500 hover:bg-red-600" : "bg-[#2d3d52] hover:bg-[#3a4f67]"}`}>
                  {camOn ? <Video size={16} /> : <VideoOff size={16} />}
                </button>
              )}
              {canShare && (
                <button onClick={sharing ? stopShare : startShare} title={sharing ? "Stop sharing" : "Share screen"}
                  className={`${btn} ${sharing ? "bg-emerald-600 hover:bg-emerald-700" : "bg-[#2d3d52] hover:bg-[#3a4f67]"}`}>
                  {sharing ? <MonitorX size={16} /> : <MonitorUp size={16} />}
                </button>
              )}
              <button onClick={() => finish(true)} title="Leave call"
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
// Hang-up by others, late joiners and leavers are all handled inside the call
// window (it polls the call's status and participants).
export default function CallPopup() {
  const { incomingCall, activeCall } = useComm();
  if (activeCall)   return <ActiveCallWindow key={activeCall.callId} call={activeCall} />;
  if (incomingCall) return <IncomingCallToast call={incomingCall} />;
  return null;
}
