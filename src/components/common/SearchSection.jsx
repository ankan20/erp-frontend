"use client";

import { useState } from "react";
import NavigationButton from "./NavigationButton";
import Image from "next/image";

export default function SearchSection({
  onSearch,
  showDateRange = false,
  actions = [],
}) {
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  return (
    <div className="mb-3 border-b pb-2">

      <div className="flex flex-wrap items-start gap-3">

        {/* 🔹 LEFT BLOCK */}
        <div className="flex flex-col gap-2 min-w-65">

          {/* ROW 1 */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="px-3.5 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-[14px] leading-5 rounded-sm whitespace-nowrap">
              Contain Search
            </div>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-6.5 w-65 sm:w-71 border border-[#8f8f8f] px-2 text-sm outline-none rounded-sm"
            />
          </div>

          {/* ROW 2 */}
          {showDateRange && (
            <div className="flex items-center gap-4 flex-wrap">

              <div className="flex items-center gap-2">
                <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-sm rounded-sm whitespace-nowrap">
                  From
                </div>

                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="h-6.5 w-35 border border-[#8f8f8f] px-2 text-sm rounded-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <div className="px-3 py-0.5 bg-[#b4b4d9] border border-[#6a6aa8] text-sm rounded-sm whitespace-nowrap">
                  To
                </div>

                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="h-6.5 w-35 border border-[#8f8f8f] px-2 text-sm rounded-sm"
                />
              </div>
            </div>
          )}
        </div>

        <button
          onClick={() => onSearch({ search, from, to })}
          className={`cursor-pointer ml-2 shrink-0 ${
    showDateRange ? "mt-2" : ""
  }`}
        >
          <Image
            src="/assets/icons/search.png"
            alt="search"
            width={showDateRange ? 40 : 30}
            height={showDateRange ? 40 : 30}
          />
        </button>

        <div className="flex-1 hidden sm:block" />

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