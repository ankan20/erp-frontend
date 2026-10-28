"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import NavigationButton from "./NavigationButton";
import Image from "next/image";

function readSession(key) {
  try { return JSON.parse(sessionStorage.getItem(key) || "null"); } catch { return null; }
}
function writeSession(key, val) {
  try { sessionStorage.setItem(key, JSON.stringify(val)); } catch {}
}

export default function SearchSection({
  onSearch,
  showDateRange = false,
  actions = [],
  storageKey,          // optional override; defaults to current pathname
}) {
  const pathname = usePathname();
  const key = `search-filters:${storageKey ?? pathname}`;

  const saved = readSession(key);
  const [search, setSearch] = useState(saved?.search ?? "");
  const [from,   setFrom]   = useState(saved?.from   ?? "");
  const [to,     setTo]     = useState(saved?.to     ?? "");

  // Restore filter on mount so parent list reruns with saved values
  useEffect(() => {
    if (saved) onSearch({ search: saved.search ?? "", from: saved.from ?? "", to: saved.to ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (s, f, t) => writeSession(key, { search: s, from: f, to: t });

  const hasAnyValue = search || from || to;

  const handleClear = () => {
    setSearch(""); setFrom(""); setTo("");
    writeSession(key, null);
    onSearch({ search: "", from: "", to: "" });
  };

  return (
    <div className="mb-3 border-b pb-2">
      <div className="flex flex-wrap items-start gap-3">

        {/* LEFT BLOCK */}
        <div className="flex flex-col gap-2 min-w-65">

          {/* ROW 1 — search input */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3.5 py-0.5 bg-[#7fc3d4] border border-[#5aafc2] text-[14px] leading-5 rounded-sm whitespace-nowrap">
              Contain Search
            </div>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); persist(e.target.value, from, to); }}
              onKeyDown={(e) => { if (e.key === "Enter") { persist(search, from, to); onSearch({ search, from, to }); } }}
              className="h-6.5 w-65 sm:w-71 border border-[#8f8f8f] px-2 text-sm outline-none rounded-sm"
            />
          </div>

          {/* ROW 2 — date range */}
          {showDateRange && (
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <div className="px-3 py-0.5 bg-[#7fc3d4] border border-[#5aafc2] text-sm rounded-sm whitespace-nowrap">
                  From
                </div>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => { setFrom(e.target.value); persist(search, e.target.value, to); }}
                  className="h-6.5 w-35 border border-[#8f8f8f] px-2 text-sm rounded-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="px-3 py-0.5 bg-[#7fc3d4] border border-[#5aafc2] text-sm rounded-sm whitespace-nowrap">
                  To
                </div>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => { setTo(e.target.value); persist(search, from, e.target.value); }}
                  className="h-6.5 w-35 border border-[#8f8f8f] px-2 text-sm rounded-sm"
                />
              </div>
            </div>
          )}
        </div>

        {/* Search icon button */}
        <button
          onClick={() => { persist(search, from, to); onSearch({ search, from, to }); }}
          className={`cursor-pointer ml-2 shrink-0 ${showDateRange ? "mt-2" : ""}`}
        >
          <Image
            src="/assets/icons/search.png"
            alt="search"
            width={showDateRange ? 40 : 30}
            height={showDateRange ? 40 : 30}
          />
        </button>

        {/* Clear button — visible only when something is filled */}
        {hasAnyValue && (
          <button
            type="button"
            onClick={handleClear}
            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm border text-[13px] font-medium shrink-0 transition-colors
              bg-[#f5e4e4] border-[#d9a0a0] text-[#b03030] hover:bg-[#fad4d4] hover:border-[#c07070]
              ${showDateRange ? "mt-2" : ""}`}
          >
            <X size={13} strokeWidth={2.5} />
            <span className="hidden xs:inline sm:inline">Clear</span>
          </button>
        )}

        <div className="flex-1 hidden sm:block" />

        {/* Action buttons (e.g. + Create BRR) */}
        <div className="flex flex-wrap items-center gap-2">
          {actions.map((btn, i) => (
            <NavigationButton key={i} onClick={btn.onClick}>
              {btn.label}
            </NavigationButton>
          ))}
        </div>

      </div>
    </div>
  );
}
