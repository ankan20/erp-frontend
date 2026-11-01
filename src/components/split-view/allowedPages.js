"use client";

// Pages a user may open in a split window.
// Same rules as the sidebar (role) + the user's page permissions.
// The page itself and the backend still check access again when it loads.

import { sidebarConfig } from "@/config/sidebar.config";
import { routeMetaConfig } from "@/config/route-meta.config";
import { tcodeConfig } from "@/config/tcode.config";
import { ROLE } from "@/config/role.config";
import { getCookie } from "@/lib/cookies";
import { getLocalStorage } from "@/lib/localStorage";

const hasPermission = (permissions, key) =>
  !!(permissions?.[`${key}.VIEW`] || permissions?.[`${key}.EDIT`] || permissions?.[`${key}.APPROVER`]);

const canEditKey = (permissions, key) => !!permissions?.[`${key}.EDIT`];

const NEW_ROUTES = new Set(routeMetaConfig.map((r) => r.basePath).filter((p) => p.endsWith("/new")));

function topLevelAllowed(item, role) {
  if (role === ROLE.SUPER_ADMIN) return item.title === "Settings" || item.title === "Master";
  if (role === ROLE.ADMIN) return item.title === "Master";
  return item.title !== "Settings";
}

/**
 * [{ title, path, trail: "Resource > Procurement", newPath | null }]
 */
export function getAllowedPages() {
  const role = getCookie("role");
  const permissions = getLocalStorage("permissions") || {};
  const out = [];

  const walk = (items, trail, needsPermission) => {
    for (const item of items || []) {
      if (!item) continue;
      if (item.path && !item.children?.length) {
        const keyOk = !needsPermission || !item.permissionKey || hasPermission(permissions, item.permissionKey);
        if (keyOk) {
          const newPath = `${item.path}/new`;
          const mayCreate = !needsPermission || !item.permissionKey || canEditKey(permissions, item.permissionKey);
          out.push({
            title: item.title,
            path: item.path,
            trail: trail.join(" > "),
            newPath: NEW_ROUTES.has(newPath) && mayCreate ? newPath : null,
          });
        }
      }
      if (item.children?.length) walk(item.children, [...trail, item.title], needsPermission);
    }
  };

  for (const top of sidebarConfig) {
    if (!top || !topLevelAllowed(top, role)) continue;
    // general users: module pages need a page permission; Master pages are view-checked by the page itself
    const needsPermission = role !== ROLE.SUPER_ADMIN && role !== ROLE.ADMIN && top.title !== "Master";
    walk(top.children, [top.title], needsPermission);
  }
  return out;
}

/** T-code → path, only when that path is in the allowed list. */
export function resolveTcode(code, allowed) {
  const path = tcodeConfig[String(code || "").trim().toLowerCase()];
  if (!path) return null;
  return allowed.some((p) => path === p.path || path.startsWith(p.path + "/")) ? path : null;
}
