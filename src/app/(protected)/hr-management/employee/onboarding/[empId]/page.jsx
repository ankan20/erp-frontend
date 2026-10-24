"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import HeaderWrapper from "@/components/layout/HeaderWrapper";
import PageHeader from "@/components/layout/PageHeader";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { toast } from "sonner";

const STATUS_STYLES = {
  Done: "bg-emerald-100 text-emerald-700 border-emerald-200",
  Pending: "bg-gray-100 text-gray-500 border-gray-200",
  NA: "bg-yellow-50 text-yellow-600 border-yellow-200",
};

const STATUSES = ["Pending", "Done", "NA"];

function TaskRow({ task, onUpdate }) {
  const [updating, setUpdating] = useState(false);

  const cycle = async () => {
    const next = STATUSES[(STATUSES.indexOf(task.status) + 1) % STATUSES.length];
    setUpdating(true);
    const res = await apiRequest({
      url: `${API_ENDPOINTS.HR.ONBOARDING.UPDATE_TASK}${task.id}`,
      method: "PUT",
      data: { status: next },
    });
    setUpdating(false);
    if (res?.data) onUpdate(task.id, res.data);
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-0">
      <div className="flex items-center gap-3">
        <button
          onClick={cycle}
          disabled={updating}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            task.status === "Done"
              ? "bg-emerald-500 border-emerald-500"
              : task.status === "NA"
              ? "bg-yellow-300 border-yellow-300"
              : "border-gray-300"
          }`}
        >
          {task.status === "Done" && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          {task.status === "NA" && <span className="text-white text-[8px] font-bold">N</span>}
        </button>
        <span className={`text-sm ${task.status === "Done" ? "line-through text-gray-400" : "text-gray-700"}`}>
          {task.task_name}
        </span>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[task.status]}`}>
        {task.status}
      </span>
    </div>
  );
}

export default function OnboardingChecklistPage() {
  const { empId } = useParams();
  const router = useRouter();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    const res = await apiRequest({
      url: `${API_ENDPOINTS.HR.ONBOARDING.GET_BY_EMP}${empId}`,
      method: "GET",
    });
    if (res?.data) setData(res.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [empId]);

  const handleTaskUpdate = (taskId, updated) => {
    setData((prev) => {
      if (!prev) return prev;
      const categories = { ...prev.categories };
      for (const cat in categories) {
        categories[cat] = categories[cat].map((t) =>
          t.id === taskId ? { ...t, ...updated } : t
        );
      }
      const allTasks = Object.values(categories).flat();
      const done = allTasks.filter((t) => t.status === "Done").length;
      return {
        ...prev,
        categories,
        summary: {
          ...prev.summary,
          done,
          progress_pct: Math.round((done / prev.summary.total) * 100),
        },
      };
    });
  };

  if (loading || !data) {
    return (
      <HeaderWrapper>
        <PageHeader />
        <div className="flex items-center justify-center py-24 text-gray-500">Loading...</div>
      </HeaderWrapper>
    );
  }

  const { employee, categories, summary } = data;
  const progressColor =
    summary.progress_pct === 100
      ? "bg-emerald-500"
      : summary.progress_pct >= 50
      ? "bg-blue-600"
      : "bg-yellow-400";

  return (
    <HeaderWrapper>
      <PageHeader />
      <div className="p-4 space-y-4">
        {/* Employee header */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-5">
          <div className="w-14 h-14 rounded-full bg-blue-700 text-white flex items-center justify-center text-xl font-bold flex-shrink-0">
            {employee.full_name?.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900">{employee.full_name}</h2>
            <p className="text-sm text-gray-500">{employee.designation} · {employee.department}</p>
            <p className="text-xs text-gray-400 mt-0.5">{employee.emp_code} · Joined {employee.date_of_joining || "—"}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-2xl font-bold text-blue-700">{summary.progress_pct}%</p>
            <p className="text-xs text-gray-500">{summary.done}/{summary.total} tasks done</p>
          </div>
        </div>

        {/* Overall progress bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span className="font-medium">Overall Onboarding Progress</span>
            <span>{summary.progress_pct}% complete</span>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${progressColor}`}
              style={{ width: `${summary.progress_pct}%` }}
            />
          </div>
        </div>

        {/* Checklist by category */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Object.entries(categories).map(([category, tasks]) => {
            const catDone = tasks.filter((t) => t.status === "Done").length;
            return (
              <div key={category} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                  <span className="text-sm font-semibold text-gray-700">{category}</span>
                  <span className="text-xs text-gray-500">{catDone}/{tasks.length}</span>
                </div>
                <div>
                  {tasks.map((task) => (
                    <TaskRow key={task.id} task={task} onUpdate={handleTaskUpdate} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Click on a task's checkbox to cycle: Pending → Done → NA
        </p>
      </div>
    </HeaderWrapper>
  );
}
