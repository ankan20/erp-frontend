"use client";

import { Columns2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isInsidePane, postToParent, splitActions } from "./splitStore";

/** Header button: open another page or document next to this one. */
export default function SplitViewButton() {
  const open = () => {
    // inside a window the main page owns the split view
    if (isInsidePane()) postToParent("open-picker");
    else splitActions.openPicker();
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={open}
          aria-label="Split view: open another page side by side"
          className="ml-1 flex h-[32px] w-[32px] cursor-pointer items-center justify-center rounded-md text-[#144664] transition hover:scale-105 hover:bg-white/70"
        >
          <Columns2 className="h-[22px] w-[22px]" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" variant="icon">
        Split view – open another page side by side
      </TooltipContent>
    </Tooltip>
  );
}
