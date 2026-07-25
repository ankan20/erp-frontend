"use client";

import { X } from "lucide-react";

export default function HeaderWrapper({ header, children, pendingApproval, onDismissApproval }) {
  return (
    <div className="h-full flex flex-col overflow-hidden">

      {/* HEADER */}
      <div className="shrink-0">
        {header}
      </div>

      {/* PENDING APPROVAL BANNER */}
      {pendingApproval && (
        <div className="shrink-0 bg-green-50 border-b border-green-200 px-5 py-2 flex items-center gap-2.5">
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <p className="text-sm font-medium text-green-700 flex-1">
            {typeof pendingApproval === "string"
              ? pendingApproval
              : "Your approval action is required for this document."}
          </p>
          {onDismissApproval && (
            <button
              onClick={onDismissApproval}
              className="ml-2 text-green-500 hover:text-green-800 transition-colors cursor-pointer"
              aria-label="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* BODY */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {children}
      </div>

    </div>
  );
}