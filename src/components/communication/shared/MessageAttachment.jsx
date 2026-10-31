"use client";

import { Download, FileText } from "lucide-react";
import { formatBytes } from "./chatMedia";

// Renders the media part of a chat message. type: image | video | audio | file
// onLoad fires once an image/video knows its size (useful for keeping a chat scrolled to the bottom)
export default function MessageAttachment({ type, url, name, size, mine = false, onLoad }) {
  if (!url) return null;

  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img src={url} alt={name || "image"} onLoad={onLoad}
          className="rounded-lg max-w-[220px] max-h-[240px] object-cover bg-gray-100" />
      </a>
    );
  }
  if (type === "video") {
    return <video src={url} controls preload="metadata" onLoadedMetadata={onLoad}
      className="rounded-lg max-w-[220px] max-h-[240px] bg-black" />;
  }
  if (type === "audio") {
    return <audio src={url} controls preload="metadata" className="max-w-[220px] h-9" />;
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer" download={name || true}
      className={`flex items-center gap-2 rounded-lg px-2 py-1.5 max-w-[220px]
        ${mine ? "bg-white/15 hover:bg-white/25" : "bg-gray-100 hover:bg-gray-200"} transition`}>
      <FileText size={20} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{name || "File"}</p>
        {size ? <p className={`text-[10px] ${mine ? "text-blue-100" : "text-gray-500"}`}>{formatBytes(size)}</p> : null}
      </div>
      <Download size={14} className="shrink-0 opacity-70" />
    </a>
  );
}
