"use client";

import PageNotAvailable from "@/components/common/PageNotAvailable";
import { canAccessSettings } from "@/helper/getSettingsAccess";

export default function SettingsLayout({
  children,
}) {

  const canAccess =
    canAccessSettings();

  if (!canAccess) {
    return <PageNotAvailable />;
  }

  return children;
}