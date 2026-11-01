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
 *  - Columns swapped after a resize (e.g. an edit-only "Action" column replaced by
 *    another column): widths are positional, so the table returns to its natural
 *    layout instead of giving the new column the old one's width
 *  - Tables with a CSS min-width (e.g. min-w-[1000px]): once the user resizes, the
 *    dragged widths are authoritative, so shrinking a column no longer spreads the
 *    freed space across every other column
 *
 * Optional per-column attributes on a <th> (no effect when absent):
 *  - data-col-resize-last="true"  give the LAST column a handle too (normally it has none)
 *  - data-col-min="108"           minimum width in px for that column (default 40)
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

    // ── Sizing state (set on first drag, undone by resetSizing) ───────────────
    let sizedLeaves  = null;   // leaf <th> elements the widths were taken from
    let addedCols    = [];     // <col> elements this hook appended
    let colPrevWidth = new Map(); // pre-existing <col> → its original style.width
    const tablePrev  = {
      width:       table.style.width,
      tableLayout: table.style.tableLayout,
      minWidth:    table.style.minWidth,
    };

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
        addedCols.push(col);
      }
    }

    /** Snapshot every column's rendered width, then lock table-layout. */
    function initColWidths() {
      ensureColgroup();
      const leaves = getLeafHeaders();
      const cols   = getColList();
      leaves.forEach(({ th }, i) => {
        if (!cols[i].style.width) {
          if (!addedCols.includes(cols[i])) colPrevWidth.set(cols[i], cols[i].style.width);
          cols[i].style.width = th.getBoundingClientRect().width + "px";
        }
      });
      table.style.width       = table.getBoundingClientRect().width + "px";
      table.style.tableLayout = "fixed";
      // From now on the column widths decide the table width. A CSS min-width
      // would otherwise win when a column shrinks, and fixed layout would hand
      // the difference to every other column.
      table.style.minWidth    = "0px";
      sizedLeaves = leaves.map(({ th }) => th);
    }

    /** Undo everything initColWidths / ensureColgroup did: back to natural layout. */
    function resetSizing() {
      addedCols.forEach((col) => col.parentNode && col.parentNode.removeChild(col));
      colPrevWidth.forEach((w, col) => { col.style.width = w; });
      if (createdColgroup && colgroup && table.contains(colgroup)) table.removeChild(colgroup);
      addedCols       = [];
      colPrevWidth    = new Map();
      colgroup        = null;
      createdColgroup = false;
      sizedLeaves     = null;
      table.style.width       = tablePrev.width;
      table.style.tableLayout = tablePrev.tableLayout;
      table.style.minWidth    = tablePrev.minWidth;
    }

    /** True when the header columns are no longer the ones the widths belong to. */
    function leavesChanged() {
      if (!sizedLeaves) return false;
      const now = getLeafHeaders().map(({ th }) => th);
      return now.length !== sizedLeaves.length || now.some((th, i) => th !== sizedLeaves[i]);
    }

    // ── Drag state ────────────────────────────────────────────────────────────
    let dragging        = false;
    let startX          = 0;
    let startColWidth   = 0;
    let startTableWidth = 0;
    let activeCol       = null;
    let activeMin       = MIN_COL_PX;
    let indicator       = null;

    function onMouseMove(e) {
      if (!dragging || !activeCol) return;
      if (e.buttons === 0) { onMouseUp(); return; }
      const delta       = e.clientX - startX;
      const newWidth    = Math.max(activeMin, startColWidth + delta);
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
        activeMin       = Math.max(MIN_COL_PX, Number(th.dataset.colMin) || 0);

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

      // Widths are stored per column position; if columns were added, removed or
      // swapped since the user resized, start again from the natural layout.
      if (leavesChanged()) resetSizing();

      const leaves = getLeafHeaders();
      leaves.forEach(({ th, colIdx }, i) => {
        // last column gets no handle, unless the table opts in for it
        if (i === leaves.length - 1 && th.dataset.colResizeLast !== "true") return;
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
      resetSizing();
    };
  }, []);

  return { tableRef };
}
