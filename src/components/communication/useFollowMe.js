"use client";

// "Follow me" inside a call: one person (follower) asks to follow another
// (leader); once the leader allows it, every page the leader opens is opened
// for the follower too — but only if the follower is allowed to see that page.
//
// Messages travel over the call's signal channel:
//   follow_req  follower → leader   "can I follow you?"
//   follow_ok   leader   → follower "yes" (followed by a nav)
//   follow_no   leader   → follower "no"
//   follow_stop either way          stop following / stop being followed
//   nav         leader   → follower { path, title }
import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { sendSignal } from "@/lib/commApi";
import { canOpenRoute, findRouteInfo } from "@/lib/routeAccess";

export function useFollowMe({ callId, peers }) {
  const router   = useRouter();
  const pathname = usePathname();

  const [followers,   setFollowers]   = useState([]);    // user ids following me
  const [following,   setFollowing]   = useState(null);  // user id I follow
  const [requestFrom, setRequestFrom] = useState([]);    // user ids asking to follow me
  const [pendingTo,   setPendingTo]   = useState(null);  // user id I asked
  const [notice,      setNotice]      = useState(null);  // { text, tone: "info" | "warn" }
  const [leaderPage,  setLeaderPage]  = useState(null);  // title of the page the leader is on

  const followingRef = useRef(null);
  useEffect(() => { followingRef.current = following; });

  const nameOf = useCallback((uid) => peers[uid]?.name || `User ${uid}`, [peers]);
  const send = useCallback((uid, type, payload = {}) =>
    sendSignal(callId, uid, type, payload).catch(() => {}), [callId]);

  const currentPage = () => {
    const path = `${window.location.pathname}${window.location.search}`;
    return { path, title: findRouteInfo(path)?.title || null };
  };

  // Called by the call hook for every signal it doesn't handle itself
  const handleSignal = useCallback((s) => {
    const uid = Number(s.senderId);
    switch (s.signalType) {
      case "follow_req":
        setRequestFrom(list => list.includes(uid) ? list : [...list, uid]);
        return true;
      case "follow_ok":
        setPendingTo(null);
        setFollowing(uid);
        setNotice({ text: `Now following ${nameOf(uid)}'s page`, tone: "info" });
        return true;
      case "follow_no":
        setPendingTo(null);
        setNotice({ text: `${nameOf(uid)} declined`, tone: "warn" });
        return true;
      case "follow_stop":
        setFollowers(list => list.filter(x => x !== uid));
        setRequestFrom(list => list.filter(x => x !== uid));
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

  // Leader: send every page change to the followers
  const liveFollowers = followers.filter(uid => peers[uid]);
  const followersKey  = liveFollowers.join(",");
  useEffect(() => {
    if (!followersKey) return;
    const page = currentPage();
    followersKey.split(",").forEach(uid => send(Number(uid), "nav", page));
  }, [pathname, followersKey, send]);

  const askToFollow = (uid) => {
    if (following) send(following, "follow_stop");
    setFollowing(null);
    setPendingTo(uid);
    setNotice({ text: `Asked ${nameOf(uid)} to share their page…`, tone: "info" });
    send(uid, "follow_req");
  };

  const stopFollowing = () => {
    if (following) send(following, "follow_stop");
    setFollowing(null);
    setLeaderPage(null);
    setNotice(null);
  };

  const allow = (uid) => {
    setRequestFrom(list => list.filter(x => x !== uid));
    setFollowers(list => list.includes(uid) ? list : [...list, uid]);
    send(uid, "follow_ok");     // the nav effect sends our current page right after
  };

  const decline = (uid) => {
    setRequestFrom(list => list.filter(x => x !== uid));
    send(uid, "follow_no");
  };

  const stopLeading = () => {
    liveFollowers.forEach(uid => send(uid, "follow_stop"));
    setFollowers([]);
  };

  return {
    handleSignal,
    following: following && peers[following] ? following : null,
    followers: liveFollowers,
    requests:  requestFrom.filter(uid => peers[uid]),
    pendingTo,
    notice,
    leaderPage,
    nameOf,
    askToFollow, stopFollowing, allow, decline, stopLeading,
    dismissNotice: () => setNotice(null),
  };
}
