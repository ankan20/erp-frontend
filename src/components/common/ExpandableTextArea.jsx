"use client";

/**
 * ExpandableTextArea
 *
 * An inline textarea that:
 * - Lets the user type directly in place (no forced modal)
 * - Shows a zoom icon when content overflows OR when the user focuses in a cramped space
 * - Opens a full modal for comfortable editing when the icon is clicked
 * - Modal has Save / Cancel — changes only commit on Save
 * - Read-only / disabled mode shows content with greyed style, modal is view-only
 * - Error state shows red border (pass RHF fieldState.error or a boolean)
 * - Fully controlled (value + onChange) — use with RHF Controller
 * - onBlur forwarded for RHF touched tracking
 *
 * Props:
 *   value         string    — controlled value
 *   onChange      fn        — (newValue: string) => void
 *   onBlur        fn        — () => void  (RHF)
 *   disabled      bool      — read-only mode
 *   hasError      bool|obj  — red border when truthy (pass RHF error object or boolean)
 *   placeholder   string
 *   title         string    — modal header title
 *   rows          number    — visible rows in inline textarea (default 3)
 *   maxInlineRows number    — rows after which zoom icon pulses (default same as rows)
 *   modalRows     number    — rows inside the modal textarea (default 10)
 *   className     string    — extra classes on the wrapper
 *   modalWidth    string    — tailwind max-w class for modal (default "sm:max-w-[640px]")
 *   maxLength     number    — optional max chars (shown as counter in modal)
 */

import { useState, useRef, useEffect } from "react";
import { Maximize2, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ExpandableTextArea({
  value        = "",
  onChange,
  onBlur,
  disabled     = false,
  hasError     = false,
  placeholder  = "Enter text…",
  title        = "Edit Text",
  rows         = 3,
  maxInlineRows,
  modalRows    = 10,
  className    = "",
  modalWidth   = "sm:max-w-[640px]",
  maxLength,
}) {
  const [open,       setOpen]       = useState(false);
  const [draft,      setDraft]      = useState("");
  const [overflows,  setOverflows]  = useState(false);
  const inlineRef    = useRef(null);
  const modalRef     = useRef(null);

  const effectiveMaxRows = maxInlineRows ?? rows;
  const isError = hasError && hasError !== false && hasError !== null;

  // ── detect if inline textarea content overflows its visible height
  useEffect(() => {
    const el = inlineRef.current;
    if (!el) return;
    setOverflows(el.scrollHeight > el.clientHeight + 2);
  }, [value, rows]);

  // ── focus modal textarea when dialog opens
  useEffect(() => {
    if (open && !disabled) {
      setTimeout(() => modalRef.current?.focus(), 80);
    }
  }, [open, disabled]);

  const handleOpenModal = (e) => {
    e?.stopPropagation();
    setDraft(value);
    setOpen(true);
  };

  const handleSave = () => {
    onChange?.(draft);
    setOpen(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setOpen(false);
  };

  // ── inline textarea classes
  const borderCls = isError
    ? "border-red-500 bg-red-50 focus-within:ring-red-300"
    : disabled
    ? "border-[#7fa37f] bg-[#edf8ed]"
    : "border-[#8f8f8f] bg-white focus-within:ring-2 focus-within:ring-slate-200";

  const textCls = disabled ? "text-gray-500 cursor-default" : "text-gray-800";

  return (
    <>
      {/* ── INLINE WRAPPER ── */}
      <div className={`relative group w-full ${className}`}>
        <textarea
          ref={inlineRef}
          value={value}
          onChange={(e) => {
            if (disabled) return;
            onChange?.(e.target.value);
          }}
          onBlur={onBlur}
          disabled={disabled}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className={`
            w-full resize-none rounded-sm border text-[13px] px-2 py-1.5 pr-7
            outline-none transition-shadow
            ${borderCls} ${textCls}
          `}
          style={{ overflow: "hidden", paddingRight: "1.75rem" }}
          onInput={(e) => {
            // auto-grow up to effectiveMaxRows then lock and show zoom
            const lineH = parseInt(getComputedStyle(e.target).lineHeight) || 20;
            const maxH  = lineH * effectiveMaxRows + 12;
            e.target.style.height = "auto";
            const newH = Math.min(e.target.scrollHeight, maxH);
            e.target.style.height = `${newH}px`;
            setOverflows(e.target.scrollHeight > maxH + 2);
          }}
        />

        {/* ── ZOOM ICON — bottom-right corner, visible on hover or overflow ── */}
        <button
          type="button"
          tabIndex={-1}
          onClick={handleOpenModal}
          title="Expand"
          className={`
            absolute bottom-1.5 right-1.5 p-0.5 rounded
            text-gray-400 hover:text-gray-700 hover:bg-gray-100
            transition-all
            ${overflows ? "opacity-100 text-sky-500 animate-pulse" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}
          `}
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* ── MODAL ── */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) handleCancel(); }}>
        <DialogContent showCloseButton={false} className={`${modalWidth} p-0 gap-0 overflow-hidden`}>

          {/* Header */}
          <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b bg-[#f5f9ff]">
            <DialogTitle className="text-[14px] font-semibold text-gray-800">
              {title}
              {disabled && (
                <span className="ml-2 text-[11px] font-normal text-gray-400">(read only)</span>
              )}
            </DialogTitle>
            <button
              type="button"
              onClick={handleCancel}
              className="p-1 rounded hover:bg-gray-200 text-gray-500 transition"
            >
              <X size={16} />
            </button>
          </DialogHeader>

          {/* Textarea */}
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
              className={`
                w-full resize-none rounded-sm border text-[13px] px-3 py-2 outline-none
                transition-shadow focus:ring-2 focus:ring-slate-200
                ${disabled
                  ? "border-[#7fa37f] bg-[#edf8ed] text-gray-500 cursor-default"
                  : "border-[#8f8f8f] bg-white text-gray-800"}
              `}
            />

            {/* char counter */}
            <div className="flex justify-end mt-1">
              <span className="text-[11px] text-gray-400">
                {maxLength
                  ? `${draft.length} / ${maxLength}`
                  : `${draft.length} chars`}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 px-4 py-3 border-t bg-gray-50">
            <button
              type="button"
              onClick={handleCancel}
              className="h-8 px-4 rounded-sm border border-gray-300 text-[13px] text-gray-700 hover:bg-gray-100 transition"
            >
              Cancel
            </button>
            {!disabled && (
              <button
                type="button"
                onClick={handleSave}
                className="h-8 px-4 rounded-sm border border-[#d97a2b] bg-[#f4b183] text-black text-[13px] font-medium hover:bg-[#eea36e] transition flex items-center gap-1.5"
              >
                <Check size={13} /> Save
              </button>
            )}
          </div>

        </DialogContent>
      </Dialog>
    </>
  );
}
