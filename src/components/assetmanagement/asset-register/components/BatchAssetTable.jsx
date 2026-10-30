"use client";

import { Trash2 } from "lucide-react";
import AssetStatusBadge from "./AssetStatusBadge";
import { MOCK_LOCATIONS, ASSET_STATUSES } from "../mockData";

export default function BatchAssetTable({ items, onChange, isEditing }) {
  if (!items || items.length === 0) return null;

  const handleChange = (idx, field, value) => {
    const updated = items.map((item, i) =>
      i === idx ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg">
      <table className="w-full min-w-max text-sm table-fixed">
        <thead className="bg-[#144664] text-white">
          <tr>
            <th className="w-[40px] px-2 py-2 text-center font-semibold border-r border-[#2e5a72]">#</th>
            <th className="w-[150px] px-2 py-2 text-left font-semibold border-r border-[#2e5a72]">Sub Asset ID</th>
            <th className="px-2 py-2 text-left font-semibold border-r border-[#2e5a72]">Serial / Tag No</th>
            <th className="w-[200px] px-2 py-2 text-left font-semibold border-r border-[#2e5a72]">Location</th>
            <th className="w-[140px] px-2 py-2 text-center font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className={idx % 2 === 0 ? "bg-[#f9f9f9]" : "bg-white"}>
              <td className="px-2 py-1.5 text-center text-gray-500 border-r border-gray-100">{idx + 1}</td>
              <td className="px-2 py-1.5 border-r border-gray-100">
                <span className="text-blue-700 font-medium text-xs">{item.subId}</span>
              </td>
              <td className="px-2 py-1.5 border-r border-gray-100">
                {isEditing ? (
                  <input
                    value={item.serialNo || ""}
                    onChange={(e) => handleChange(idx, "serialNo", e.target.value)}
                    placeholder="Enter serial / tag no"
                    className="w-full border border-gray-300 rounded px-2 py-0.5 text-sm outline-none focus:border-blue-400"
                  />
                ) : (
                  <span className="text-gray-700">{item.serialNo || "—"}</span>
                )}
              </td>
              <td className="px-2 py-1.5 border-r border-gray-100">
                {isEditing ? (
                  <select
                    value={item.location || ""}
                    onChange={(e) => handleChange(idx, "location", e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-0.5 text-sm outline-none focus:border-blue-400"
                  >
                    <option value="">Select location</option>
                    {MOCK_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-gray-700">{item.location || "—"}</span>
                )}
              </td>
              <td className="px-2 py-1.5 text-center">
                {isEditing ? (
                  <select
                    value={item.status || "active"}
                    onChange={(e) => handleChange(idx, "status", e.target.value)}
                    className="w-full border border-gray-300 rounded px-2 py-0.5 text-sm outline-none focus:border-blue-400"
                  >
                    {ASSET_STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                  </select>
                ) : (
                  <AssetStatusBadge status={item.status} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
