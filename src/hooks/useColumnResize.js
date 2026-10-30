"use client";

import { useCallback, useRef } from "react";

const MIN_COL_PX = 40;

/**
 * Excel-style column resize — drag one handle, only that column changes width.
 * Table total width grows/shrinks with the drag; adjacent columns are untouched.
 *
 * Handles:
 *  - Single-row headers        (standard case)
 *  - Multi-row grouped headers (rowSpan / colSpan — finds all leaf columns)
 *  - Portal/modal tables       (callback ref fires on actual mount)
 *  - Already-fixed tables      (colgroup created lazily on first drag)
 *  - Sticky columns            (never overrides position:sticky)
 *  - Dynamically added columns (MutationObserver re-attaches handles automatically)
 */
export function useColumnResize() {
  const cleanupRef = useRef(null);

  const tableRef = useCallback((table) => {
    if (cleanupRef.current) { cleanupRef.current(); cleanupRef.current = null; }
    if (!table) return;

    const thead = table.querySelector("thead");
    if (!thead) return;

    // ── Leaf-header discovery ─────────────────────────────────────────────────
    /**
     * Walk every <tr> in <thead>, tracking a grid of occupied cells caused by
     * rowSpan / colSpan, and return all <th> cells that span exactly one visual
     * column (colSpan === 1).  Result is sorted by visual column index.
     */
    function getLeafHeaders() {
      const rows     = Array.from(thead.querySelectorAll(":scope > tr"));
      const occupied = {};          // "rowIdx,colIdx" → true
      const result   = [];          // [{ th, colIdx }]

      rows.forEach((row, rowIdx) => {
        let col = 0;
        Array.from(row.querySelectorAll(":scope > th")).forEach((th) => {
          // Advance past cells already occupied by a previous rowSpan
          while (occupied[`${rowIdx},${col}`]) col++;

          const cs = th.colSpan  || 1;
          const rs = th.rowSpan  || 1;

          // Mark every cell this th occupies in future rows
          for (let r = rowIdx + 1; r < rowIdx + rs; r++) {
            for (let c = col; c < col + cs; c++) {
              occupied[`${r},${c}`] = true;
            }
          }

          // A true leaf column has colSpan === 1 (group headers are skipped)
          if (cs === 1) result.push({ th, colIdx: col });

          col += cs;
        });
      });

      result.sort((a, b) => a.colIdx - b.colIdx);
      return result;
    }

    // ── Colgroup state (lazy — created on first drag only) ────────────────────
    let colgroup        = null;
    let createdColgroup = false;

    function getColList() {
      return colgroup ? Array.from(colgroup.querySelectorAll("col")) : [];
    }

    /** Create (or update) the colgroup to match the current number of leaf columns. */
    function ensureColgroup() {
      if (!colgroup) {
        colgroup = table.querySelector(":scope > colgroup");
        if (!colgroup) {
          colgroup = document.createElement("colgroup");
          table.insertBefore(colgroup, table.firstChild);
          createdColgroup = true;
        }
      }
      const leafCount = getLeafHeaders().length;
      const cols      = getColList();
      while (cols.length < leafCount) {
        const col = document.createElement("col");
        colgroup.appendChild(col);
        cols.push(col);
      }
    }

    /** Snapshot every column's rendered width, then lock table-layout. */
    function initColWidths() {
      ensureColgroup();
      const leaves = getLeafHeaders();
      const cols   = getColList();
      leaves.forEach(({ th }, i) => {
        if (!cols[i].style.width) {
          cols[i].style.width = th.getBoundingClientRect().width + "px";
        }
      });
      table.style.width       = table.getBoundingClientRect().width + "px";
      table.style.tableLayout = "fixed";
    }

    // ── Drag state ────────────────────────────────────────────────────────────
    let dragging        = false;
    let startX          = 0;
    let startColWidth   = 0;
    let startTableWidth = 0;
    let activeCol       = null;
    let indicator       = null;

    function onMouseMove(e) {
      if (!dragging || !activeCol) return;
      if (e.buttons === 0) { onMouseUp(); return; }
      const delta       = e.clientX - startX;
      const newWidth    = Math.max(MIN_COL_PX, startColWidth + delta);
      const actualDelta = newWidth - startColWidth;
      activeCol.style.width = newWidth + "px";
      table.style.width     = (startTableWidth + actualDelta) + "px";
      if (indicator) indicator.style.left = e.clientX + "px";
    }

    function onMouseUp() {
      dragging  = false;
      activeCol = null;
      document.body.style.userSelect = "";
      if (indicator?.parentNode) indicator.parentNode.removeChild(indicator);
      indicator = null;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
    }

    // ── Handle injection ──────────────────────────────────────────────────────
    const handleCleanups = [];

    function attachHandle(th, colIdx) {
      const computedPos = getComputedStyle(th).position;
      const isSticky    = computedPos === "sticky";
      const prevPos     = th.style.position;
      if (!isSticky) th.style.position = "relative";

      const handle = document.createElement("div");
      handle.setAttribute("data-col-resize", "true");
      handle.style.cssText = [
        "position:absolute", "right:-2px", "top:0", "bottom:0",
        "width:5px", "cursor:col-resize", "z-index:10",
        "user-select:none", "background:transparent", "transition:background 0.15s",
      ].join(";");

      function onEnter() { handle.style.background = "rgba(59,130,246,0.35)"; }
      function onLeave() { if (!dragging) handle.style.background = "transparent"; }

      function onMouseDown(e) {
        e.preventDefault();
        e.stopPropagation();

        if (table.style.tableLayout !== "fixed") initColWidths();
        ensureColgroup();

        const col = getColList()[colIdx];
        if (!col) return;

        dragging        = true;
        document.body.style.userSelect = "none";
        startX          = e.clientX;
        startColWidth   = th.getBoundingClientRect().width;
        startTableWidth = table.getBoundingClientRect().width;
        activeCol       = col;

        if (!col.style.width) col.style.width = startColWidth + "px";

        indicator = document.createElement("div");
        indicator.style.cssText = [
          "position:fixed", "top:0", "bottom:0", "width:2px",
          "background:#3b82f6", "opacity:0.75", "z-index:99999",
          "pointer-events:none", `left:${e.clientX}px`,
        ].join(";");
        document.body.appendChild(indicator);

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup",   onMouseUp);
      }

      handle.addEventListener("mouseenter", onEnter);
      handle.addEventListener("mouseleave", onLeave);
      handle.addEventListener("mousedown",  onMouseDown);
      th.appendChild(handle);

      return () => {
        handle.removeEventListener("mouseenter", onEnter);
        handle.removeEventListener("mouseleave", onLeave);
        handle.removeEventListener("mousedown",  onMouseDown);
        if (th.contains(handle)) th.removeChild(handle);
        if (!isSticky) th.style.position = prevPos;
      };
    }

    /** Tear down all handles and re-create them for the current set of leaf <th>s. */
    function setupHandles() {
      handleCleanups.forEach(fn => fn());
      handleCleanups.length = 0;

      const leaves = getLeafHeaders();
      leaves.forEach(({ th, colIdx }, i) => {
        if (i === leaves.length - 1) return; // last column gets no handle
        handleCleanups.push(attachHandle(th, colIdx));
      });
    }

    setupHandles();

    // Re-run whenever any header row changes (covers dynamic column add/remove)
    const mo = new MutationObserver(setupHandles);
    Array.from(thead.querySelectorAll(":scope > tr")).forEach((row) => {
      mo.observe(row, { childList: true });
    });

    cleanupRef.current = () => {
      mo.disconnect();
      handleCleanups.forEach(fn => fn());
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup",   onMouseUp);
      document.body.style.userSelect = "";
      if (indicator?.parentNode) indicator.parentNode.removeChild(indicator);
      if (createdColgroup && colgroup && table.contains(colgroup)) table.removeChild(colgroup);
      table.style.tableLayout = "";
      table.style.width       = "";
    };
  }, []);

  return { tableRef };
}
