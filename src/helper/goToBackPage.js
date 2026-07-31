import { sidebarConfig } from "@/config/sidebar.config";
import { routeMetaConfig } from "@/config/route-meta.config";
import { goToHomePage } from "@/helper/goToHomePage";

// ─── Sidebar leaf paths ───────────────────────────────────────────────────────
const collectLeafPaths = (items) => {
  const paths = [];
  for (const item of items) {
    if (item.path && (!item.children || item.children.length === 0)) {
      paths.push(item.path);
    }
    if (item.children?.length > 0) {
      paths.push(...collectLeafPaths(item.children));
    }
  }
  return paths;
};

const LEAF_PATHS = collectLeafPaths(sidebarConfig);

// ─── Intermediate list pages ──────────────────────────────────────────────────
// Derived automatically from routeMetaConfig — any basePath that:
//   • doesn't end with /new        (add pages)
//   • doesn't contain [            (dynamic [id] pages)
//   • isn't already a sidebar leaf (those are handled separately)
//
// This means adding a new nested module only requires populating routeMetaConfig
// (which you do anyway for breadcrumbs) — no extra maintenance here.
const INTERMEDIATE_LIST_PATHS = routeMetaConfig
  .map((r) => r.basePath)
  .filter(
    (p) =>
      !p.endsWith("/new") &&
      !p.includes("[") &&
      !LEAF_PATHS.includes(p)
  );

// ─── Find closest list page ───────────────────────────────────────────────────
// Checks intermediate list pages first (more specific / longer match),
// then falls back to sidebar leaf paths.
const findClosestListPage = (pathname) => {
  const intermediateMatch = INTERMEDIATE_LIST_PATHS
    .filter((p) => pathname.startsWith(p) && pathname.length > p.length)
    .sort((a, b) => b.length - a.length)[0];

  if (intermediateMatch) return intermediateMatch;

  return LEAF_PATHS
    .filter((p) => pathname.startsWith(p) && pathname.length > p.length)
    .sort((a, b) => b.length - a.length)[0] || null;
};

/**
 * ERP-style back navigation — called from PageActionButtons and PageNotAvailable.
 *
 * Behaviour:
 * 1. If on a detail/create/edit page → go to the closest list page
 *    (intermediate list page if one exists, otherwise the sidebar leaf)
 * 2. If on a list page → pop the previous list page from the navigation stack
 * 3. If stack is empty → fall back to goToHomePage (first allowed page)
 *
 * @param {object} router   - Next.js router
 * @param {object} stack    - stack ref from NavigationHistoryContext ({ current: [] })
 */
export const goToBackPage = (router, stack) => {
  if (!router) return;

  const pathname = window.location.pathname;

  // Case 1: user is deeper than a list page (detail/create/edit) → go to closest list
  const ownListPath = findClosestListPage(pathname);
  if (ownListPath) {
    router.push(ownListPath);
    return;
  }

  // Case 2: user is on a list page → pop previous list page from stack
  if (stack?.current?.length > 0) {
    const current = stack.current;

    // Remove current page from top if it's there
    if (current[current.length - 1] === pathname) {
      current.pop();
    }

    const previous = current[current.length - 1];
    if (previous) {
      current.pop();
      router.push(previous);
      return;
    }
  }

  // Case 3: stack empty or no match → fall back to home (first allowed page)
  goToHomePage(router);
};
