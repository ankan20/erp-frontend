"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { currentUrl, postToParent } from "./splitStore";

/** Runs only inside a split window: tells the main page where this window is. */
export default function PaneBridge() {
  const pathname = usePathname();
  const params = useSearchParams();
  const query = params?.toString() || "";

  useEffect(() => {
    postToParent("ready");
  }, []);

  useEffect(() => {
    postToParent("navigated", { url: currentUrl() });
  }, [pathname, query]);

  return null;
}
