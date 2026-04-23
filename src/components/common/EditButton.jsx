"use client";

import { Loader2 } from "lucide-react";

export default function EditButton({
  onClick,
  children = "Edit",
  className = "",
  loading = false,
  disabled = false,
}) {
  const isDisabled = loading || disabled;

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`
        h-8.5
        min-w-30
        px-4
        rounded-md
        border
        border-[#6b8fb3]
        bg-[#9dc3e6]
        text-black
        text-md
        font-medium
        hover:bg-[#85aed4]
        transition
        flex items-center justify-center gap-2
        ${isDisabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? "Processing..." : children}
    </button>
  );
}