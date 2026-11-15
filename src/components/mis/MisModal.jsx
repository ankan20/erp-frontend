"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { avatarBg, initials } from "@/lib/misFollowups";

/** Centered modal in the ERP style. role=dialog + data-state=open so the shortcut engine scopes to it. */
export function MisModal({ open, title, onClose, children, footer, maxWidth = "max-w-lg", onSubmit }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!open) return null;
  const Body = onSubmit ? "form" : "div";
  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9996] flex items-start justify-center p-4 overflow-y-auto"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
      role="dialog" data-state="open" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}
    >
      <Body
        onSubmit={onSubmit ? (e) => { e.preventDefault(); onSubmit(e); } : undefined}
        className={`bg-white rounded-xl border border-gray-200 shadow-xl w-full ${maxWidth} my-8 flex flex-col`}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-800">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close"
            className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3">{children}</div>
        {footer && <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50 rounded-b-xl">{footer}</div>}
      </Body>
    </div>
  );
}

export function Field({ label, required, children, className = "" }) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

export const inputCls =
  "w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50";

export const btnPrimary =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60";
export const btnSecondary =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2 text-sm rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-60";

export function UserAvatar({ id, name, size = 28, ring = false, title }) {
  return (
    <span
      title={title ?? name}
      className={`inline-flex items-center justify-center rounded-full text-white font-semibold shrink-0 ${avatarBg(id)} ${ring ? "ring-2 ring-white" : ""}`}
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.38)) }}
    >
      {initials(name)}
    </span>
  );
}
