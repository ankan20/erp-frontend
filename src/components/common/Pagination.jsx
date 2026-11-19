"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

// One pager for every list in the app (client-side in DataTable, or a server
// "pagination" block from the API — same look either way).
//   page / totalPages / total / limit  — 1-based page, rows per page
//   onPage(p)                          — go to page p
//   onLimit(n)                         — optional; shows the "Rows" selector
export default function Pagination({
  page = 1,
  totalPages = 1,
  total = 0,
  limit,
  onPage,
  onLimit,
  loading = false,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  className = "",
}) {
  if (!total) return null;
  const showPager = totalPages > 1;
  if (!showPager && !(onLimit && total > pageSizeOptions[0])) return null;

  const from = limit ? (page - 1) * limit + 1 : 1;
  const to = limit ? Math.min(page * limit, total) : total;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1)
    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1);

  const go = (p) => { if (!loading && p >= 1 && p <= totalPages && p !== page) onPage?.(p); };
  const btn = "inline-flex items-center justify-center min-w-[24px] h-[22px] px-1.5 border rounded-sm transition disabled:opacity-40 disabled:cursor-not-allowed";
  const idle = "border-[#9e9e9e] bg-white hover:bg-[#e6e6e6]";

  return (
    <div className={`flex flex-wrap items-center justify-between gap-2 px-2 py-1.5 text-[12px] text-gray-600 border-t border-[#9e9e9e] bg-[#f7f7f7] ${className}`}>
      <span>
        Showing <b>{from}</b>–<b>{to}</b> of <b>{total}</b> record{total !== 1 ? "s" : ""}
      </span>

      <div className="flex items-center gap-3">
        {onLimit && (
          <label className="flex items-center gap-1">
            Rows
            <select
              value={limit ?? ""}
              disabled={loading}
              onChange={(e) => onLimit(Number(e.target.value))}
              className="h-[22px] border border-[#9e9e9e] rounded-sm bg-white px-1 outline-none"
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        )}

        {showPager && (
          <div className="flex items-center gap-1">
            <button type="button" title="First page" className={`${btn} ${idle}`} disabled={page === 1 || loading} onClick={() => go(1)}>
              <ChevronsLeft size={13} />
            </button>
            <button type="button" title="Previous page" className={`${btn} ${idle}`} disabled={page === 1 || loading} onClick={() => go(page - 1)}>
              <ChevronLeft size={13} />
            </button>
            {pages.map((p, i) => (
              <span key={p} className="flex items-center gap-1">
                {i > 0 && pages[i - 1] !== p - 1 && <span className="px-0.5">…</span>}
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => go(p)}
                  className={`${btn} ${p === page ? "bg-[#144664] border-[#144664] text-white font-semibold" : idle}`}
                >
                  {p}
                </button>
              </span>
            ))}
            <button type="button" title="Next page" className={`${btn} ${idle}`} disabled={page === totalPages || loading} onClick={() => go(page + 1)}>
              <ChevronRight size={13} />
            </button>
            <button type="button" title="Last page" className={`${btn} ${idle}`} disabled={page === totalPages || loading} onClick={() => go(totalPages)}>
              <ChevronsRight size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
