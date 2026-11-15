"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";
import { getCookie } from "@/lib/cookies";
import { getLocalStorage } from "@/lib/localStorage";

const roleAccess = {
  super_admin: ["/settings"],
  admin: ["/master"],
  user: ["/"],
};

export const useAuthGuard = () => {
  const router = useRouter();
  const pathname = usePathname();

  const token = (typeof window !== "undefined" ? getLocalStorage("token") : null) ;
  const role = getCookie("role");

  // Redirect logic (side effect only)
  useEffect(() => {
    if (!token) {
      // Save current path so we can return after login + project select (user role only)
      if (typeof window !== "undefined" && pathname && pathname !== "/" && pathname !== "/login") {
        sessionStorage.setItem("returnTo", pathname);
      }
      router.replace("/login");
      return;
    }

    // Consent gate: only redirect when LoginForm explicitly marked consent as pending
    if (typeof window !== "undefined" && getLocalStorage("consent_accepted") === "false" && pathname !== "/consent") {
      router.replace("/consent");
      return;
    }

    if (pathname === "/login") {
      if (role === "super_admin") {
        router.replace("/settings/company-details");
      } else if (role === "admin") {
        router.replace("/master/ledger-code");
      } else {
        router.replace("/");
      }
    }
  }, [token, role, pathname]);

  // PURE calculation (no state)
  if (!token) return { authorized: false, loading: true };

  return {
    authorized: true,
    loading: false,
  };
};