"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { getLocalStorage } from "@/lib/localStorage";

export default function useAccountingFetch(endpoint) {
  const defaultProject = getLocalStorage("projectInfo")?.projectCode || "";

  const [projectCode, setProjectCode] = useState(defaultProject);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);
  const [projectList, setProjectList] = useState([]);
  const [extraParams, setExtraParams] = useState({});

  useEffect(() => {
    apiRequest({ url: API_ENDPOINTS.SETTINGS.GET_ALL_PROJECTS, method: "GET" })
      .then((res) => setProjectList(res?.data || []))
      .catch(() => {});
  }, []);

  const handleFetch = useCallback(
    async (overrideParams) => {
      if (fromDate && toDate && fromDate > toDate) {
        toast.error("From date cannot be after To date");
        return;
      }
      setLoading(true);
      setFetched(false);
      try {
        const params = new URLSearchParams();
        if (projectCode) params.set("project_code", projectCode);
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        const merged = { ...extraParams, ...overrideParams };
        Object.entries(merged).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== "") params.set(k, v);
        });
        const qs = params.toString();
        const res = await apiRequest({
          url: `${endpoint}${qs ? `?${qs}` : ""}`,
          method: "GET",
        });
        setData(res?.data ?? null);
        setFetched(true);
      } catch (err) {
        setData(null);
        toast.error(err?.message || "Failed to fetch data");
      } finally {
        setLoading(false);
      }
    },
    [endpoint, projectCode, fromDate, toDate, extraParams],
  );

  const handleReset = useCallback(() => {
    setProjectCode(defaultProject);
    setFromDate("");
    setToDate("");
    setData(null);
    setFetched(false);
    setExtraParams({});
  }, [defaultProject]);

  const handleExport = useCallback(
    async (exportEndpoint, format = "pdf") => {
      try {
        const params = new URLSearchParams();
        if (projectCode) params.set("project_code", projectCode);
        if (fromDate) params.set("from_date", fromDate);
        if (toDate) params.set("to_date", toDate);
        params.set("format", format);
        const qs = params.toString();
        const res = await apiRequest({
          url: `${exportEndpoint}${qs ? `?${qs}` : ""}`,
          method: "GET",
          responseType: "blob",
        });
        if (res instanceof Blob) {
          const url = URL.createObjectURL(res);
          const a = document.createElement("a");
          a.href = url;
          a.download = `report.${format}`;
          a.click();
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        toast.error(err?.message || `Failed to export ${format.toUpperCase()}`);
      }
    },
    [projectCode, fromDate, toDate],
  );

  return {
    projectCode,
    setProjectCode,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    data,
    loading,
    fetched,
    projectList,
    extraParams,
    setExtraParams,
    handleFetch,
    handleReset,
    handleExport,
  };
}
