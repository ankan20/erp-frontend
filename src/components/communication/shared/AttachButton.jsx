"use client";

import { useRef } from "react";
import { Paperclip } from "lucide-react";
import { MEDIA_ACCEPT, validateChatFile } from "./chatMedia";

// Paperclip button that opens the file picker and hands back one validated file.
// <AttachButton onPick={setFile} onError={toast.error} />
export default function AttachButton({ onPick, onError, disabled, accept = MEDIA_ACCEPT, className = "", title = "Attach file" }) {
  const inputRef = useRef(null);

  const onChange = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const err = validateChatFile(file);
    if (err) { onError?.(err); return; }
    onPick?.(file);
  };

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={onChange} />
      <button type="button" title={title} disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className={`w-9 h-9 rounded-full flex items-center justify-center text-gray-500
          hover:bg-gray-100 hover:text-[#003b8e] transition disabled:opacity-40 shrink-0 ${className}`}>
        <Paperclip size={17} />
      </button>
    </>
  );
}
