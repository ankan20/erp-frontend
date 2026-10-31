// Can the current user open a given ERP path? Uses the same rules as the
// sidebar: each sidebar item's permissionKey is checked against the user's
// "<key>.VIEW / .EDIT / .APPROVER" permissions. Reusable from anywhere:
//
//   import { canOpenRoute } from "@/lib/routeAccess";
//   const { allowed, title } = canOpenRoute("/project-management/customer-billing/sale-bill-claim/12");
//
// This is a UX check only — the backend still enforces access on every API call.
import { sidebarConfig } from "@/config/sidebar.config";
import { getLocalStorage } from "@/lib/localStorage";
import { getCookie } from "@/lib/cookies";
import { ROLE } from "@/config/role.config";

// Flatten once: every item with a path, plus the top-level section it sits in
let routes = null;
function allRoutes() {
  if (routes) return routes;
  routes = [];
  const walk = (items, section) => {
    for (const item of items || []) {
      if (!item) continue;
      const sec = section || item.title;
      if (item.path) {
        const bases = [item.path, ...(item.activePaths || [])];
        routes.push({ title: (item.title || "").trim(), permissionKey: item.permissionKey, section: sec, bases });
      }
      if (item.children) walk(item.children, sec);
    }
  };
  walk(sidebarConfig, null);
  return routes;
}

const under = (path, base) => path === base || path.startsWith(base.endsWith("/") ? base : `${base}/`);

// The sidebar entry a path belongs to (most specific match wins), or null
export function findRouteInfo(path) {
  const clean = String(path || "").split(/[?#]/)[0];
  let best = null;
  let bestLen = -1;
  for (const r of allRoutes()) {
    for (const b of r.bases) {
      if (under(clean, b) && b.length > bestLen) { best = r; bestLen = b.length; }
    }
  }
  return best;
}

export function canOpenRoute(path) {
  const info = findRouteInfo(path);
  if (!info) return { allowed: true, title: null };          // not a menu page — let the page decide
  const title = info.title;
  const role  = getCookie("role");

  if (info.section === "Settings") return { allowed: role === ROLE.SUPER_ADMIN, title };
  if (info.section === "Master")   return { allowed: true, title };   // master pages check access themselves
  if (!info.permissionKey)         return { allowed: true, title };

  const perms = getLocalStorage("permissions") || {};
  const k = info.permissionKey;
  return { allowed: !!(perms[`${k}.VIEW`] || perms[`${k}.EDIT`] || perms[`${k}.APPROVER`]), title };
}
