import API_BASE_URL from "@/config/api.config";
import { getCookie } from "./cookies";
import { clearAuthCookies } from "@/lib/cookies";
import { getLocalStorage } from "./localStorage";
import { notifyDataChanged } from "./dataSync";

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
        const msg = result?.message || result?.msg || "You have been logged out. Please sign in again.";
        clearAuthCookies();
        import("sonner").then(({ toast }) => {
          toast.error(msg, { duration: 4000 });
        });
        setTimeout(() => {
          window.location.href = "/login";
        }, 1500);
        return;
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

  // tell other open windows that data changed (create / update / delete)
  notifyDataChanged(method, url);

  // auto-publish audit meta for single-record GET responses
  if (
    method === "GET" &&
    typeof window !== "undefined" &&
    Array.isArray(result?.data) &&
    result.data.length === 1
  ) {
    const r = result.data[0] || {};
    // accept both camelCase and snake_case field names
    const createdAt  = r.createdAt  || r.created_at  || null;
    const updatedAt  = r.updatedAt  || r.updated_at  || null;
    const createdBy  = r.createdBy  || r.created_by  || null;
    const updatedBy  = r.updatedBy  || r.updated_by  || null;
    if (createdAt || updatedAt || createdBy || updatedBy) {
      window.dispatchEvent(
        new CustomEvent("erp:recordmeta", {
          detail: {
            createdAt: typeof createdAt === "string" ? createdAt : null,
            updatedAt: typeof updatedAt === "string" ? updatedAt : null,
            createdBy: typeof createdBy === "string" ? createdBy : null,
            updatedBy: typeof updatedBy === "string" ? updatedBy : null,
          },
        })
      );
    }
  }

  return result;
};
