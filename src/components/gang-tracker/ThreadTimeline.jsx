"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { fmtDate, initials, isClosed, personColor, todayStr, THREAD_STATUS_STYLE } from "./shared";

/**
 * Commit-graph style history of one conversation.
 *
 *  ● lane per person (colour = person), in order of first appearance
 *  ─ solid line: the conversation moving from one talk to the next
 *    (it curves across when you talk to someone else, and curves back — a "merge" — when you return)
 *  ┄ dashed line: "A referred you to B" — a branch to B's lane
 *  ◌ hollow dashed node at the end: the scheduled next talk
 */
const LANE_W = 26;
const PAD = 16;
const NODE_Y = 22; // node centre from the top of its row

export default function ThreadTimeline({ thread, onOpenPerson }) {
  const entries = thread.entries || [];
  const lanes = thread.people.map((p) => p.id);
  const laneOf = (id) => Math.max(0, lanes.indexOf(id));
  const laneX = (i) => PAD + i * LANE_W;
  const gutter = PAD * 2 + Math.max(0, lanes.length - 1) * LANE_W;

  // each row's lane: who we talked to (a status-only update stays on the previous lane)
  const rowLane = [];
  entries.forEach((e, i) => rowLane.push(e.member ? laneOf(e.member.id) : (rowLane[i - 1] ?? 0)));

  const pending = !isClosed(thread.status) && (thread.nextFollowup || thread.nextMember);
  const pendingLane = thread.nextMember ? laneOf(thread.nextMember.id) : rowLane[rowLane.length - 1] ?? 0;

  const wrapRef = useRef(null);
  const rowRefs = useRef([]);
  const [ys, setYs] = useState([]);
  const [h, setH] = useState(0);

  useLayoutEffect(() => {
    const measure = () => {
      if (!wrapRef.current) return;
      setYs(rowRefs.current.slice(0, entries.length + (pending ? 1 : 0)).map((el) => (el ? el.offsetTop + NODE_Y : 0)));
      setH(wrapRef.current.offsetHeight);
    };
    measure();
    const ro = new ResizeObserver(measure);
    wrapRef.current && ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [entries.length, pending, thread]);

  // curve that leaves x1 straight away and then runs down x2 (git-graph style)
  const path = (x1, y1, x2, y2) =>
    x1 === x2 ? `M${x1},${y1} L${x2},${y2}` : `M${x1},${y1} C${x1},${y1 + 18} ${x2},${y1 + 6} ${x2},${y1 + 26} L${x2},${y2}`;

  const svg = [];
  if (ys.length) {
    // lifelines: faint track for each person between their first and last appearance
    lanes.forEach((pid, li) => {
      const rows = [];
      entries.forEach((e, i) => {
        if (rowLane[i] === li) rows.push(ys[i]);
        if (e.referredTo?.id === pid) rows.push(ys[i] + 26);
      });
      if (pending && pendingLane === li) rows.push(ys[entries.length]);
      if (rows.length > 1)
        svg.push(<line key={`life${li}`} x1={laneX(li)} x2={laneX(li)} y1={Math.min(...rows)} y2={Math.max(...rows)}
          stroke={personColor(pid)} strokeOpacity={0.15} strokeWidth={6} strokeLinecap="round" />);
    });

    // the conversation path
    entries.forEach((e, i) => {
      if (i === 0) return;
      const c = personColor(lanes[rowLane[i]]);
      svg.push(<path key={`m${i}`} d={path(laneX(rowLane[i - 1]), ys[i - 1], laneX(rowLane[i]), ys[i])}
        fill="none" stroke={c} strokeWidth={2.5} />);
    });

    // referral branches: to that person's next talk, or a short stub if not talked to yet
    entries.forEach((e, i) => {
      if (!e.referredTo) return;
      const to = laneOf(e.referredTo.id);
      const c = personColor(e.referredTo.id);
      const j = entries.findIndex((x, k) => k > i && x.member?.id === e.referredTo.id);
      const endY = j > 0 ? ys[j] : (pending && pendingLane === to ? ys[entries.length] : ys[i] + 34);
      svg.push(<path key={`r${i}`} d={path(laneX(rowLane[i]), ys[i], laneX(to), endY)}
        fill="none" stroke={c} strokeWidth={2} strokeDasharray="5 4" />);
      if (j < 0 && !(pending && pendingLane === to))
        svg.push(<circle key={`rs${i}`} cx={laneX(to)} cy={endY} r={4.5} fill="white" stroke={c} strokeWidth={2} strokeDasharray="3 2" />);
    });

    // next scheduled step
    if (pending && entries.length) {
      const c = personColor(lanes[pendingLane]);
      const last = entries.length - 1;
      svg.push(<path key="pend" d={path(laneX(rowLane[last]), ys[last], laneX(pendingLane), ys[entries.length])}
        fill="none" stroke={c} strokeWidth={2} strokeDasharray="2 4" strokeLinecap="round" />);
    }

    // nodes on top
    entries.forEach((e, i) => {
      const c = personColor(lanes[rowLane[i]]);
      const closing = isClosed(e.statusAfter);
      svg.push(
        <g key={`n${i}`}>
          <circle cx={laneX(rowLane[i])} cy={ys[i]} r={closing ? 8 : 7} fill={closing ? c : "white"} stroke={c} strokeWidth={3} />
          {closing && <path d={`M${laneX(rowLane[i]) - 3.5},${ys[i]} l2.5,2.5 l4.5,-5`} fill="none" stroke="white" strokeWidth={2} />}
        </g>
      );
    });
    if (pending)
      svg.push(<circle key="pn" cx={laneX(pendingLane)} cy={ys[entries.length]} r={7} fill="white"
        stroke={personColor(lanes[pendingLane])} strokeWidth={2.5} strokeDasharray="3 2.5" />);
  }

  const today = todayStr();

  return (
    <div>
      {/* lane legend */}
      <div className="flex items-center gap-3 flex-wrap mb-2 text-[11px] text-gray-500">
        {thread.people.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: personColor(p.id) }} />
            <button type="button" onClick={() => onOpenPerson?.(p.id)} className="hover:text-gray-900 hover:underline underline-offset-2" title="View profile">{p.name}</button>
          </span>
        ))}
        <span className="ml-auto inline-flex items-center gap-3 text-gray-400">
          <span className="inline-flex items-center gap-1"><svg width="22" height="6"><line x1="0" y1="3" x2="22" y2="3" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" /></svg>referred</span>
          <span className="inline-flex items-center gap-1"><svg width="12" height="12"><circle cx="6" cy="6" r="4.5" fill="white" stroke="#94a3b8" strokeWidth="2" strokeDasharray="2.5 2" /></svg>next</span>
        </span>
      </div>

      <div ref={wrapRef} className="relative">
        <svg className="absolute left-0 top-0 pointer-events-none" width={gutter} height={h}>{svg}</svg>

        {entries.map((e, i) => {
          const st = THREAD_STATUS_STYLE[e.statusAfter];
          return (
            <div key={e.id} ref={(el) => (rowRefs.current[i] = el)} className="flex pb-3" style={{ paddingLeft: gutter }}>
              <div className="flex-1 min-w-0 rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-gray-300 transition-colors">
                <div className="flex items-center gap-2 flex-wrap">
                  {e.member ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-800">
                      <span className="w-5 h-5 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                        style={{ background: personColor(e.member.id) }}>{initials(e.member.name)}</span>
                      <button type="button" onClick={() => onOpenPerson?.(e.member.id)} className="hover:underline underline-offset-2" title="View profile">{e.member.name}</button>
                    </span>
                  ) : <span className="text-xs font-semibold text-gray-500">Update</span>}
                  <span className="text-[11px] text-gray-400">{fmtDate(e.date)}</span>
                  {st && <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${st.cls}`}>{e.statusAfter}</span>}
                  {e.by && <span className="ml-auto text-[10px] text-gray-300">by {e.by}</span>}
                </div>
                {e.note && <p className="text-xs text-gray-700 mt-1 whitespace-pre-wrap">{e.note}</p>}
                {(e.referredTo || e.nextFollowup || e.nextAction) && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {e.referredTo && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full border border-dashed"
                        style={{ borderColor: personColor(e.referredTo.id), color: personColor(e.referredTo.id) }}>
                        ↪ referred to <b>{e.referredTo.name}</b>
                      </span>
                    )}
                    {e.nextFollowup && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600">
                        📅 next {e.nextMember ? `with ${e.nextMember.name} ` : ""}on {fmtDate(e.nextFollowup)}
                      </span>
                    )}
                    {e.nextAction && <span className="text-[11px] px-2 py-0.5 rounded-full bg-gray-50 border border-gray-200 text-gray-600">→ {e.nextAction}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {pending && (
          <div ref={(el) => (rowRefs.current[entries.length] = el)} className="flex pb-1" style={{ paddingLeft: gutter }}>
            <div className={`flex-1 rounded-lg border border-dashed px-3 py-2 text-xs ${
              thread.nextFollowup && thread.nextFollowup < today ? "border-red-300 bg-red-50/50 text-red-700"
                : thread.nextFollowup === today ? "border-amber-300 bg-amber-50/60 text-amber-800" : "border-gray-300 bg-gray-50 text-gray-600"}`}>
              <span className="font-semibold">Next: </span>
              {thread.nextMember ? <>talk to <b>{thread.nextMember.name}</b></> : "follow up"}
              {thread.nextFollowup && <> on <b>{fmtDate(thread.nextFollowup)}</b>{thread.nextFollowup < today ? " (overdue)" : thread.nextFollowup === today ? " (today)" : ""}</>}
              {thread.nextAction && <> — {thread.nextAction}</>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
