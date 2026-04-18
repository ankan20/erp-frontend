"use client";

export default function SaveButton({ onClick, children = "Save", className = "" }) {
  return (
    <button
      onClick={onClick}
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
        cursor-pointer
        ${className}
      `}
    >
      {children}
    </button>
  );
}