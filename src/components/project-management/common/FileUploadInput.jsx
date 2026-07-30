"use client";

import { useRef, useState } from "react";
import { Paperclip, Download, X } from "lucide-react";
import { toast } from "sonner";

const DEFAULT_ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/jpeg",
  "image/png",
];

/**
 * Controlled file upload input for project-management modules.
 *
 * Behaviour:
 * - Shows selected file name once a file is picked.
 * - Shows a download link when `existingFileUrl` is set and no new file is selected.
 * - Opening the picker and cancelling without selecting clears any previously shown name.
 * - Parent resets state by incrementing `resetKey` (clears internal selection)
 *   and restoring `existingFileUrl` to its saved value.
 *
 * Props:
 *  disabled        – disables the trigger button
 *  label           – button label (default "Attachment")
 *  existingFileUrl – URL of a previously saved file (parent-controlled)
 *  onFileChange    – (file: File | null) => void  — called on every change
 *  onClearExisting – () => void  — called when user picks a new file (parent should clear existingFileUrl)
 *  resetKey        – number that increments whenever parent wants to reset (e.g. form cancel)
 *  accept          – input accept string
 *  allowedTypes    – array of MIME types for client-side validation
 */
export default function FileUploadInput({
  disabled = false,
  label = "Attachment",
  showLabel = true,
  existingFileUrl = "",
  onFileChange,
  onClearExisting,
  resetKey = 0,
  accept = ".pdf,.xls,.xlsx,.jpg,.jpeg,.png",
  allowedTypes = DEFAULT_ALLOWED_TYPES,
  className = "",
}) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  const fileRef = useRef(null);

  // Derived-state reset: calling setState during render is React's recommended pattern
  // for adjusting state when a prop changes (avoids cascading effect renders).
  // The hidden input DOM value is cleared via key={resetKey} below.
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setSelectedFile(null);
  }

  const handleTrigger = () => {
    // Clear existing selection before opening dialog.
    // If user cancels the dialog, selectedFile stays null (no onChange fires).
    setSelectedFile(null);
    onFileChange?.(null);
    if (fileRef.current) fileRef.current.value = "";
    fileRef.current?.click();
  };

  const handleChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDF, Excel, JPG or PNG files are allowed");
      if (fileRef.current) fileRef.current.value = "";
      return;
    }

    setSelectedFile(file);
    onFileChange?.(file);
    onClearExisting?.();
  };

  const handleRemoveSelected = () => {
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
    onFileChange?.(null);
  };

  const showDownload = !selectedFile && !!existingFileUrl;
  const showNoFile   = !selectedFile && !existingFileUrl && disabled;

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {/* Purple "Attachment" label — shown only in standalone usage */}
      {showLabel && (
        <button
          type="button"
          className="py-1 px-3.5 rounded-md border border-[#7b68c8] bg-[#b8b3ff] text-[#1f1f1f] text-[14px] font-medium shadow-sm select-none whitespace-nowrap"
        >
          {label}
        </button>
      )}

      {/* Yellow "@" trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={handleTrigger}
        className="py-1 w-[42px] flex items-center justify-center rounded-md border border-[#c96b2c] bg-[#f3d27c] text-[16px] font-bold text-[#1f1f1f] shadow-sm disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed transition hover:bg-[#ebbe60]"
      >
        @
      </button>

      {/* Hidden file input */}
      <input
        key={resetKey}
        ref={fileRef}
        type="file"
        hidden
        accept={accept}
        onChange={handleChange}
      />

      {/* Newly selected file */}
      {selectedFile && (
        <span className="flex items-center gap-1.5 text-[12px] text-gray-700 min-w-0">
          <Paperclip className="w-3 h-3 text-orange-500 shrink-0" />
          <span className="truncate max-w-[200px] sm:max-w-xs">{selectedFile.name}</span>
          {!disabled && (
            <button
              type="button"
              onClick={handleRemoveSelected}
              className="shrink-0 text-gray-400 hover:text-red-500 transition"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </span>
      )}

      {/* Existing file download */}
      {showDownload && (
        <a
          href={existingFileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[12px] text-blue-600 hover:underline"
        >
          <Download className="w-3.5 h-3.5 shrink-0" />
          <span>Download Attachment</span>
        </a>
      )}

      {/* No file in locked / view state */}
      {showNoFile && (
        <span className="text-[12px] italic text-gray-400">No attachment</span>
      )}
    </div>
  );
}
