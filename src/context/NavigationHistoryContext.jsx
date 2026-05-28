"use client";

import { createContext, useContext, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { sidebarConfig } from "@/config/sidebar.config";

// ─── Collect all leaf paths from sidebarConfig ───────────────────────────────
// Leaf = has a `path` and no `children` (i.e. an actual list page route)
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

// Returns the leaf path if the given pathname IS exactly a list page
const isListPage = (pathname) => LEAF_PATHS.includes(pathname);

// ─── Context ──────────────────────────────────────────────────────────────────
const NavigationHistoryContext = createContext({ stack: { current: [] } });

export const useNavigationHistory = () => useContext(NavigationHistoryContext);

/**
 * Wraps the protected layout.
 * Tracks visited list pages in a ref-based stack (memory only — clears on refresh,
 * which is expected ERP behaviour matching SAP/Oracle).
 */
export function NavigationHistoryProvider({ children }) {
  // useRef so stack mutations never trigger re-renders
  const stack = useRef([]);
  const pathname = usePathname();

  useEffect(() => {
    if (!isListPage(pathname)) return;

    const current = stack.current;
    const last = current[current.length - 1];

    // Don't push duplicate consecutive entries
    if (last === pathname) return;

    // Remove if already exists deeper in stack (user went back then forward)
    const existingIndex = current.indexOf(pathname);
    if (existingIndex !== -1) {
      current.splice(existingIndex, 1);
    }

    current.push(pathname);
  }, [pathname]);

  return (
    <NavigationHistoryContext.Provider value={{ stack }}>
      {children}
    </NavigationHistoryContext.Provider>
  );
}
