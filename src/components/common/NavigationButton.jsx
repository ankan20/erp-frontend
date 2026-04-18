"use client";

export default function NavigationButton({ children, onClick, className = "" }) {
  return (
    <button
      onClick={onClick}
      className={`
        h-7
        px-5
        min-w-30
        text-md
        border
        rounded-sm
        bg-[#7fc3d4]
        border-[#4d8ea3]
        text-black
        hover:bg-[#6bb3c6]
        transition
        cursor-pointer
        text-center
        ${className}
      `}
    >
      {children}
    </button>
  );
}