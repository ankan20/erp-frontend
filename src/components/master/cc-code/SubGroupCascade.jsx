"use client";

import { useEffect, useRef, useState } from "react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";

const LEVEL_LABELS = ["Sub Group", "Sub Group 1", "Sub Group 2"];

const fetchSubGroups = async (params) => {
  const res = await apiRequest({
    url: API_ENDPOINTS.MASTER.GET_ALL_SUB_GROUP,
    params: { ...params, status: "Active" },
  });
  return res?.data || [];
};

/**
 * Group -> Sub Group -> Sub Group 1 -> Sub Group 2 (each level optional).
 * path = selected ids from top to bottom, e.g. [4, 9, 15].
 * The next level is shown only when the selected one has children.
 */
export default function SubGroupCascade({
  groupId,
  path = [],
  onChange,
  disabled = false,
  labelClassName = "",
  selectClassName = "",
}) {
  // options[i] = choices for level i
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const pathKey = path.join(",");

  useEffect(() => {
    const myId = ++requestId.current;
    const load = async () => {
      if (!groupId) {
        setOptions([]);
        return;
      }
      try {
        setLoading(true);
        const levels = [await fetchSubGroups({ groupId, parentId: "root" })];
        for (const id of path) {
          const picked = levels[levels.length - 1].find((o) => o.subGroupId === id);
          if (!picked || !picked.hasChildren || !picked.canHaveChildren) break;
          levels.push(await fetchSubGroups({ parentId: id }));
        }
        if (myId === requestId.current) setOptions(levels);
      } catch {
        if (myId === requestId.current) {
          setOptions([]);
          toast.error("Failed to load sub groups");
        }
      } finally {
        if (myId === requestId.current) setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId, pathKey]);

  const handleSelect = (level, value) => {
    const next = path.slice(0, level);
    if (value) next.push(Number(value));
    onChange(next);
  };

  // Always show the first level; deeper levels only when they have choices
  const levelsToShow = Math.max(1, options.length);

  return (
    <>
      {Array.from({ length: levelsToShow }).map((_, level) => {
        const list = options[level] || [];
        const placeholder = !groupId
          ? "Select Group first"
          : loading && list.length === 0
          ? "Loading..."
          : list.length === 0
          ? "No sub group for this group"
          : "Select (optional)";
        return (
          <div className="flex flex-col" key={level}>
            <div className="flex gap-2">
              <div className={labelClassName}>{LEVEL_LABELS[level] || `Sub Group ${level}`}</div>
              <select
                value={path[level] ? String(path[level]) : ""}
                onChange={(e) => handleSelect(level, e.target.value)}
                disabled={disabled || !groupId || list.length === 0}
                className={selectClassName}
              >
                <option value="">{placeholder}</option>
                {list.map((sg) => (
                  <option key={sg.subGroupId} value={String(sg.subGroupId)}>
                    {sg.subGroupName} ({sg.subGroupCode})
                  </option>
                ))}
              </select>
            </div>
          </div>
        );
      })}
    </>
  );
}
