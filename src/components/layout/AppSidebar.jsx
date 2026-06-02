"use client";

import { useState, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sidebarConfig } from "@/config/sidebar.config";
import { ChevronRight, ChevronDown, Menu } from "lucide-react";

export default function AppSidebar({ collapsed, setCollapsed }) {
  const pathname = usePathname();
  const router = useRouter();
  const [manualOpen, setManualOpen] = useState({});

  // --- Collapsed flyout state ---
  const [flyout, setFlyout] = useState(null);
  const [subFlyout, setSubFlyout] = useState(null);
  const [subSubFlyout, setSubSubFlyout] = useState(null); // level 3 flyout

  const flyoutTimer = useRef(null);
  const subFlyoutTimer = useRef(null);
  const subSubFlyoutTimer = useRef(null);

  // ─── ALL EXISTING LOGIC BELOW — UNCHANGED 

  const hasActiveChild = (item) => {
    if (!item) return false;
    if (item.path && pathname.startsWith(item.path)) return true;
    if (item.children && Array.isArray(item.children)) {
      return item.children.some((child) => hasActiveChild(child));
    }
    return false;
  };

  const isMenuOpen = (key, item) => {
    if (manualOpen[key] !== undefined) return manualOpen[key];
    return hasActiveChild(item);
  };

  const toggleMenu = (key, level) => {
    setManualOpen((prev) => {
      const updated = { ...prev };
      if (level === 0) {
        sidebarConfig.forEach((_, index) => {
          updated[`-${index}`] = false;
        });
        updated[key] = !isMenuOpen(key);
      } else {
        const parentKey = key.split("-").slice(0, -1).join("-");
        Object.keys(updated).forEach((k) => {
          const sameParent =
            k.startsWith(parentKey) &&
            k.split("-").length === key.split("-").length;
          if (sameParent) updated[k] = false;
        });
        updated[key] = !isMenuOpen(key);
      }
      return updated;
    });
  };

  const isActive = (path) => path && pathname.startsWith(path);

  const getBgColor = (level, isParentActive, isChildActive) => {
    if (collapsed) return "";
    if (isChildActive) return "bg-yellow-400";
    if (level === 0 && isParentActive) return "bg-[#5f8f3a]";
    if (level === 0) return "bg-[#9fbc83]";
    if (level === 1) return "bg-[#4f86b9]";
    if (level === 2) return "bg-[#a9bdd1]";
    return "bg-[#c9d9e8]"; // level 3+ — lighter shade so nested items differ visually
  };

  const renderItems = (items, level = 0, parentKey = "") => {
    if (!items) return null;
    return items.map((item, index) => {
      if (!item) return null;
      const key = `${parentKey}-${index}`;
      const hasChildren = item.children && Array.isArray(item.children);
      const open = isMenuOpen(key, item);
      const isParentActive = hasActiveChild(item);
      const isChildActive = isActive(item.path);
      const isLastLevel = !item.children || item.children.length === 0;

      return (
        <div key={key}>
          <div
            onClick={() => {
              if (hasChildren) {
                toggleMenu(key, level);
              } else if (item.path) {
                router.push(item.path);
              }
            }}
            className={`flex items-center justify-between cursor-pointer px-3 py-2 border-b-2
              ${getBgColor(level, isParentActive, isChildActive)}
              ${isLastLevel ? "hover:bg-yellow-400" : "hover:brightness-95"} transition-colors duration-150`}
            style={{ paddingLeft: `${12 + level * 20}px` }}
          >
            {!collapsed && (
              <>
                <div className="flex items-center gap-2">
                  {level === 0 && item.icon && <item.icon size={16} />}
                  <span className="text-sm font-medium">{item.title}</span>
                </div>
                {hasChildren && (
                  <span>
                    {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </span>
                )}
              </>
            )}
          </div>
          {hasChildren && open && !collapsed && (
            <div className="border-l border-gray-300 ml-2">
              {renderItems(item.children, level + 1, key)}
            </div>
          )}
        </div>
      );
    });
  };

  // ─── COLLAPSED FLYOUT HANDLERS ───────────────────────────────────────────────

  // Open flyout when icon row is hovered
  const handleIconEnter = (e, item, index) => {
    clearTimeout(flyoutTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    setFlyout({ index, item, top: rect.top });
    setSubFlyout(null); // reset sub-flyout when switching modules
  };

  // Delayed close — gives time for mouse to reach the flyout panel
  const handleIconLeave = () => {
    flyoutTimer.current = setTimeout(() => {
      setFlyout(null);
      setSubFlyout(null);
    }, 120);
  };

  // Cancel close when mouse enters the flyout panel
  const handleFlyoutEnter = () => {
    clearTimeout(flyoutTimer.current);
  };

  // Close flyout when mouse fully leaves the flyout panel
  const handleFlyoutLeave = () => {
    flyoutTimer.current = setTimeout(() => {
      setFlyout(null);
      setSubFlyout(null);
    }, 120);
  };

  // Open sub-flyout when a group child (has children) is hovered inside flyout
  const handleChildGroupEnter = (e, child) => {
    clearTimeout(subFlyoutTimer.current);
    clearTimeout(flyoutTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const PANEL_WIDTH = 200;
    const left =
      rect.right + PANEL_WIDTH > window.innerWidth
        ? Math.max(0, rect.right - PANEL_WIDTH) // slide left from right edge, not from left edge
        : rect.right;
    setSubFlyout({
      top: rect.top,
      left,
      title: child.title,
      children: child.children,
    });
  };

  // Delayed sub-flyout close
  const handleChildGroupLeave = () => {
    subFlyoutTimer.current = setTimeout(() => setSubFlyout(null), 120);
  };

  // Cancel sub-flyout close when mouse enters it
  const handleSubFlyoutEnter = () => {
    clearTimeout(subFlyoutTimer.current);
    clearTimeout(flyoutTimer.current);
  };

  const handleSubFlyoutLeave = () => {
    subFlyoutTimer.current = setTimeout(() => setSubFlyout(null), 120);
    flyoutTimer.current = setTimeout(() => {
      setFlyout(null);
      setSubFlyout(null);
      setSubSubFlyout(null);
    }, 120);
  };

  // ─── SUB-SUB FLYOUT HANDLERS (level 3) ───────────────────────────────────

  // Open level-3 flyout when a nested item in subFlyout is hovered
  const handleSubChildGroupEnter = (e, child) => {
    clearTimeout(subSubFlyoutTimer.current);
    clearTimeout(subFlyoutTimer.current);
    clearTimeout(flyoutTimer.current);
    const rect = e.currentTarget.getBoundingClientRect();
    const PANEL_WIDTH = 190;
    const left =
      rect.right + PANEL_WIDTH > window.innerWidth
        ? Math.max(0, rect.right - PANEL_WIDTH)
        : rect.right;
    setSubSubFlyout({
      top: rect.top,
      left,
      title: child.title,
      children: child.children,
    });
  };

  const handleSubChildGroupLeave = () => {
    subSubFlyoutTimer.current = setTimeout(() => setSubSubFlyout(null), 120);
  };

  const handleSubSubFlyoutEnter = () => {
    clearTimeout(subSubFlyoutTimer.current);
    clearTimeout(subFlyoutTimer.current);
    clearTimeout(flyoutTimer.current);
  };

  const handleSubSubFlyoutLeave = () => {
    subSubFlyoutTimer.current = setTimeout(() => setSubSubFlyout(null), 120);
    subFlyoutTimer.current = setTimeout(() => setSubFlyout(null), 120);
    flyoutTimer.current = setTimeout(() => {
      setFlyout(null);
      setSubFlyout(null);
      setSubSubFlyout(null);
    }, 120);
  };

  // Navigate and close all flyouts
  const handleNavigate = (path) => {
    router.push(path);
    setFlyout(null);
    setSubFlyout(null);
    setSubSubFlyout(null);
  };

  // ─── FLYOUT PANEL (level 1) — floats to the right of the icon rail ──────────
  const renderFlyout = () => {
    if (!flyout) return null;
    const { item, top } = flyout;

    return (
      <div
        // Fixed so it floats over page content regardless of layout
        style={{ position: "fixed", top, left: 50, zIndex: 9999 }}
        onMouseEnter={handleFlyoutEnter}
        onMouseLeave={handleFlyoutLeave}
        // CHANGED: glass effect — backdrop blur + light blue tint + rounded corners
        className="
          w-[210px]
          rounded-r-xl
          overflow-hidden
          select-none
          shadow-xl
          border border-white/40
          bg-sky-100/70
          backdrop-blur-md
        "
      >
        {/* Module title header — glass tinted */}
        <div className="px-3 py-2 text-xs font-semibold text-sky-800 uppercase tracking-wide bg-sky-200/60 border-b border-white/30">
          {item.title}
        </div>

        {/* Children list */}
        {item.children?.map((child, ci) => {
          const hasNested = child.children && child.children.length > 0;
          const childActive = child.path ? isActive(child.path) : hasActiveChild(child);

          return (
            <div
              key={ci}
              onMouseEnter={hasNested ? (e) => handleChildGroupEnter(e, child) : undefined}
              onMouseLeave={hasNested ? handleChildGroupLeave : undefined}
              onClick={!hasNested && child.path ? () => handleNavigate(child.path) : undefined}
              className={`
                flex items-center justify-between
                px-3 py-2
                text-sm text-sky-900
                cursor-pointer
                border-b border-white/20 last:border-b-0
                transition-colors duration-100
                ${childActive ? "bg-yellow-400/80 font-medium text-yellow-900" : "hover:bg-sky-300/50"}
              `}
            >
              <span className="truncate">{child.title}</span>
              {/* Show arrow if group has nested children */}
              {hasNested && <ChevronRight size={14} className="text-sky-500 shrink-0" />}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── SUB-FLYOUT PANEL (level 2) ─────────────────────────────────────────────
  const renderSubFlyout = () => {
    if (!subFlyout) return null;
    const { top, left, title, children } = subFlyout;

    return (
      <div
        style={{ position: "fixed", top, left, zIndex: 10000 }}
        onMouseEnter={handleSubFlyoutEnter}
        onMouseLeave={handleSubFlyoutLeave}
        className="
          w-[200px]
          rounded-xl
          overflow-hidden
          select-none
          shadow-xl
          border border-white/40
          bg-sky-100/70
          backdrop-blur-md
        "
      >
        <div className="px-3 py-2 text-xs font-semibold text-sky-800 uppercase tracking-wide bg-sky-200/60 border-b border-white/30">
          {title}
        </div>

        {children?.map((leaf, li) => {
          // FIXED: item may have further children (e.g. Order → Material Order, Service Order)
          const hasNested = leaf.children && leaf.children.length > 0;
          const leafActive = leaf.path ? isActive(leaf.path) : hasActiveChild(leaf);

          return (
            <div
              key={li}
              onMouseEnter={hasNested ? (e) => handleSubChildGroupEnter(e, leaf) : undefined}
              onMouseLeave={hasNested ? handleSubChildGroupLeave : undefined}
              onClick={!hasNested && leaf.path ? () => handleNavigate(leaf.path) : undefined}
              className={`
                flex items-center justify-between
                px-3 py-2
                text-sm text-sky-900
                cursor-pointer
                border-b border-white/20 last:border-b-0
                transition-colors duration-100
                ${leafActive ? "bg-yellow-400/80 font-medium text-yellow-900" : "hover:bg-sky-300/50"}
              `}
            >
              <span className="truncate">{leaf.title}</span>
              {hasNested && <ChevronRight size={13} className="text-sky-500 shrink-0" />}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── SUB-SUB-FLYOUT PANEL (level 3) ─────────────────────────────────────────
  const renderSubSubFlyout = () => {
    if (!subSubFlyout) return null;
    const { top, left, title, children } = subSubFlyout;

    return (
      <div
        style={{ position: "fixed", top, left, zIndex: 10001 }}
        onMouseEnter={handleSubSubFlyoutEnter}
        onMouseLeave={handleSubSubFlyoutLeave}
        className="
          w-[190px]
          rounded-xl
          overflow-hidden
          select-none
          shadow-xl
          border border-white/40
          bg-sky-100/70
          backdrop-blur-md
        "
      >
        <div className="px-3 py-2 text-xs font-semibold text-sky-800 uppercase tracking-wide bg-sky-200/60 border-b border-white/30">
          {title}
        </div>

        {children?.map((item, i) => {
          const itemActive = item.path ? isActive(item.path) : false;

          return (
            <div
              key={i}
              onClick={item.path ? () => handleNavigate(item.path) : undefined}
              className={`
                px-3 py-2
                text-sm text-sky-900
                cursor-pointer
                border-b border-white/20 last:border-b-0
                transition-colors duration-100
                ${itemActive ? "bg-yellow-400/80 font-medium text-yellow-900" : "hover:bg-sky-300/50"}
              `}
            >
              {item.title}
            </div>
          );
        })}
      </div>
    );
  };

  // ─── RENDER 

  return (
    <div
      className={`h-full flex flex-col border-r bg-[#dcdcdc] transition-all duration-300 ${
        collapsed ? "w-[50px]" : "w-[240px]"
      }`}
    >
      {/* TOGGLE BUTTON — unchanged */}
      <div className="flex items-center justify-start px-2 py-2 border-b shrink-0">
        <button onClick={() => setCollapsed(!collapsed)} className="cursor-pointer">
          <Menu size={20} />
        </button>
      </div>

      {/* EXPANDED: existing renderItems — fully unchanged */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {renderItems(sidebarConfig)}
        </div>
      )}

      {/* COLLAPSED: icon rail — only icons, flyout on hover */}
      {collapsed && (
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {sidebarConfig.map((item, index) => {
            const isModuleActive = hasActiveChild(item);

            return (
              <div
                key={index}
                onMouseEnter={(e) => handleIconEnter(e, item, index)}
                onMouseLeave={handleIconLeave}
                className={`
                  flex items-center justify-center
                  w-full h-[42px]
                  border-b-2
                  cursor-pointer
                  transition-colors duration-150
                  ${
                    isModuleActive
                      ? "bg-[#5f8f3a] text-white"
                      : "bg-[#9fbc83] hover:bg-[#8aad6c]"
                  }
                  ${flyout?.index === index ? "bg-[#5f8f3a] text-white" : ""}
                `}
              >
                {item.icon && <item.icon size={18} />}
              </div>
            );
          })}
        </div>
      )}

      {/* FLYOUTS — rendered outside sidebar flow, fixed positioned */}
      {collapsed && renderFlyout()}
      {collapsed && renderSubFlyout()}
      {collapsed && renderSubSubFlyout()}
    </div>
  );
}
