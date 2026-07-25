"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

export default function ProtectedError({ error, reset }) {
  const router = useRouter();

  useEffect(() => {
    console.error("[App Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="text-center flex flex-col items-center space-y-6 px-6 max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-800">Something went wrong</h1>

        <p className="text-sm text-gray-500">
          An unexpected error occurred while loading this page. Please try again or go back to the dashboard.
        </p>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={reset}
            className="flex items-center gap-2 px-5 py-2 rounded-md border text-sm font-medium hover:bg-gray-50 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 px-5 py-2 rounded-md bg-[#0c3472] hover:bg-[#092552] text-white text-sm font-medium cursor-pointer"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
