"use client";

import { useState, useRef, useEffect, useLayoutEffect } from "react";
import { Maximize2, X } from "lucide-react";

export default function ExpandableTextCell({
  value       = "",
  onChange,
  disabled    = false,
  placeholder = "—",
  label       = "Description",
  textSize    = "text-[11px]",
  className   = "",
}) {
  const [open, setOpen]             = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const textRef     = useRef(null);
  const textareaRef = useRef(null);

  // Detect whether the clamped text is actually truncated
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const check = () => setIsOverflowing(el.scrollHeight > el.clientHeight + 1);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const close = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);

  // Focus + move cursor to end when modal opens in edit mode
  useEffect(() => {
    if (!open || disabled || !textareaRef.current) return;
    textareaRef.current.focus();
    const len = textareaRef.current.value.length;
    textareaRef.current.setSelectionRange(len, len);
  }, [open, disabled]);

  const canOpen = isOverflowing || !disabled;

  return (
    <>
      {/* ── CELL CONTENT ───────────────────────────────────────────────── */}
      <div className={`relative w-full ${className}`}>
        <div
          ref={textRef}
          onClick={() => canOpen && setOpen(true)}
          className={`w-full px-1.5 py-0.5 leading-tight ${isOverflowing ? "pr-5" : "pr-1.5"} ${textSize} ${disabled ? "text-[#9ca3af]" : "text-inherit"} ${canOpen ? "cursor-pointer" : ""}`}
          style={{
            display:         "-webkit-box",
            WebkitLineClamp: 1,
            WebkitBoxOrient: "vertical",
            overflow:        "hidden",
            wordBreak:       "break-word",
          }}
        >
          {value || <span className="text-[#bbb] italic">{placeholder}</span>}
        </div>

        {isOverflowing && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            tabIndex={-1}
            className="absolute bottom-0.5 right-0.5 p-0.5 rounded opacity-40 hover:opacity-100 hover:bg-[#e8f0fa] transition"
            title={`Expand ${label}`}
          >
            <Maximize2 size={9} className="text-[#3b6ea5]" />
          </button>
        )}
      </div>

      {/* ── MODAL ──────────────────────────────────────────────────────── */}
      {open && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-white rounded-md shadow-2xl w-[520px] max-w-[92vw] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#d8e6f0] bg-[#eef4fb] rounded-t-md">
              <span className="font-semibold text-[13px] text-[#1c3a5e]">{label}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-[#888] hover:text-[#333] transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Textarea */}
            <div className="p-4">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => onChange?.(e.target.value)}
                disabled={disabled}
                placeholder={placeholder}
                rows={7}
                className={`
                  w-full border rounded p-2.5 text-[13px] leading-relaxed resize-none outline-none
                  ${disabled
                    ? "bg-[#f5f5f5] text-[#555] border-[#ddd] cursor-default"
                    : "bg-white text-[#333] border-[#b5b5b5] focus:border-[#3b6ea5] focus:ring-1 focus:ring-[#3b6ea5]/30"
                  }
                `}
              />
              {disabled && (
                <p className="text-[11px] text-[#aaa] mt-1">Read-only</p>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 pb-4">
              <span className="text-[11px] text-gray-400">
                {value.trim() ? `${value.trim().split(/\s+/).filter(Boolean).length} words` : "0 words"}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-5 py-1.5 bg-[#3b6ea5] text-white text-[13px] rounded hover:brightness-110 transition"
              >
                {disabled ? "Close" : "Done"}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}
