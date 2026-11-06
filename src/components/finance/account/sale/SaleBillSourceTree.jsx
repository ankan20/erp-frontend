"use client";

/**
 * SaleBillSourceTree
 *
 * Hierarchical tree table for selecting Sale Order → Certified Bill → Items
 * for a Sales Invoice. Supports partial billing (editable "Bill Now" column),
 * per-item GST rates, and expand/collapse at every level.
 *
 * Props:
 *   saleOrders        — array of sale orders from list API
 *   projectCode       — current project code
 *   disabled          — bool
 *   onSelectionChange — fn({ items, sources }) called whenever selection changes
 *   initialItems      — items already on form (for edit mode)
 *   initialSources    — sources already on form (for edit mode)
 */

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ChevronRight,
  ChevronDown,
  Loader2,
  CheckSquare,
  Square,
  MinusSquare,
} from "lucide-react";
import { apiRequest } from "@/lib/apiClient";
import { API_ENDPOINTS } from "@/config/api.config";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (val) => {
  const n = Number(val);
  if (isNaN(n) || n === 0) return "—";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtAmt = (val) => {
  const n = Number(val);
  if (isNaN(n)) return "0.00";
  return n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const STATUS_BADGE = {
  UNBILLED:         "bg-green-100 text-green-700 border-green-300",
  PARTIALLY_BILLED: "bg-amber-100 text-amber-700 border-amber-300",
  FULLY_BILLED:     "bg-red-100   text-red-700   border-red-300",
};

// ─── Checkbox with indeterminate state ───────────────────────────────────────

function CheckboxCell({ checked, indeterminate, onChange, disabled }) {
  if (disabled) {
    return checked
      ? <CheckSquare size={15} className="text-gray-400 mx-auto" />
      : <Square      size={15} className="text-gray-300 mx-auto" />;
  }
  if (indeterminate) {
    return (
      <button type="button" onClick={onChange} className="block mx-auto">
        <MinusSquare size={15} className="text-blue-500" />
      </button>
    );
  }
  return (
    <button type="button" onClick={onChange} className="block mx-auto">
      {checked
        ? <CheckSquare size={15} className="text-blue-600" />
        : <Square      size={15} className="text-gray-400 hover:text-blue-400" />
      }
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SaleBillSourceTree({
  saleOrders        = [],
  projectCode       = "",
  disabled          = false,
  onSelectionChange = () => {},
  initialItems      = [],
  initialSources    = [],
}) {
  // expandedOrders / expandedCerts: Set of ids
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [expandedCerts,  setExpandedCerts]  = useState(new Set());

  // certBills: { [erpDocNumber]: { loading, data: [{id, billingNo, ...}] } }
  const [certBills, setCertBills] = useState({});

  // certItems: { [certBillId]: { loading, data: [{billingItemId, ...}] } }
  const [certItems, setCertItems] = useState({});

  // selection: { [certBillId]: { [billingItemId]: { selected, billNow } } }
  const [selection, setSelection] = useState({});

  // search
  const [search, setSearch] = useState("");

  const prevPayloadRef = useRef(null);

  // ── Initialise selection from existing form data (edit mode) ────────────────
  useEffect(() => {
    if (!initialItems.length && !initialSources.length) return;
    // Build selection from initialItems
    const sel = {};
    for (const item of initialItems) {
      const certBillId   = item.certBillId;
      const billingItemId = item.billingItemId;
      if (!certBillId) continue;
      if (!sel[certBillId]) sel[certBillId] = {};
      sel[certBillId][billingItemId ?? "__legacy__"] = {
        selected: true,
        billNow:  Number(item.basicAmount || 0),
        gstPercent: Number(item.gstPercent || 0),
      };
    }
    if (Object.keys(sel).length) setSelection(sel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load certified bills for a sale order ──────────────────────────────────
  const loadCertBills = useCallback(async (erpDocNumber) => {
    if (!erpDocNumber || !projectCode) return;
    if (certBills[erpDocNumber]?.data) return; // already loaded

    setCertBills((prev) => ({ ...prev, [erpDocNumber]: { loading: true, data: null } }));
    try {
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.SALE_BILL.CERTIFIED_BILLS}?erpDocNumber=${encodeURIComponent(erpDocNumber)}&projectCode=${projectCode}`,
        method: "GET",
      });
      setCertBills((prev) => ({
        ...prev,
        [erpDocNumber]: { loading: false, data: Array.isArray(res.data) ? res.data : [] },
      }));
    } catch {
      setCertBills((prev) => ({ ...prev, [erpDocNumber]: { loading: false, data: [] } }));
    }
  }, [projectCode, certBills]);

  // ── Load items for a certified bill ────────────────────────────────────────
  const loadCertItems = useCallback(async (certBillId) => {
    if (!certBillId || !projectCode) return;
    if (certItems[certBillId]?.data) return; // already loaded

    setCertItems((prev) => ({ ...prev, [certBillId]: { loading: true, data: null } }));
    try {
      const res = await apiRequest({
        url: `${API_ENDPOINTS.FINANCE.SALE_BILL.CERTIFIED_BILL_ITEMS}?certifiedBillId=${certBillId}&projectCode=${projectCode}`,
        method: "GET",
      });
      const d = res.data || {};
      setCertItems((prev) => ({
        ...prev,
        [certBillId]: {
          loading: false,
          data:    Array.isArray(d.items) ? d.items : [],
          meta:    d,
        },
      }));
    } catch {
      setCertItems((prev) => ({ ...prev, [certBillId]: { loading: false, data: [], meta: {} } }));
    }
  }, [projectCode, certItems]);

  // ── Toggle order expansion ─────────────────────────────────────────────────
  const toggleOrder = (erpDocNumber) => {
    setExpandedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(erpDocNumber)) {
        next.delete(erpDocNumber);
      } else {
        next.add(erpDocNumber);
        loadCertBills(erpDocNumber);
      }
      return next;
    });
  };

  // ── Toggle cert bill expansion ─────────────────────────────────────────────
  const toggleCert = (certBillId) => {
    setExpandedCerts((prev) => {
      const next = new Set(prev);
      if (next.has(certBillId)) {
        next.delete(certBillId);
      } else {
        next.add(certBillId);
        loadCertItems(certBillId);
      }
      return next;
    });
  };

  // ── Item-level selection ───────────────────────────────────────────────────
  const toggleItem = (certBillId, item) => {
    if (disabled || item.billingStatus === "FULLY_BILLED") return;
    setSelection((prev) => {
      const certSel = { ...(prev[certBillId] || {}) };
      const existing = certSel[item.billingItemId];
      if (existing?.selected) {
        certSel[item.billingItemId] = { selected: false, billNow: 0, gstPercent: item.gstPercent };
      } else {
        certSel[item.billingItemId] = {
          selected:   true,
          billNow:    Number(item.remaining || 0),
          gstPercent: item.gstPercent,
        };
      }
      return { ...prev, [certBillId]: certSel };
    });
  };

  // ── Cert-level selection (selects all eligible items) ─────────────────────
  const toggleCert_select = (certBillId, items) => {
    if (disabled) return;
    const certSel  = selection[certBillId] || {};
    const eligible = items.filter((it) => it.billingStatus !== "FULLY_BILLED");
    const allSel   = eligible.length > 0 && eligible.every((it) => certSel[it.billingItemId]?.selected);

    setSelection((prev) => {
      const updated = { ...(prev[certBillId] || {}) };
      for (const it of eligible) {
        updated[it.billingItemId] = {
          selected:   !allSel,
          billNow:    !allSel ? Number(it.remaining || 0) : 0,
          gstPercent: it.gstPercent,
        };
      }
      return { ...prev, [certBillId]: updated };
    });
  };

  // ── Bill Now amount change ─────────────────────────────────────────────────
  const handleBillNow = (certBillId, billingItemId, value, maxVal) => {
    if (disabled) return;
    const v = Math.min(Math.max(0, Number(value) || 0), maxVal);
    setSelection((prev) => ({
      ...prev,
      [certBillId]: {
        ...(prev[certBillId] || {}),
        [billingItemId]: {
          ...(prev[certBillId]?.[billingItemId] || {}),
          billNow: v,
        },
      },
    }));
  };

  // ── Build & emit form payload whenever selection changes ───────────────────
  useEffect(() => {
    const items   = [];
    const sources = [];
    let slNo = 1;

    // For each selected item, we need to know which cert bill and sale order it belongs to
    // Build a reverse lookup: certBillId → { saleOrderId, saleOrderNo, certBillNo, billingDate }
    const certMeta = {};
    for (const order of saleOrders) {
      const bills = certBills[order.erpDocNumber]?.data || [];
      for (const cert of bills) {
        certMeta[cert.id] = {
          saleOrderId:   order.id,
          saleOrderNo:   order.erpDocNumber,
          certBillId:    cert.id,
          certBillNo:    cert.billingNo || cert.erpNo || "",
          billingDate:   cert.billingDate || "",
        };
      }
    }

    for (const [certBillId, itemsSel] of Object.entries(selection)) {
      const meta       = certMeta[Number(certBillId)];
      const itemsData  = certItems[certBillId]?.data || [];
      let   srcBasic   = 0;
      const selectedItems = [];

      for (const [billingItemId, sel] of Object.entries(itemsSel)) {
        if (!sel.selected || sel.billNow <= 0) continue;
        const srcItem = itemsData.find((it) => String(it.billingItemId) === String(billingItemId));
        srcBasic += sel.billNow;
        selectedItems.push({
          slNo:           slNo++,
          ccCode:         "CRIN",
          ccName:         srcItem?.itemName || "Service",
          description:    srcItem?.description || "",
          hsnSac:         srcItem?.hsnSac || "",
          basicAmount:    sel.billNow,
          gstPercent:     sel.gstPercent || srcItem?.gstPercent || 0,
          billingItemId:  Number(billingItemId),
          certBillId:     Number(certBillId),
          sourceIndex:    null, // assigned below after sources array built
        });
      }

      if (selectedItems.length === 0) continue;

      const sourceIdx = sources.length;
      sources.push({
        saleOrderId:     meta?.saleOrderId   || null,
        saleOrderNo:     meta?.saleOrderNo   || "",
        certifiedBillId: Number(certBillId),
        certifiedBillNo: meta?.certBillNo    || "",
        billingDate:     meta?.billingDate   || "",
        basicAmount:     srcBasic,
      });

      for (const it of selectedItems) {
        items.push({ ...it, sourceIndex: sourceIdx });
      }
    }

    const payload = JSON.stringify({ items, sources });
    if (payload !== prevPayloadRef.current) {
      prevPayloadRef.current = payload;
      onSelectionChange({ items, sources });
    }
  }, [selection, certBills, certItems, saleOrders]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter sale orders by search ──────────────────────────────────────────
  const filteredOrders = saleOrders.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (o.erpDocNumber || "").toLowerCase().includes(s) ||
           (o.orderNo || "").toLowerCase().includes(s);
  });

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="border border-gray-300 rounded-sm overflow-hidden">
      {/* Header */}
      <div className="bg-[#e8f0fb] px-3 py-[6px] flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#2d4a7a]">
          Source Selection — Sale Orders &amp; Certified Bills
        </span>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search orders…"
          className="text-[11px] border border-gray-300 rounded px-2 py-0.5 w-[160px] outline-none focus:border-blue-400"
        />
      </div>

      {/* Scrollable tree table */}
      <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
        <table className="w-full min-w-[820px] border-collapse text-[11.5px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#f0f4fb] text-[#2d4a7a]">
              <th className="border border-gray-300 px-2 py-1.5 text-center w-[36px]">✓</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left">Source / Description</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-[110px]">Original ₹</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-[110px]">Billed ₹</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-[110px]">Remaining ₹</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center w-[120px]">Bill Now ₹</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center w-[60px]">GST %</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-[100px]">GST Amt ₹</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center w-[86px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={9} className="border border-gray-200 py-6 text-center text-gray-400 italic">
                  {search ? "No orders match your search" : "No approved Sale Orders available"}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const isExpanded = expandedOrders.has(order.erpDocNumber);
                const certData   = certBills[order.erpDocNumber];
                const certs      = certData?.data || [];

                return (
                  <OrderRows
                    key={order.erpDocNumber}
                    order={order}
                    isExpanded={isExpanded}
                    onToggle={() => toggleOrder(order.erpDocNumber)}
                    certsLoading={certData?.loading}
                    certs={certs}
                    expandedCerts={expandedCerts}
                    certItems={certItems}
                    selection={selection}
                    disabled={disabled}
                    onToggleCert={toggleCert}
                    onToggleCertSelect={toggleCert_select}
                    onToggleItem={toggleItem}
                    onBillNow={handleBillNow}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Selection summary */}
      <SelectionSummary selection={selection} certItems={certItems} />
    </div>
  );
}

// ─── Order row + its cert bill children ───────────────────────────────────────

function OrderRows({
  order, isExpanded, onToggle,
  certsLoading, certs,
  expandedCerts, certItems, selection,
  disabled,
  onToggleCert, onToggleCertSelect, onToggleItem, onBillNow,
}) {
  // Determine order-level checkbox state
  const orderSel = certs.flatMap((c) => {
    const items = certItems[c.id]?.data || [];
    return items.filter((it) => it.billingStatus !== "FULLY_BILLED");
  });
  const orderChecked = orderSel.length > 0 && orderSel.every(
    (it) => selection[it.certBillId]?.[it.billingItemId]?.selected
  );
  const orderIndeterminate = !orderChecked && orderSel.some(
    (it) => selection[it.certBillId]?.[it.billingItemId]?.selected
  );

  return (
    <>
      {/* Sale Order row */}
      <tr className="bg-[#eef4ff] font-semibold">
        <td className="border border-gray-200 px-2 py-1 text-center">
          <CheckboxCell
            checked={orderChecked}
            indeterminate={orderIndeterminate}
            disabled={disabled}
            onChange={() => {
              // Select/deselect all loaded cert items under this order
              for (const cert of certs) {
                const items = certItems[cert.id]?.data || [];
                if (items.length) onToggleCertSelect(cert.id, items);
              }
            }}
          />
        </td>
        <td className="border border-gray-200 px-2 py-1">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1 text-[#2d4a7a] hover:text-blue-700"
          >
            {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            <span className="font-semibold">{order.erpDocNumber}</span>
            {order.orderNo && (
              <span className="text-gray-500 font-normal ml-1">| {order.orderNo}</span>
            )}
          </button>
        </td>
        <td colSpan={7} className="border border-gray-200 px-2 py-1 text-gray-500">
          Sale Order
        </td>
      </tr>

      {/* Cert bill rows (when order expanded) */}
      {isExpanded && (
        certsLoading ? (
          <tr>
            <td colSpan={9} className="border border-gray-200 py-2 pl-6 text-gray-400">
              <Loader2 size={12} className="animate-spin inline mr-1" />Loading certified bills…
            </td>
          </tr>
        ) : certs.length === 0 ? (
          <tr>
            <td colSpan={9} className="border border-gray-200 py-2 pl-6 text-gray-400 italic">
              No approved certified bills for this order
            </td>
          </tr>
        ) : (
          certs.map((cert) => (
            <CertRows
              key={cert.id}
              cert={cert}
              order={order}
              isExpanded={expandedCerts.has(cert.id)}
              onToggle={() => onToggleCert(cert.id)}
              itemsState={certItems[cert.id]}
              selection={selection[cert.id] || {}}
              disabled={disabled}
              onToggleCertSelect={onToggleCertSelect}
              onToggleItem={onToggleItem}
              onBillNow={onBillNow}
            />
          ))
        )
      )}
    </>
  );
}

// ─── Cert Bill row + its item children ────────────────────────────────────────

function CertRows({
  cert, order, isExpanded, onToggle,
  itemsState, selection, disabled,
  onToggleCertSelect, onToggleItem, onBillNow,
}) {
  const items    = itemsState?.data   || [];
  const eligible = items.filter((it) => it.billingStatus !== "FULLY_BILLED");

  const allSel  = eligible.length > 0 && eligible.every((it) => selection[it.billingItemId]?.selected);
  const someSel = !allSel && eligible.some((it) => selection[it.billingItemId]?.selected);

  const billNowTotal = eligible.reduce((s, it) => {
    if (selection[it.billingItemId]?.selected) {
      return s + (selection[it.billingItemId]?.billNow || 0);
    }
    return s;
  }, 0);

  const gstNowTotal = eligible.reduce((s, it) => {
    if (selection[it.billingItemId]?.selected) {
      const pct    = selection[it.billingItemId]?.gstPercent || it.gstPercent || 0;
      const billNow = selection[it.billingItemId]?.billNow || 0;
      return s + (billNow * pct / 100);
    }
    return s;
  }, 0);

  const isFullyBilled = cert.billingStatus === "FULLY_BILLED";

  return (
    <>
      {/* Certified Bill row */}
      <tr className={isFullyBilled ? "bg-red-50 opacity-60" : "bg-[#f7f9ff]"}>
        <td className="border border-gray-200 px-2 py-[3px] text-center">
          {isFullyBilled ? (
            <span title="Fully billed">🔒</span>
          ) : (
            <CheckboxCell
              checked={allSel}
              indeterminate={someSel}
              disabled={disabled || isFullyBilled}
              onChange={() => {
                if (!itemsState?.data) {
                  onToggle(); // expand to load items first
                } else {
                  onToggleCertSelect(cert.id, items);
                }
              }}
            />
          )}
        </td>
        <td className="border border-gray-200 px-2 py-[3px]">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center gap-1 text-gray-700 hover:text-blue-600"
          >
            <span className="text-gray-400 mr-1">└</span>
            {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            <span className="font-medium">{cert.billingNo || cert.erpNo}</span>
          </button>
        </td>
        <td className="border border-gray-200 px-2 py-[3px] text-right text-gray-600">
          {fmtAmt(cert.thisBillClaim)}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] text-right text-orange-600">
          {fmtAmt(cert.alreadyBilled)}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] text-right text-green-700 font-medium">
          {fmtAmt(cert.remaining)}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] text-right font-medium text-blue-700">
          {billNowTotal > 0 ? fmtAmt(billNowTotal) : "—"}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] text-center text-gray-400">—</td>
        <td className="border border-gray-200 px-2 py-[3px] text-right text-blue-600">
          {gstNowTotal > 0 ? fmtAmt(gstNowTotal) : "—"}
        </td>
        <td className="border border-gray-200 px-2 py-[3px] text-center">
          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_BADGE[cert.billingStatus] || ""}`}>
            {cert.billingStatus?.replace("_", " ")}
          </span>
        </td>
      </tr>

      {/* Item rows (when cert expanded) */}
      {isExpanded && (
        itemsState?.loading ? (
          <tr>
            <td colSpan={9} className="border border-gray-200 py-2 pl-10 text-gray-400">
              <Loader2 size={12} className="animate-spin inline mr-1" />Loading items…
            </td>
          </tr>
        ) : items.length === 0 ? (
          <tr>
            <td colSpan={9} className="border border-gray-200 py-2 pl-10 text-gray-400 italic">
              No items in this certified bill
            </td>
          </tr>
        ) : (
          items.map((item) => {
            const sel         = selection[item.billingItemId] || {};
            const isSelected  = !!sel.selected;
            const billNow     = sel.billNow || 0;
            const gstPct      = item.gstPercent || 0;
            const gstNow      = (billNow * gstPct) / 100;
            const isFull      = item.billingStatus === "FULLY_BILLED";

            return (
              <ItemRow
                key={item.billingItemId}
                item={item}
                isSelected={isSelected}
                billNow={billNow}
                gstPct={gstPct}
                gstNow={gstNow}
                disabled={disabled || isFull}
                certBillId={cert.id}
                onToggle={() => !isFull && onToggleItem(cert.id, item)}
                onBillNow={(v) => onBillNow(cert.id, item.billingItemId, v, item.remaining)}
              />
            );
          })
        )
      )}
    </>
  );
}

// ─── Individual item row ───────────────────────────────────────────────────────

function ItemRow({
  item, isSelected, billNow, gstPct, gstNow,
  disabled, onToggle, onBillNow,
}) {
  const isFull = item.billingStatus === "FULLY_BILLED";

  return (
    <tr className={`${isFull ? "bg-red-50 opacity-50" : isSelected ? "bg-blue-50" : "bg-white"} hover:bg-blue-50 transition-colors`}>
      <td className="border border-gray-200 px-2 py-[3px] text-center">
        <CheckboxCell
          checked={isSelected}
          indeterminate={false}
          disabled={disabled || isFull}
          onChange={onToggle}
        />
      </td>
      <td className="border border-gray-200 px-2 py-[3px] pl-10">
        <span className="text-gray-400 mr-1">└ └</span>
        <span className={isFull ? "line-through text-gray-400" : ""}>
          {item.itemName || item.itemCode || `Item #${item.slNo}`}
        </span>
        {item.description && (
          <span className="text-gray-400 ml-1 text-[10px]">— {item.description}</span>
        )}
      </td>
      <td className="border border-gray-200 px-2 py-[3px] text-right text-gray-600">
        {fmtAmt(item.originalAmount)}
      </td>
      <td className="border border-gray-200 px-2 py-[3px] text-right text-orange-600">
        {item.alreadyBilled > 0 ? fmtAmt(item.alreadyBilled) : "—"}
      </td>
      <td className="border border-gray-200 px-2 py-[3px] text-right text-green-700 font-medium">
        {fmtAmt(item.remaining)}
      </td>
      <td className="border border-gray-200 px-0.5 py-[3px]">
        {isSelected && !isFull ? (
          <input
            type="number"
            min="0"
            max={item.remaining}
            step="0.01"
            value={billNow}
            onChange={(e) => onBillNow(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            disabled={disabled}
            className="w-full text-right text-[11.5px] px-1.5 h-[22px] border border-blue-300 rounded outline-none focus:border-blue-500 bg-white"
          />
        ) : (
          <span className="block text-right px-2 text-gray-400">—</span>
        )}
      </td>
      <td className="border border-gray-200 px-2 py-[3px] text-center text-gray-600">
        {gstPct > 0 ? `${gstPct}%` : "—"}
      </td>
      <td className="border border-gray-200 px-2 py-[3px] text-right text-blue-600">
        {gstNow > 0 ? fmtAmt(gstNow) : "—"}
      </td>
      <td className="border border-gray-200 px-2 py-[3px] text-center">
        <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_BADGE[item.billingStatus] || ""}`}>
          {item.billingStatus?.replace("_", " ")}
        </span>
      </td>
    </tr>
  );
}

// ─── Selection summary bar ────────────────────────────────────────────────────

function SelectionSummary({ selection, certItems }) {
  let totalBasic = 0;
  let totalGst   = 0;
  let itemCount  = 0;

  for (const [certBillId, itemsSel] of Object.entries(selection)) {
    const items = certItems[certBillId]?.data || [];
    for (const [billingItemId, sel] of Object.entries(itemsSel)) {
      if (!sel.selected || sel.billNow <= 0) continue;
      itemCount++;
      totalBasic += sel.billNow;
      const srcItem = items.find((it) => String(it.billingItemId) === String(billingItemId));
      const gstPct  = sel.gstPercent || srcItem?.gstPercent || 0;
      totalGst += (sel.billNow * gstPct) / 100;
    }
  }

  if (itemCount === 0) {
    return (
      <div className="bg-gray-50 border-t border-gray-200 px-3 py-1.5 text-[11px] text-gray-400 italic">
        No items selected — expand and select items above
      </div>
    );
  }

  return (
    <div className="bg-blue-50 border-t border-blue-200 px-3 py-1.5 flex gap-6 text-[11.5px]">
      <span className="text-gray-600">{itemCount} item{itemCount !== 1 ? "s" : ""} selected</span>
      <span>Basic: <strong className="text-gray-800">{fmtAmt(totalBasic)}</strong></span>
      <span>GST: <strong className="text-blue-700">{fmtAmt(totalGst)}</strong></span>
      <span>Total: <strong className="text-green-700">{fmtAmt(totalBasic + totalGst)}</strong></span>
    </div>
  );
}
