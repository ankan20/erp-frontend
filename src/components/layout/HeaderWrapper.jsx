"use client";

export default function HeaderWrapper({
  header,
  children,
}) {
  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* HEADER */}
      <div className="shrink-0">
        {header}
      </div>

      {/* BODY */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {children}
      </div>

    </div>
  );
}