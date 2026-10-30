"use client";

const STATUS_CONFIG = {
  active:         { label: "Active",         cls: "bg-emerald-100 text-emerald-700" },
  in_maintenance: { label: "In Maintenance", cls: "bg-amber-100 text-amber-700" },
  transferred:    { label: "Transferred",    cls: "bg-blue-100 text-blue-700" },
  disposed:       { label: "Disposed",       cls: "bg-red-100 text-red-600" },
  inactive:       { label: "Inactive",       cls: "bg-gray-100 text-gray-500" },
};

export default function AssetStatusBadge({ status }) {
  if (!status) return <span className="text-gray-400">—</span>;
  const config = STATUS_CONFIG[status] || { label: status, cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${config.cls}`}>
      {config.label}
    </span>
  );
}
