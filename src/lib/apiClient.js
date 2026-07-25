import API_BASE_URL from "@/config/api.config";
import { getCookie } from "./cookies";
import { clearAuthCookies } from "@/lib/cookies";
import { getLocalStorage } from "./localStorage";

const getAuth = () => {
  if (typeof window === "undefined") return {};
  return {
    token: getLocalStorage("token"),
  };
};

export const apiRequest = async ({
  url,
  method = "GET",
  data,
  headers = {},
  params,
  requireAuth = true,
}) => {
  const { token } = getAuth();
  const isFormData = data instanceof FormData;

  const query =
    params && Object.keys(params).length
      ? `?${new URLSearchParams(params).toString()}`
      : "";

  const finalHeaders = {
    ...(isFormData ? {} : { "Content-Type": "application/json" }),
    ...(requireAuth && token && { Authorization: `Bearer ${token}` }),
    ...headers,
  };

  const res = await fetch(`${API_BASE_URL}${url}${query}`, {
    method,
    headers: finalHeaders,
    body: data
      ? isFormData
        ? data //raw FormData
        : JSON.stringify(data)
      : undefined,
  });

  let result;
  try {
    result = await res.json();
  } catch {
    result = null;
  }

  if (!res.ok) {
    if (res.status === 401 && requireAuth && typeof window !== "undefined") {
      const alreadyOnLogin = window.location.pathname === "/login";
      if (!alreadyOnLogin) {
        clearAuthCookies();
        window.location.href = "/login";
        return; // stop further processing while navigating
      }
    }
    if (res.status === 403 && typeof window !== "undefined") {
      import("sonner").then(({ toast }) => {
        toast.error("You don't have permission to perform this action");
      });
    }
    let msg = result?.message || result?.msg;
    throw new Error(msg || "API Error");
  }

  return result;
};
