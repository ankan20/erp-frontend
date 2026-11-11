// A key cap: <Kbd combo="Ctrl+S" /> renders [Ctrl] + [S]
export default function Kbd({ combo, className = "" }) {
  const parts = String(combo).split("+").map((p) => (p === "ArrowLeft" ? "←" : p));
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap align-middle ${className}`}>
      {parts.map((part, i) => (
        <span key={i} className="inline-flex items-center gap-0.5">
          {i > 0 && <span className="text-[10px] text-gray-500">+</span>}
          <kbd className="inline-flex h-[20px] min-w-[20px] items-center justify-center rounded-[4px] border border-[#9fb3c8] border-b-2 bg-white px-1.5 font-mono text-[11px] font-semibold leading-none text-[#144664]">
            {part}
          </kbd>
        </span>
      ))}
    </span>
  );
}
