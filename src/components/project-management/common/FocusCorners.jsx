"use client";

import { PM } from "./pmTheme";
import { cn } from "@/lib/utils";

const C = "absolute w-[7px] h-[7px] pointer-events-none z-10";

export default function FocusCorners() {
  return (
    <>
      <span className={cn(C, "top-0 left-0   border-t-2 border-l-2", PM.focusCorner)} />
      <span className={cn(C, "top-0 right-0  border-t-2 border-r-2", PM.focusCorner)} />
      <span className={cn(C, "bottom-0 left-0  border-b-2 border-l-2", PM.focusCorner)} />
      <span className={cn(C, "bottom-0 right-0 border-b-2 border-r-2", PM.focusCorner)} />
    </>
  );
}
