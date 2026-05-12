"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { sidebarConfig } from "@/config/sidebar.config";
import { ChevronRight, ChevronDown, Menu } from "lucide-react";

export default function AppSidebar({ collapsed, setCollapsed }) {
  const pathname = usePathname();
  const router = useRouter();

  // const [collapsed, setCollapsed] = useState(true);
  const [manualOpen, setManualOpen] = useState({});

  //Active detection
  const hasActiveChild = (item) => {
    if (!item) return false;

    if (item.path && pathname.startsWith(item.path)) {
      return true;
    }

    if (item.children && Array.isArray(item.children)) {
      return item.children.some((child) => hasActiveChild(child));
    }

    return false;
  };

  //Menu open logic
  const isMenuOpen = (key, item) => {
    if (manualOpen[key] !== undefined) return manualOpen[key];
    return hasActiveChild(item);
  };

  // const toggleMenu = (key) => {
  //   setManualOpen((prev) => ({
  //     ...prev,
  //     [key]: !isMenuOpen(key),
  //   }));
  // };
  const toggleMenu = (key, level) => {
    setManualOpen((prev) => {
      const updated = { ...prev };

      // ROOT LEVEL
      if (level === 0) {
        // close all root menus
        sidebarConfig.forEach((_, index) => {
          updated[`-${index}`] = false;
        });

        // open current one
        updated[key] = !isMenuOpen(key);
      }

      // CHILD LEVEL
      else {
        const parentKey = key.split("-").slice(0, -1).join("-");

        // close sibling menus
        Object.keys(updated).forEach((k) => {
          const sameParent =
            k.startsWith(parentKey) &&
            k.split("-").length === key.split("-").length;

          if (sameParent) {
            updated[k] = false;
          }
        });

        updated[key] = !isMenuOpen(key);
      }

      return updated;
    });
  };

  const isActive = (path) => path && pathname.startsWith(path);

  const getBgColor = (level, isParentActive, isChildActive) => {
    if (collapsed) return "";

    if (isChildActive) return "bg-yellow-400"; // highest
    if (level === 0 && isParentActive) return "bg-[#5f8f3a]"; // parent active

    if (level === 0) return "bg-[#9fbc83]";
    if (level === 1) return "bg-[#4f86b9]";
    return "bg-[#a9bdd1]";
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
          {/* ITEM */}
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
              ${
                isLastLevel ? "hover:bg-yellow-400" : "hover:brightness-95"
              } transition-colors duration-150`}
            style={{
              paddingLeft: `${12 + level * 20}px`,
            }}
          >
            {!collapsed && (
              <>
                <div className="flex items-center gap-2">
                  {/* ICON */}
                  {level === 0 && item.icon && <item.icon size={16} />}

                  <span className="text-sm font-medium">{item.title}</span>
                </div>

                {hasChildren && (
                  <span>
                    {open ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                  </span>
                )}
              </>
            )}
          </div>

          {/* CHILDREN */}
          {hasChildren && open && !collapsed && (
            <div className="border-l border-gray-300 ml-2">
              {renderItems(item.children, level + 1, key)}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div
      className={`h-full flex flex-col border-r bg-[#dcdcdc] transition-all duration-300 ${
        collapsed ? "w-[50px]" : "w-[240px]"
      } `}
    >
      {/* TOGGLE BUTTON */}
      <div className="flex items-center justify-start px-2 py-2 border-b shrink-0">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="cursor-pointer"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* MENU */}
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {renderItems(sidebarConfig)}
        </div>
      )}
    </div>
  );
}

// "use client";

// import { useState } from "react";
// import { usePathname, useRouter } from "next/navigation";
// import { sidebarConfig } from "@/config/sidebar.config";
// import { ChevronRight, ChevronDown, Menu } from "lucide-react";

// export default function AppSidebar({ collapsed, setCollapsed }) {
//   const pathname = usePathname();
//   const router = useRouter();

//   const [manualOpen, setManualOpen] = useState({});

//   // ACTIVE CHECK
//   const hasActiveChild = (item) => {
//     if (!item) return false;

//     if (item.path && pathname.startsWith(item.path)) return true;

//     if (item.children) {
//       return item.children.some((child) => hasActiveChild(child));
//     }

//     return false;
//   };

//   // OPEN STATE
//   const isMenuOpen = (key, item) => {
//     if (manualOpen[key] !== undefined) return manualOpen[key];
//     return hasActiveChild(item);
//   };

//   const toggleMenu = (key) => {
//     setManualOpen((prev) => ({
//       ...prev,
//       [key]: !prev[key],
//     }));
//   };

//   const isActive = (path) => path && pathname.startsWith(path);

//   // COLORS
//   const getBgColor = (level, isParentActive, isChildActive) => {
//     if (collapsed) return "";

//     if (isChildActive) return "bg-yellow-400";
//     if (level === 0 && isParentActive) return "bg-[#5f8f3a]";

//     if (level === 0) return "bg-[#9fbc83]";
//     if (level === 1) return "bg-[#4f86b9]";
//     return "bg-[#a9bdd1]";
//   };

//   // RENDER ITEMS
//   const renderItems = (items, level = 0, parentKey = "") => {
//     if (!items) return null;

//     return items.map((item, index) => {
//       if (!item) return null;

//       const key = `${parentKey}-${index}`;
//       const hasChildren = item.children && item.children.length > 0;
//       const open = isMenuOpen(key, item);

//       const isParentActive = hasActiveChild(item);
//       const isChildActive = isActive(item.path);

//       return (
//         <div key={key}>
//           {/* ITEM */}
//           <div
//             onClick={() => {
//               if (hasChildren) {
//                 toggleMenu(key);
//               } else if (item.path) {
//                 router.push(item.path);
//               }
//             }}
//             className={`flex items-center ${
//               collapsed ? "justify-center" : "justify-between"
//             } cursor-pointer px-3 py-2
//             ${getBgColor(level, isParentActive, isChildActive)}
//             hover:brightness-95`}
//             style={{
//               paddingLeft: collapsed
//                 ? "0px"
//                 : `${12 + level * 20}px`,
//             }}
//           >
//             {/* LEFT CONTENT */}
//             <div className="flex items-center gap-2">
//               {/* ICON ALWAYS VISIBLE */}
//               {level === 0 && item.icon && (
//                 <item.icon size={16} />
//               )}

//               {/* TEXT ONLY WHEN EXPANDED */}
//               {!collapsed && (
//                 <span className="text-sm font-medium">
//                   {item.title}
//                 </span>
//               )}
//             </div>

//             {/* ARROW ONLY WHEN EXPANDED */}
//             {hasChildren && !collapsed && (
//               <span>
//                 {open ? (
//                   <ChevronDown size={16} />
//                 ) : (
//                   <ChevronRight size={16} />
//                 )}
//               </span>
//             )}
//           </div>

//           {/* CHILDREN */}
//           {hasChildren && open && !collapsed && (
//             <div className="border-l border-gray-300 ml-2">
//               {renderItems(item.children, level + 1, key)}
//             </div>
//           )}
//         </div>
//       );
//     });
//   };

//   return (
//     <div
//       className={`h-full flex flex-col border-r bg-[#dcdcdc] transition-all duration-300 ${
//         collapsed ? "w-[50px]" : "w-[240px]"
//       }`}
//     >
//       {/* TOGGLE BUTTON */}
//       <div className="flex items-center justify-center px-2 py-2 border-b shrink-0">
//         <button
//           onClick={() => setCollapsed((prev) => !prev)}
//           className="cursor-pointer"
//         >
//           <Menu size={20} />
//         </button>
//       </div>

//       {/* MENU (ALWAYS RENDERED) */}
//       <div className="flex-1 overflow-y-auto">
//         {renderItems(sidebarConfig)}
//       </div>
//     </div>
//   );
// }
