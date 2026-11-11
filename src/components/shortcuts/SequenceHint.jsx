"use client";

// Small box shown after pressing G (go to) or N (new): lists the page codes
// that match what has been typed so far.

import Kbd from "./Kbd";

export default function SequenceHint({ sequence }) {
  if (!sequence) return null;
  const { mode, typed, pages } = sequence;
  const isNew = mode === "new";
  const matches = pages
    .filter((p) => p.code && p.code.startsWith(typed) && (!isNew || p.newPath))
    .sort((a, b) => a.code.localeCompare(b.code));

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-1/2 z-[10000] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-lg border border-[#9fb3c8] bg-white shadow-xl"
    >
      <div className="flex items-center gap-2 border-b border-[#d8e1ea] bg-[#eef4fa] px-3 py-2 text-[13px]">
        <span className="font-semibold text-[#144664]">{isNew ? "New entry" : "Go to page"}</span>
        <Kbd combo={isNew ? "N" : "G"} />
        <Kbd combo={typed[0] || "_"} />
        <Kbd combo="_" />
        <span className="ml-auto text-[11px] text-gray-500">type the 2-letter code · Esc to cancel</span>
      </div>
      <div className="grid max-h-[40vh] grid-cols-1 gap-x-4 overflow-y-auto px-3 py-2 sm:grid-cols-2">
        {matches.length === 0 && (
          <p className="col-span-full py-2 text-[12.5px] text-gray-500">
            No page code starts with “{typed}”{isNew ? " that you can create" : ""}.
          </p>
        )}
        {matches.map((p) => (
          <div key={p.path} className="flex items-center gap-2 py-[3px] text-[12.5px]">
            <span className="w-7 shrink-0 font-mono font-bold text-[#b03030]">{p.code}</span>
            <span className="truncate text-gray-800">{p.title}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
