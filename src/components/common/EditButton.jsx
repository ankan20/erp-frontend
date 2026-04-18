"use client";

export default function EditButton({ onClick, children = "Edit", className = "" }) {
  return (
    <button
      onClick={onClick}
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
        cursor-pointer
        ${className}
      `}
    >
      {children}
    </button>
  );
}