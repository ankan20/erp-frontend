"use client";

import { Loader2 } from "lucide-react";

export default function SaveButton({
  onClick,
  children = "Save",
  className = "",
  loading = false,
  disabled= true,
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
        border-[#d97a2b]
        bg-[#f4b183]
        text-black
        text-md
        font-medium
        hover:bg-[#eea36e]
        transition
        flex items-center justify-center gap-2
        ${isDisabled ? "opacity-70 cursor-not-allowed" : "cursor-pointer"}
        ${className}
      `}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {loading ? "Saving..." : children}
    </button>
  );
}