"use client";

// Page sync inside a call. Two ways to start it, both need the other side's OK:
//   Follow     — "I want to follow YOUR page"   (I become the follower)
//   Share page — "Please follow MY page"         (they become the follower)
// While linked, every page the leader opens is opened for the follower too —
// but only if the follower is allowed to see that page (see canOpenRoute).
//
// Signals (over the call's signal channel):
//   follow_req / follow_ok / follow_no   asking to follow someone
//   lead_req   / lead_ok   / lead_no     asking someone to follow me
//   follow_stop                          either side ends the link
//   nav { path, title }                  leader → followers on every page change
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { sendSignal } from "@/lib/commApi";
import { canOpenRoute, findRouteInfo } from "@/lib/routeAccess";

export function useFollowMe({ callId, peers }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [followers,  setFollowers]  = useState([]);    // user ids following me
  const [following,  setFollowing]  = useState(null);  // user id I follow
  const [requests,   setRequests]   = useState([]);    // [{ uid, kind: "follow" | "lead" }] waiting for my answer
  const [pending,    setPending]    = useState(null);  // { uid, kind } I asked, waiting for theirs
  const [notice,     setNotice]     = useState(null);  // { text, tone: "info" | "warn" }
  const [leaderPage, setLeaderPage] = useState(null);  // title of the page the leader is on

  const followingRef = useRef(null);
  useEffect(() => { followingRef.current = following; });

  const nameOf = useCallback((uid) => peers[uid]?.name || `User ${uid}`, [peers]);
  const send = useCallback((uid, type, payload = {}) =>
    sendSignal(callId, uid, type, payload).catch(() => {}), [callId]);

  const currentPage = () => {
    const path = `${window.location.pathname}${window.location.search}`;
    return { path, title: findRouteInfo(path)?.title || null };
  };

  const addRequest = (uid, kind) =>
    setRequests(list => list.some(r => r.uid === uid && r.kind === kind) ? list : [...list, { uid, kind }]);
  const removeRequest = (uid, kind) =>
    setRequests(list => list.filter(r => !(r.uid === uid && (!kind || r.kind === kind))));
  const addFollower = (uid) => setFollowers(list => list.includes(uid) ? list : [...list, uid]);

  // Called by the call hook for every signal it doesn't handle itself
  const handleSignal = useCallback((s) => {
    const uid = Number(s.senderId);
    switch (s.signalType) {
      case "follow_req":                       // they want to follow me
        addRequest(uid, "follow");
        return true;
      case "lead_req":                         // they want me to follow them
        addRequest(uid, "lead");
        return true;
      case "follow_ok":                        // I may follow them now
        setPending(null);
        setFollowing(uid);
        setNotice({ text: `Now following ${nameOf(uid)}'s page`, tone: "info" });
        return true;
      case "lead_ok":                          // they agreed to follow me
        setPending(null);
        addFollower(uid);                      // the nav effect sends my current page
        setNotice({ text: `${nameOf(uid)} is now following your page`, tone: "info" });
        return true;
      case "follow_no":
      case "lead_no":
        setPending(null);
        setNotice({ text: `${nameOf(uid)} declined`, tone: "warn" });
        return true;
      case "follow_stop":
        setFollowers(list => list.filter(x => x !== uid));
        removeRequest(uid);
        if (followingRef.current === uid) {
          setFollowing(null);
          setLeaderPage(null);
          setNotice({ text: `${nameOf(uid)} stopped sharing their page`, tone: "info" });
        }
        return true;
      case "nav": {
        if (followingRef.current !== uid) return true;          // not someone I follow
        const path = String(s.payload?.path || "");
        if (!path.startsWith("/")) return true;
        const { allowed, title } = canOpenRoute(path);
        const label = title || s.payload?.title || "a page";
        setLeaderPage(label);
        if (!allowed) {
          setNotice({ text: `${nameOf(uid)} is on ${label} — you don't have access to this page`, tone: "warn" });
        } else {
          setNotice(null);
          if (`${window.location.pathname}${window.location.search}` !== path) router.push(path);
        }
        return true;
      }
      default:
        return false;
    }
  }, [nameOf, router]);

  // Leader: send every page change (and the current page to new followers)
  const liveFollowers = followers.filter(uid => peers[uid]);
  const followersKey  = liveFollowers.join(",");
  useEffect(() => {
    if (!followersKey) return;
    const page = currentPage();
    followersKey.split(",").forEach(uid => send(Number(uid), "nav", page));
  }, [pathname, followersKey, send]);

  const stopFollowingSilently = () => {
    if (followingRef.current) send(followingRef.current, "follow_stop");
    setFollowing(null);
    setLeaderPage(null);
  };

  // I ask to follow them
  const askToFollow = (uid) => {
    stopFollowingSilently();
    setPending({ uid, kind: "follow" });
    setNotice({ text: `Asked ${nameOf(uid)} to share their page…`, tone: "info" });
    send(uid, "follow_req");
  };

  // I ask them to follow me
  const sharePageWith = (uid) => {
    setPending({ uid, kind: "lead" });
    setNotice({ text: `Asked ${nameOf(uid)} to follow your page…`, tone: "info" });
    send(uid, "lead_req");
  };

  const stopFollowing = () => {
    stopFollowingSilently();
    setNotice(null);
  };

  // Stop one follower, or all of them
  const stopLeading = (uid) => {
    const who = uid ? [uid] : liveFollowers;
    who.forEach(x => send(x, "follow_stop"));
    setFollowers(list => list.filter(x => !who.includes(x)));
  };

  const accept = ({ uid, kind }) => {
    removeRequest(uid, kind);
    if (kind === "follow") {
      addFollower(uid);
      send(uid, "follow_ok");
    } else {
      stopFollowingSilently();
      setFollowing(uid);
      setNotice({ text: `Now following ${nameOf(uid)}'s page`, tone: "info" });
      send(uid, "lead_ok");
    }
  };

  const decline = ({ uid, kind }) => {
    removeRequest(uid, kind);
    send(uid, kind === "follow" ? "follow_no" : "lead_no");
  };

  return {
    handleSignal,
    following: following && peers[following] ? following : null,
    followers: liveFollowers,
    requests:  requests.filter(r => peers[r.uid]),
    pending,
    notice,
    leaderPage,
    nameOf,
    askToFollow, sharePageWith, stopFollowing, stopLeading, accept, decline,
    dismissNotice: () => setNotice(null),
  };
}
