"use client";

import { useEffect, useRef, useState } from "react";
import {
  UploadCloud,
  Download,
  X,
  FileText,
  FileSpreadsheet,
  ImageIcon,
  CheckCircle2,
  Paperclip,
} from "lucide-react";
import { toast } from "sonner";

// ─── helpers ────────────────────────────────────────────────────────────────

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
  doc:  "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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

function resolveFileMeta(mimeType) {
  if (!mimeType) {
    return { badge: "FILE", badgeClass: "bg-gray-400", Icon: FileText, iconClass: "text-gray-400" };
  }
  if (mimeType === "application/pdf") {
    return { badge: "PDF", badgeClass: "bg-red-500", Icon: FileText, iconClass: "text-red-500" };
  }
  if (
    mimeType === "application/vnd.ms-excel" ||
    mimeType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    const badge = mimeType.includes("openxmlformats") ? "XLSX" : "XLS";
    return { badge, badgeClass: "bg-green-600", Icon: FileSpreadsheet, iconClass: "text-green-600" };
  }
  if (mimeType.startsWith("image/")) {
    const ext = mimeType.split("/")[1]?.toUpperCase() ?? "IMG";
    return { badge: ext, badgeClass: "bg-violet-500", Icon: ImageIcon, iconClass: "text-violet-500" };
  }
  return { badge: "FILE", badgeClass: "bg-gray-400", Icon: FileText, iconClass: "text-gray-400" };
}

function formatHintFromAccept(accept) {
  const labelMap = {
    ".pdf":  "PDF",
    ".xls":  "Excel",
    ".xlsx": "Excel",
    ".doc":  "Word",
    ".docx": "Word",
    ".jpg":  "JPG",
    ".jpeg": "JPG",
    ".png":  "PNG",
    ".webp": "WebP",
    ".gif":  "GIF",
  };
  const seen   = new Set();
  const labels = [];
  accept.split(",").forEach((ext) => {
    const lbl = labelMap[ext.trim().toLowerCase()];
    if (lbl && !seen.has(lbl)) { seen.add(lbl); labels.push(lbl); }
  });
  return labels.join(", ");
}

// ─── exports ─────────────────────────────────────────────────────────────────

export const ACCEPT_ALL   = ".pdf,.xls,.xlsx,.jpg,.jpeg,.png,.webp,.gif";
export const ACCEPT_DOC   = ".pdf,.xls,.xlsx,.jpg,.jpeg,.png";
export const ACCEPT_PDF   = ".pdf";
export const ACCEPT_IMAGE = ".jpg,.jpeg,.png,.webp,.gif";

export const TYPES_ALL = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
];

export const TYPES_DOC = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];

export const TYPES_PDF = ["application/pdf"];

// ─── component ────────────────────────────────────────────────────────────────

