"use client";

import { Clock } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useRecordMeta } from "@/context/RecordMetaContext";

function AuditRow({ label, value }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 leading-snug">
      <span className="text-zinc-400 shrink-0 w-[72px] text-right">{label}</span>
      <span className="text-zinc-200">{value}</span>
    </div>
  );
}

export default function RecordMeta() {
  const meta = useRecordMeta();

  if (!meta) return null;
  const { createdAt, updatedAt, createdBy, updatedBy } = meta;
  if (!createdAt && !updatedAt && !createdBy && !updatedBy) return null;

  // Don't repeat updated date if it matches created date
  const showUpdated = updatedAt && updatedAt !== createdAt;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          {/* small semi-transparent clock badge, fixed bottom-right */}
          <button
            aria-label="Record audit info"
            className="
              fixed bottom-4 right-4 z-40
              flex items-center justify-center
              w-7 h-7 rounded-full
              bg-white/60 dark:bg-zinc-800/60
              border border-zinc-200/70 dark:border-zinc-700/70
              shadow-sm backdrop-blur-sm
              text-zinc-400/70 hover:text-zinc-500 dark:hover:text-zinc-300
              hover:bg-white/90 dark:hover:bg-zinc-800/90
              transition-all duration-150
              cursor-default select-none
            "
            tabIndex={-1}
          >
            <Clock className="w-3 h-3" />
          </button>
        </TooltipTrigger>

        <TooltipContent
          side="left"
          sideOffset={8}
          className="space-y-0.5 py-2.5 px-3 min-w-[180px]"
        >
          <p className="text-zinc-400 text-[9px] font-semibold uppercase tracking-widest mb-2">
            Record info
          </p>
          <AuditRow label="Created" value={createdAt} />
          <AuditRow label="By" value={createdBy} />
          {showUpdated && <AuditRow label="Updated" value={updatedAt} />}
          {showUpdated && <AuditRow label="By" value={updatedBy} />}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
