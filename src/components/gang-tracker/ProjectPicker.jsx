"use client";

import { useEffect, useState } from "react";
import SearchableSelect from "@/components/common/SearchableSelect";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

// Project names = project master + names already used in conversations.
// Loaded once and shared by every picker on the page; refreshGangProjects() after a save.
let cache = null;
let inflight = null;
const subscribers = new Set();

export function refreshGangProjects() {
  inflight = Promise.all([
    apiRequest({ url: API_ENDPOINTS.HR.GANG_TRACKER.THREAD_PROJECTS }).catch(() => null),
    apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS }).catch(() => null),
  ]).then(([used, master]) => {
    const names = new Set(used?.data || []);
    (master?.data || []).forEach((p) => p.projectName && names.add(p.projectName));
    cache = [...names].sort((a, b) => a.localeCompare(b));
    subscribers.forEach((fn) => fn(cache));
    return cache;
  });
  return inflight;
}

export function useGangProjects() {
  const [list, setList] = useState(cache || []);
  useEffect(() => {
    subscribers.add(setList);
    if (!cache && !inflight) refreshGangProjects();
    return () => subscribers.delete(setList);
  }, []);
  return list;
}

/** Pick a project from the list or type a new name — the app's common SearchableSelect in allowCustom mode. */
export default function ProjectPicker({ value, onChange, placeholder = "Pick or type a project", className = "", buttonClassName = "" }) {
  const projects = useGangProjects();
  return (
    <SearchableSelect
      options={projects.map((p) => ({ value: p, label: p }))}
      value={value || ""}
      onChange={(v) => onChange(v || "")}
      placeholder={placeholder}
      searchPlaceholder="Search or type a new project…"
      searchKeys={["label"]}
      allowCustom
      customLabel={(t) => `Use “${t}” as project`}
      clearLabel={value ? "— No project —" : null}
      emptyText="No projects yet — type one"
      className={className}
      buttonClassName={buttonClassName}
    />
  );
}