export default function FileUpload({
  // `title` is the preferred prop; `label` is kept as a legacy alias.
  title,
  label     = "Upload File",
  showLabel = true,

  onChange,
  existingUrl    = "",
  onClearExisting,
  disabled       = false,
  resetKey       = 0,

  accept       = ACCEPT_ALL,
  allowedTypes = TYPES_ALL,
  maxSize      = 10 * 1024 * 1024, // 10 MB default

  required         = false,
  showImagePreview = false,
  className        = "",
}) {
  const fileRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  const [previewUrl,   setPreviewUrl]   = useState("");
  const [isDragging,   setIsDragging]   = useState(false);

  const heading = title ?? label;

  // ── derived-state reset when parent increments resetKey ─────────────────
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setSelectedFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
  }

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  // ── file processing ──────────────────────────────────────────────────────
  const processFile = (file) => {
    if (!file) return;

    if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
      toast.error(`File type not allowed. Accepted: ${formatHintFromAccept(accept)}`);
      return;
    }

    if (maxSize && file.size > maxSize) {
      toast.error(
        `"${file.name}" is ${formatBytes(file.size)} — exceeds the ${formatBytes(maxSize)} limit.`,
        { duration: 5000 },
      );
      return;
    }

    const oldPreview = previewUrl;
    let   newPreview = "";
    if (showImagePreview && file.type.startsWith("image/")) {
      newPreview = URL.createObjectURL(file);
    }
    if (oldPreview) URL.revokeObjectURL(oldPreview);

    setPreviewUrl(newPreview);
    setSelectedFile(file);
    onChange?.(file);
    onClearExisting?.();
  };

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    if (fileRef.current) fileRef.current.value = "";
    processFile(file);
  };

  const handleRemoveNew = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
    onChange?.(null);
  };

  const openPicker = () => {
    if (disabled) return;
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current?.click();
  };

  // ── drag handlers ────────────────────────────────────────────────────────
  const onDragOver  = (e) => { e.preventDefault(); if (!disabled) setIsDragging(true); };
  const onDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const onDrop      = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    processFile(e.dataTransfer.files?.[0]);
  };

  // ── display flags ────────────────────────────────────────────────────────
  const showNew      = !!selectedFile;
  const showExisting = !selectedFile && !!existingUrl;
  const showNoFile   = !selectedFile && !existingUrl && disabled;

  const existingMime    = mimeFromUrl(existingUrl);
  const existingIsImage = existingMime.startsWith("image/");
  const existingName    = nameFromUrl(existingUrl);

  const newMeta      = selectedFile ? resolveFileMeta(selectedFile.type) : null;
  const existingMeta = resolveFileMeta(existingMime);

  const formatHint = formatHintFromAccept(accept);
  const sizeHint   = maxSize ? `up to ${formatBytes(maxSize)}` : null;
  const zoneHint   = [formatHint, sizeHint].filter(Boolean).join(" • ");

  return (
    <div className={`w-full rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden ${className}`}>

      {/* ── Card header — shown by default; set showLabel={false} if the page supplies its own heading */}
      {showLabel && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
          <div className="flex items-center justify-center w-6 h-6 rounded-md bg-violet-100 shrink-0">
            <Paperclip className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <span className="text-[13px] font-semibold text-gray-700 truncate">{heading}</span>
          {required && !selectedFile && !existingUrl && !disabled && (
            <span className="ml-auto text-[10px] text-red-500 font-semibold shrink-0">* Required</span>
          )}
        </div>
      )}

      {/* ── Card body */}
      <div className="p-2.5 space-y-2">

        {/* Drop zone — edit mode */}
        {!disabled && (
          <div
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onClick={openPicker}
            className={[
              "w-full rounded-lg border-2 border-dashed cursor-pointer transition-all duration-150 select-none",
              isDragging
                ? "border-violet-400 bg-violet-50 scale-[0.995]"
                : "border-gray-200 bg-gray-50/60 hover:border-gray-300 hover:bg-gray-50",
            ].join(" ")}
          >
            <div className="flex flex-col items-center justify-center py-4 px-4 text-center gap-0.5">
              <div className={[
                "mb-1 flex items-center justify-center w-8 h-8 rounded-full transition-colors",
                isDragging ? "bg-violet-100" : "bg-white border border-gray-200 shadow-sm",
              ].join(" ")}>
                <UploadCloud className={`w-4 h-4 ${isDragging ? "text-violet-500" : "text-gray-400"}`} />
              </div>

              <p className="text-[12px] font-semibold text-gray-600">
                {isDragging ? "Drop the file here" : "Choose a file or drag & drop it here"}
              </p>

              {zoneHint && (
                <p className="text-[11px] text-gray-400">{zoneHint}</p>
              )}

              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openPicker(); }}
                className="mt-2 px-4 py-1 rounded-lg border border-gray-300 bg-white text-[11px] font-semibold text-gray-600 shadow-sm hover:bg-gray-50 hover:border-gray-400 active:scale-[0.97] transition-all"
              >
                Browse File
              </button>
            </div>
          </div>
        )}

        {/* Hidden input — key=resetKey remounts the element to clear DOM value */}
        <input
          key={resetKey}
          ref={fileRef}
          type="file"
          hidden
          accept={accept}
          onChange={handleInputChange}
        />

        {/* New file card */}
        {showNew && (
          <FileCard
            meta={newMeta}
            name={selectedFile.name}
            size={selectedFile.size}
            maxSize={maxSize}
            status="ready"
            onRemove={!disabled ? handleRemoveNew : null}
          />
        )}

        {/* Existing (saved) file card */}
        {showExisting && (
          <FileCard
            meta={existingMeta}
            name={existingName || "Saved file"}
            status="saved"
            downloadUrl={existingUrl}
            onRemove={!disabled ? () => onClearExisting?.() : null}
          />
        )}

        {/* Image previews */}
        {showImagePreview && showNew && previewUrl && (
          <img
            src={previewUrl}
            alt="preview"
            className="max-h-[160px] max-w-full rounded-lg border border-gray-200 object-contain"
          />
        )}
        {showImagePreview && showExisting && existingIsImage && (
          <img
            src={existingUrl}
            alt="saved"
            className="max-h-[160px] max-w-full rounded-lg border border-gray-200 object-contain"
          />
        )}

        {/* No file — view-only with nothing attached */}
        {showNoFile && (
          <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg border border-dashed border-gray-200">
            <FileText className="w-4 h-4 text-gray-300 shrink-0" />
            <span className="text-[12px] italic text-gray-400">No file attached</span>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── FileCard ─────────────────────────────────────────────────────────────────

function FileCard({ meta, name, size, maxSize, status, downloadUrl, onRemove }) {
  const isSaved = status === "saved";

  return (
    <div className={[
      "flex items-center gap-2.5 p-2 rounded-xl border transition-colors",
      isSaved
        ? "border-blue-100 bg-blue-50/40"
        : "border-gray-200 bg-white shadow-sm",
    ].join(" ")}>

      {/* File type badge block */}
      <div className="shrink-0 flex flex-col items-center justify-center w-9 h-[44px] rounded-lg bg-white border border-gray-100 shadow-sm overflow-hidden gap-0.5 py-1">
        <meta.Icon className={`w-4 h-4 ${meta.iconClass}`} />
        <span className={`px-1 py-0.5 rounded text-[8px] font-bold text-white leading-none ${meta.badgeClass}`}>
          {meta.badge}
        </span>
      </div>

      {/* Name + size / status */}
      <div className="flex flex-col min-w-0 flex-1 gap-0.5">
        <span
          className="text-[13px] font-medium text-gray-800 leading-snug truncate"
          title={name}
        >
          {name}
        </span>
        <div className="flex items-center gap-1.5 text-[11px] text-gray-400 flex-wrap">
          {size != null && (
            <>
              <span>{formatBytes(size)}</span>
              {maxSize && (
                <>
                  <span className="text-gray-300">of</span>
                  <span>{formatBytes(maxSize)}</span>
                </>
              )}
              <span className="text-gray-200">•</span>
            </>
          )}
          {isSaved ? (
            <span className="inline-flex items-center gap-0.5 text-blue-400 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Saved
            </span>
          ) : (
            <span className="inline-flex items-center gap-0.5 text-green-500 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Ready
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="shrink-0 flex items-center">
        {downloadUrl && (
          <a
            href={downloadUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
            title="Download file"
            aria-label="Download file"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
            aria-label="Remove file"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
