"use client";

/** Navbar button → Reback Requests page, with a count of requests waiting on me. */

import { useEffect, useState, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";
import { subscribeRebackRequest, getRebackRequestState, getServerRebackRequestState } from "@/lib/rebackRequest";

export default function RebackRequestsNavButton({ Tip }) {
  const router = useRouter();
  const pathname = usePathname();
  const [count, setCount] = useState(0);
  const { changes } = useSyncExternalStore(subscribeRebackRequest, getRebackRequestState, getServerRebackRequestState);

  useEffect(() => {
    let cancelled = false;
    apiRequest({ url: API_ENDPOINTS.WORKFLOW.REBACK_REQUEST_COUNT, method: "GET" })
      .then((res) => { if (!cancelled) setCount(Number(res?.data?.count) || 0); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname, changes]);

  const button = (
    <button
      type="button"
      onClick={() => router.push("/reback-requests")}
      aria-label="Reback requests"
      className="relative flex h-7 w-7 cursor-pointer items-center justify-center rounded-sm border border-[#b8c7da] bg-white text-[#144664] hover:bg-[#eef4fa]"
    >
      <RotateCcw size={16} />
      {count > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] rounded-full bg-amber-500 px-1 text-center text-[10px] font-bold leading-[16px] text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </button>
  );
  const label = count > 0 ? `Reback requests — ${count} waiting for you` : "Reback requests";
  return Tip ? <Tip label={label}>{button}</Tip> : button;
}
