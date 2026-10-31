"use client";

import { useEffect, useMemo } from "react";
import { X, FileText, Film, Music } from "lucide-react";
import { formatBytes, mediaKind } from "./chatMedia";

// Shows a picked file before it is sent, with a remove button.
export default function AttachmentPreview({ file, onRemove }) {
  const kind  = mediaKind(file?.name);
  const thumb = useMemo(() => (file && kind === "image" ? URL.createObjectURL(file) : null), [file, kind]);

  useEffect(() => () => { if (thumb) URL.revokeObjectURL(thumb); }, [thumb]);

  if (!file) return null;
  const Icon = kind === "video" ? Film : kind === "audio" ? Music : FileText;

  return (
    <div className="flex items-center gap-2 p-2 rounded-xl bg-gray-50 border border-gray-200">
      {thumb
        ? <img src={thumb} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
        : <div className="w-12 h-12 rounded-lg bg-[#d6e6f2] flex items-center justify-center text-[#003b8e] shrink-0"><Icon size={20} /></div>}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{file.name}</p>
        <p className="text-[10px] text-gray-400">{formatBytes(file.size)}</p>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} title="Remove"
          className="p-1 rounded-full hover:bg-gray-200 text-gray-500 shrink-0">
          <X size={14} />
        </button>
      )}
    </div>
  );
}
