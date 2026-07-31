"use client";

import { useRef, useState } from "react";
import { Download, X, FileText, FileSpreadsheet, ImageIcon, Paperclip } from "lucide-react";
import { toast } from "sonner";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const EXT_MIME = {
  pdf:  "application/pdf",
  xls:  "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  jpg:  "image/jpeg",
  jpeg: "image/jpeg",
  png:  "image/png",
  webp: "image/webp",
  gif:  "image/gif",
};

function mimeFromUrl(url) {
  if (!url) return "";
  const ext = url.split("?")[0].split(".").pop()?.toLowerCase();
  return EXT_MIME[ext] ?? "";
}

function nameFromUrl(url) {
  if (!url) return "";
  return decodeURIComponent(url.split("?")[0].split("/").pop() ?? "");
}

function resolveIcon(mimeType) {
  if (!mimeType) return { Icon: FileText, cls: "text-gray-400" };
  if (mimeType === "application/pdf") return { Icon: FileText, cls: "text-red-500" };
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) return { Icon: FileSpreadsheet, cls: "text-green-600" };
  if (mimeType.startsWith("image/")) return { Icon: ImageIcon, cls: "text-violet-500" };
  return { Icon: FileText, cls: "text-gray-400" };
}

// ─── exports (presets — same as FileUpload so pages can share them) ───────────

export const ACCEPT_ALL   = ".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif";
export const ACCEPT_DOC   = ".pdf,.xls,.xlsx,.jpg,.jpeg,.png";
export const ACCEPT_PDF   = ".pdf";
export const ACCEPT_IMAGE = ".jpg,.jpeg,.png,.webp,.gif";

export const TYPES_ALL = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg", "image/png", "image/webp", "image/gif",
];
export const TYPES_DOC = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg", "image/png",
];
export const TYPES_PDF = ["application/pdf"];

// ─── component ────────────────────────────────────────────────────────────────

/**
 * FileUploadInline — compact single-row file widget for use inside form field rows.
 *
 * Renders as: [label badge] [@ button] [file chip / download link / no-file text]
 * Does NOT take full width — designed to sit alongside a text input in a flex row.
 *
 * Props mirror FileUpload for consistency:
 *   label, onChange, existingUrl, onClearExisting, disabled, resetKey,
 *   accept, allowedTypes, maxSize, className
 */
export default function FileUploadInline({
  label          = "File",
  onChange,
  existingUrl    = "",
  onClearExisting,
  disabled       = false,
  resetKey       = 0,
  accept         = ACCEPT_ALL,
  allowedTypes   = TYPES_ALL,
  maxSize,
  className      = "",
  labelClassName = "",
}) {
  const fileRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  // ── derived-state reset ──────────────────────────────────────────────────
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setSelectedFile(null);
  }

  // ── handlers ─────────────────────────────────────────────────────────────
  const openPicker = () => {
    if (disabled) return;
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current?.click();
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    if (!file) return;

    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      toast.error(`File type not allowed for ${label}.`);
      return;
    }
    if (maxSize && file.size > maxSize) {
      toast.error(`"${file.name}" is ${formatBytes(file.size)} — exceeds the ${formatBytes(maxSize)} limit.`, { duration: 5000 });
      return;
    }

    setSelectedFile(file);
    onChange?.(file);
    onClearExisting?.();
  };

  const handleRemove = () => {
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
    onChange?.(null);
  };

  // ── display flags ─────────────────────────────────────────────────────────
  const showNew      = !!selectedFile;
  const showExisting = !selectedFile && !!existingUrl;
  const showNone     = !selectedFile && !existingUrl;

  const existingMime = mimeFromUrl(existingUrl);
  const existingName = nameFromUrl(existingUrl);
  const { Icon: ExIcon, cls: exCls } = resolveIcon(existingMime);
  const { Icon: NewIcon, cls: newCls } = selectedFile
    ? resolveIcon(selectedFile.type)
    : { Icon: FileText, cls: "text-gray-400" };

  return (
    <div className={`inline-flex items-center gap-1.5 flex-wrap ${className}`}>

      {/* ── Label badge */}
      <div className={`inline-flex items-center justify-center shrink-0
                      h-[28px] px-2.5 min-w-[60px]
                      bg-[#c4b9f7] border border-[#7c6fd4] rounded-[4px]
                      text-[11.5px] font-semibold text-[#2d1f6e] select-none ${labelClassName}`}>
        {label}
      </div>

      {/* ── Browse button (edit mode) */}
      {!disabled && (
        <button
          type="button"
          onClick={openPicker}
          title="Attach file"
          className="inline-flex items-center justify-center shrink-0
                     h-[28px] w-[28px]
                     bg-[#ffd966] border border-[#c9a800] rounded-[4px]
                     text-[12px] font-bold hover:bg-[#ffc000] active:scale-95 transition-colors"
        >
          <Paperclip className="w-3.5 h-3.5 text-[#7a5800]" />
        </button>
      )}

      {/* Hidden input */}
      <input
        key={resetKey}
        ref={fileRef}
        type="file"
        hidden
        accept={accept}
        onChange={handleChange}
      />

      {/* ── New file chip */}
      {showNew && (
        <div className="inline-flex items-center gap-1 h-[28px] pl-1.5 pr-1
                        rounded border border-gray-200 bg-gray-50 max-w-[180px]">
          <NewIcon className={`w-3 h-3 shrink-0 ${newCls}`} />
          <span className="text-[11.5px] text-gray-700 truncate flex-1" title={selectedFile.name}>
            {selectedFile.name}
          </span>
          {selectedFile.size > 0 && (
            <span className="text-[10px] text-gray-400 shrink-0 ml-0.5">
              {formatBytes(selectedFile.size)}
            </span>
          )}
          {!disabled && (
            <button
              type="button"
              onClick={handleRemove}
              className="shrink-0 ml-0.5 p-0.5 rounded text-gray-400
                         hover:text-red-500 hover:bg-red-50 transition-colors"
              aria-label="Remove file"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* ── Existing file — download link */}
      {showExisting && (
        <a
          href={existingUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 h-[28px] px-2
                     rounded border border-blue-200 bg-blue-50
                     text-[11.5px] text-blue-700 font-medium
                     hover:bg-blue-100 transition-colors max-w-[180px]"
          title={existingName}
        >
          <ExIcon className={`w-3 h-3 shrink-0 ${exCls}`} />
          <span className="truncate">{existingName || "Download"}</span>
          <Download className="w-3 h-3 shrink-0 ml-0.5 text-blue-500" />
        </a>
      )}

      {/* ── No file */}
      {showNone && (
        <span className="text-[11px] italic text-gray-400 select-none">No file</span>
      )}
    </div>
  );
}
