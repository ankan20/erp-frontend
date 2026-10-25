"use client";

import { useState } from "react";
import PageNotAvailable from "@/components/common/PageNotAvailable";
import { canAccessSettings } from "@/helper/getSettingsAccess";

export default function SettingsLayout({ children }) {
  const [canAccess] = useState(() =>
    typeof window !== "undefined" ? canAccessSettings() : true
  );

  if (!canAccess) return <PageNotAvailable />;
  return children;
}