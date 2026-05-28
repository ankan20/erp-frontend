import { sidebarConfig } from "@/config/sidebar.config";
import { goToHomePage } from "@/helper/goToHomePage";

// ─── Collect all leaf paths ───────────────────────────────────────────────────
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

/**
 * Finds the matching list page for the current pathname.
 * Used when the user is on a detail/create/edit page and clicks back.
 * Returns the list page path, or null if already on a list page.
 */
const getCurrentModuleListPath = (pathname) => {
  const match = LEAF_PATHS
    .filter((p) => pathname.startsWith(p) && pathname.length > p.length)
    .sort((a, b) => b.length - a.length)[0];
  return match || null;
};

/**
 * ERP-style back navigation — called from PageActionButtons and PageNotAvailable.
 *
 * Behaviour:
 * 1. If on a detail/create/edit page → go to that module's own list page
 * 2. If on a list page → pop the previous list page from the navigation stack
 * 3. If stack is empty → fall back to goToHomePage (first allowed page)
 *
 * @param {object} router   - Next.js router
 * @param {object} stack    - stack ref from NavigationHistoryContext ({ current: [] })
 */
export const goToBackPage = (router, stack) => {
  if (!router) return;

  const pathname = window.location.pathname;

  // Case 1: user is deeper than a list page (detail/create/edit) → go to own list
  const ownListPath = getCurrentModuleListPath(pathname);
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
