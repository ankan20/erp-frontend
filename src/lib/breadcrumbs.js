import { routeMetaConfig } from "@/config/route-meta.config";

export function getBreadcrumbs(pathname) {
  const cleanPath = pathname.split("?")[0];

  const matchedRoute = routeMetaConfig
    .filter((route) => cleanPath.startsWith(route.basePath))
    .sort((a, b) => b.basePath.length - a.basePath.length)[0];

  return matchedRoute?.breadcrumbs || [];
}