"use client";

import { useState, useRef, useEffect } from "react";
import { Maximize2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * PMTextarea — auto-growing textarea with an expand-to-modal option.
 * Same flat no-border aesthetic as PMInput; error state shows red border.
 *
 * Fully controlled: pass value + onChange (compatible with RHF Controller).
 *
 * Props:
 *   value        string
 *   onChange     (newValue: string) => void
 *   onBlur       () => void
 *   hasError     bool|object
 *   disabled     bool
 *   placeholder  string
 *   title        string   — modal header title
 *   rows         number   — initial visible rows (default 2)
 *   maxRows      number   — row cap before zoom icon appears (default 4)
 *   modalRows    number   — rows inside the modal textarea (default 10)
 *   maxLength    number   — optional char cap (shown in modal)
 *   className    string
 *   modalWidth   string   — tailwind max-w class for modal
 */
export default function PMTextarea({
  value        = "",
  onChange,
  onBlur,
  hasError     = false,
  disabled     = false,
  placeholder  = "Enter text…",
  title        = "Edit",
  rows         = 2,
  maxRows      = 4,
  modalRows    = 10,
  maxLength,
  className    = "",
  modalWidth   = "sm:max-w-[640px]",
}) {
  const [open,     setOpen]     = useState(false);
  const [draft,    setDraft]    = useState("");
  const [overflow, setOverflow] = useState(false);
  const inlineRef = useRef(null);
  const modalRef  = useRef(null);
  const isErr     = !!hasError;

  // detect inline overflow to pulse the zoom icon
  useEffect(() => {
    const el = inlineRef.current;
    if (!el) return;
    setOverflow(el.scrollHeight > el.clientHeight + 2);
  }, [value, rows]);

  useEffect(() => {
    if (open && !disabled) setTimeout(() => modalRef.current?.focus(), 80);
  }, [open, disabled]);

  const handleOpen = () => { setDraft(value); setOpen(true); };
  const handleSave = () => { onChange?.(draft); setOpen(false); };
  const handleCancel = () => { setDraft(value); setOpen(false); };

  const baseCls = cn(
    "w-full resize-none rounded-sm text-[13px] px-2 py-1.5 pr-7 outline-none transition-colors",
    "border",
    isErr
      ? "border-red-400 bg-red-50 text-red-900 placeholder:text-red-300"
      : disabled
      ? "border-transparent bg-[#edf8ed] text-gray-500 cursor-default"
      : "border-transparent bg-transparent focus:border-transparent",
    "placeholder:text-gray-400 placeholder:text-[13px]",
    "disabled:opacity-100 disabled:cursor-default",
  );

  return (
    <>
      {/* ── INLINE WRAPPER ── */}
      <div className={cn("relative group", className)}>
        <textarea
          ref={inlineRef}
          value={value}
          onChange={(e) => { if (!disabled) onChange?.(e.target.value); }}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className={baseCls}
          style={{ overflow: "hidden" }}
          onInput={(e) => {
            const lineH = parseInt(getComputedStyle(e.target).lineHeight) || 20;
            const maxH  = lineH * maxRows + 12;
            e.target.style.height = "auto";
            const newH  = Math.min(e.target.scrollHeight, maxH);
            e.target.style.height = `${newH}px`;
            setOverflow(e.target.scrollHeight > maxH + 2);
          }}
        />
        {/* zoom icon */}
        <button
          type="button"
          tabIndex={-1}
          onClick={handleOpen}
          className={cn(
            "absolute bottom-1.5 right-1.5 p-0.5 rounded",
            "text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all",
            overflow
              ? "opacity-100 text-sky-500 animate-pulse"
              : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
          )}
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* ── MODAL ── */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
        <DialogContent showCloseButton={false} className={cn(modalWidth, "p-0 gap-0 overflow-hidden")}>
          <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b bg-[#f5f9ff]">
            <DialogTitle className="text-[14px] font-semibold text-gray-800">
              {title}
              {disabled && <span className="ml-2 text-[11px] font-normal text-gray-400">(read only)</span>}
            </DialogTitle>
            <button type="button" onClick={handleCancel} className="p-1 rounded hover:bg-gray-200 text-gray-500 transition">
              <X size={16} />
            </button>
          </DialogHeader>

          <div className="px-4 py-3">
            <textarea
              ref={modalRef}
              value={draft}
              onChange={(e) => {
                if (disabled) return;
                if (maxLength && e.target.value.length > maxLength) return;
                setDraft(e.target.value);
              }}
              disabled={disabled}
              placeholder={placeholder}
              rows={modalRows}
              className="w-full resize-none rounded-sm border border-[#b0c5d5] text-[13px] px-3 py-2 outline-none focus:ring-2 focus:ring-slate-200 bg-white text-gray-800 disabled:bg-[#edf8ed] disabled:text-gray-500"
            />
            <div className="flex justify-end mt-1">
              <span className="text-[11px] text-gray-400">
                {maxLength ? `${draft.length} / ${maxLength}` : `${draft.length} chars`}
              </span>
            </div>
          </div>

          <div className="flex justify-end gap-2 px-4 py-3 border-t bg-gray-50">
            <button type="button" onClick={handleCancel} className="h-8 px-4 rounded-sm border border-gray-300 text-[13px] text-gray-700 hover:bg-gray-100 transition">
              Cancel
            </button>
            {!disabled && (
              <button type="button" onClick={handleSave} className="h-8 px-4 rounded-sm border border-[#d97a2b] bg-[#f4b183] text-black text-[13px] font-medium hover:bg-[#eea36e] transition flex items-center gap-1.5">
                <Check size={13} /> Save
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
