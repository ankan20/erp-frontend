"use client";

/**
 * SaleBillSourceTree
 *
 * Hierarchical tree: Sale Order → Certified Bill
 * User selects which cert bills to include and sets "Bill Now" amount per cert bill.
 * No item-level expansion. GST type selection is handled in SaleBillBasicGstTable.
 *
 * Props:
 *   saleOrders        — array of sale orders
 *   projectCode       — current project code
 *   disabled          — bool
 *   onSelectionChange — fn({ sources }) called when selection changes
 *   initialSources    — sources already on form (edit mode)
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

export default function SaleBillSourceTree({
  saleOrders        = [],
  projectCode       = "",
  disabled          = false,
  onSelectionChange = () => {},
  initialSources    = [],
}) {
  const [expandedOrders, setExpandedOrders] = useState(new Set());
  const [certBills, setCertBills]           = useState({});

  // selection: { [certBillId]: { selected, billNow, gstAmount } }
  const [selection, setSelection] = useState({});

  const [search, setSearch] = useState("");
  const prevPayloadRef = useRef(null);

  // Initialise from edit-mode data
  useEffect(() => {
    if (!initialSources.length) return;
    const sel = {};
    for (const s of initialSources) {
      if (!s.certifiedBillId) continue;
      sel[s.certifiedBillId] = {
        selected:   true,
        billNow:    Number(s.basicAmount || 0),
        gstAmount:  Number(s.gstAmount   || 0),
      };
    }
    if (Object.keys(sel).length) setSelection(sel);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCertBills = useCallback(async (erpDocNumber) => {
    if (!erpDocNumber || !projectCode) return;
    if (certBills[erpDocNumber]?.data) return;

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

  const toggleCert = (cert) => {
    if (disabled || cert.billingStatus === "FULLY_BILLED") return;
    setSelection((prev) => {
      const existing = prev[cert.id];
      if (existing?.selected) {
        return { ...prev, [cert.id]: { selected: false, billNow: 0, gstAmount: 0 } };
      }
      return {
        ...prev,
        [cert.id]: {
          selected:  true,
          billNow:   Number(cert.remaining || 0),
          gstAmount: Number(cert.thisBillGstAmount || 0),
        },
      };
    });
  };

  const handleBillNow = (certId, value, maxVal, certGstAmount, certClaim) => {
    if (disabled) return;
    const v = Math.min(Math.max(0, Number(value) || 0), maxVal);
    // Proportionally scale GST
    const ratio = certClaim > 0 ? v / certClaim : 0;
    const gst   = Number((Number(certGstAmount || 0) * ratio).toFixed(2));
    setSelection((prev) => ({
      ...prev,
      [certId]: { ...(prev[certId] || {}), billNow: v, gstAmount: gst },
    }));
  };

  // Emit sources whenever selection/certBills changes
  useEffect(() => {
    const sources = [];

    const certMeta = {};
    for (const order of saleOrders) {
      const bills = certBills[order.erpDocNumber]?.data || [];
      for (const cert of bills) {
        certMeta[cert.id] = {
          saleOrderId:      order.id,
          saleOrderNo:      order.erpDocNumber,
          certBillId:       cert.id,
          certBillNo:       cert.billingNo || cert.erpNo || "",
          billingDate:      cert.billingDate || "",
          thisBillClaim:    cert.thisBillClaim,
          thisBillGstAmount: cert.thisBillGstAmount,
        };
      }
    }

    for (const [certBillId, sel] of Object.entries(selection)) {
      if (!sel.selected || sel.billNow <= 0) continue;
      const meta = certMeta[Number(certBillId)];
      sources.push({
        saleOrderId:      meta?.saleOrderId   || null,
        saleOrderNo:      meta?.saleOrderNo   || "",
        certifiedBillId:  Number(certBillId),
        certifiedBillNo:  meta?.certBillNo    || "",
        billingDate:      meta?.billingDate   || "",
        basicAmount:      sel.billNow,
        gstAmount:        sel.gstAmount || 0,
        thisBillClaim:    meta?.thisBillClaim    || 0,
        thisBillGstAmount: meta?.thisBillGstAmount || 0,
      });
    }

    const payload = JSON.stringify(sources);
    if (payload !== prevPayloadRef.current) {
      prevPayloadRef.current = payload;
      onSelectionChange({ sources });
    }
  }, [selection, certBills, saleOrders]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredOrders = saleOrders.filter((o) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (o.erpDocNumber || "").toLowerCase().includes(s) ||
           (o.orderNo || "").toLowerCase().includes(s);
  });

  // Summary
  let totalBasic = 0, totalGst = 0, selectedCount = 0;
  for (const sel of Object.values(selection)) {
    if (!sel.selected || sel.billNow <= 0) continue;
    selectedCount++;
    totalBasic += sel.billNow;
    totalGst   += sel.gstAmount || 0;
  }

  return (
    <div className="border border-gray-300 rounded-sm overflow-hidden">
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

      <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
        <table className="w-full min-w-[700px] border-collapse text-[11.5px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-[#f0f4fb] text-[#2d4a7a]">
              <th className="border border-gray-300 px-2 py-1.5 text-center w-[36px]">✓</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left">Source / Description</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-[110px]">Claim ₹</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-[110px]">Billed ₹</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right w-[110px]">Remaining ₹</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center w-[130px]">Bill Now ₹</th>
              <th className="border border-gray-300 px-2 py-1.5 text-center w-[86px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={7} className="border border-gray-200 py-6 text-center text-gray-400 italic">
                  {search ? "No orders match your search" : "No approved Sale Orders available"}
                </td>
              </tr>
            ) : (
              filteredOrders.map((order) => {
                const isExpanded = expandedOrders.has(order.erpDocNumber);
                const certData   = certBills[order.erpDocNumber];
                const certs      = certData?.data || [];

                // Order-level checkbox
                const eligible   = certs.filter((c) => c.billingStatus !== "FULLY_BILLED");
                const allSel     = eligible.length > 0 && eligible.every((c) => selection[c.id]?.selected);
                const someSel    = !allSel && eligible.some((c) => selection[c.id]?.selected);

                return (
                  <>
                    {/* Sale Order row */}
                    <tr key={order.erpDocNumber} className="bg-[#eef4ff] font-semibold">
                      <td className="border border-gray-200 px-2 py-1 text-center">
                        <CheckboxCell
                          checked={allSel}
                          indeterminate={someSel}
                          disabled={disabled}
                          onChange={() => {
                            setSelection((prev) => {
                              const next = { ...prev };
                              for (const cert of eligible) {
                                if (allSel) {
                                  next[cert.id] = { selected: false, billNow: 0, gstAmount: 0 };
                                } else {
                                  next[cert.id] = {
                                    selected:  true,
                                    billNow:   Number(cert.remaining || 0),
                                    gstAmount: Number(cert.thisBillGstAmount || 0),
                                  };
                                }
                              }
                              return next;
                            });
                          }}
                        />
                      </td>
                      <td className="border border-gray-200 px-2 py-1">
                        <button
                          type="button"
                          onClick={() => toggleOrder(order.erpDocNumber)}
                          className="flex items-center gap-1 text-[#2d4a7a] hover:text-blue-700"
                        >
                          {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          <span className="font-semibold">{order.erpDocNumber}</span>
                          {order.orderNo && (
                            <span className="text-gray-500 font-normal ml-1">| {order.orderNo}</span>
                          )}
                        </button>
                      </td>
                      <td colSpan={5} className="border border-gray-200 px-2 py-1 text-gray-500">
                        Sale Order
                      </td>
                    </tr>

                    {/* Cert bill rows */}
                    {isExpanded && (
                      certData?.loading ? (
                        <tr key={`${order.erpDocNumber}-loading`}>
                          <td colSpan={7} className="border border-gray-200 py-2 pl-6 text-gray-400">
                            <Loader2 size={12} className="animate-spin inline mr-1" />Loading certified bills…
                          </td>
                        </tr>
                      ) : certs.length === 0 ? (
                        <tr key={`${order.erpDocNumber}-empty`}>
                          <td colSpan={7} className="border border-gray-200 py-2 pl-6 text-gray-400 italic">
                            No approved certified bills for this order
                          </td>
                        </tr>
                      ) : (
                        certs.map((cert) => {
                          const sel        = selection[cert.id] || {};
                          const isSelected = !!sel.selected;
                          const billNow    = sel.billNow || 0;
                          const isFull     = cert.billingStatus === "FULLY_BILLED";

                          return (
                            <tr
                              key={cert.id}
                              className={isFull ? "bg-red-50 opacity-60" : isSelected ? "bg-blue-50" : "bg-[#f7f9ff]"}
                            >
                              <td className="border border-gray-200 px-2 py-[3px] text-center">
                                {isFull ? (
                                  <span title="Fully billed">🔒</span>
                                ) : (
                                  <CheckboxCell
                                    checked={isSelected}
                                    indeterminate={false}
                                    disabled={disabled || isFull}
                                    onChange={() => toggleCert(cert)}
                                  />
                                )}
                              </td>
                              <td className="border border-gray-200 px-2 py-[3px]">
                                <span className="text-gray-400 mr-2">└</span>
                                <span className={`font-medium ${isFull ? "text-gray-400 line-through" : ""}`}>
                                  {cert.billingNo || cert.erpNo}
                                </span>
                                {cert.billingDate && (
                                  <span className="text-gray-400 ml-2 text-[10px]">{cert.billingDate}</span>
                                )}
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
                              <td className="border border-gray-200 px-0.5 py-[3px]">
                                {isSelected && !isFull ? (
                                  <input
                                    type="number"
                                    min="0"
                                    max={cert.remaining}
                                    step="0.01"
                                    value={billNow}
                                    onChange={(e) =>
                                      handleBillNow(cert.id, e.target.value, cert.remaining, cert.thisBillGstAmount, cert.thisBillClaim)
                                    }
                                    onClick={(e) => e.stopPropagation()}
                                    disabled={disabled}
                                    className="w-full text-right text-[11.5px] px-1.5 h-[22px] border border-blue-300 rounded outline-none focus:border-blue-500 bg-white"
                                  />
                                ) : (
                                  <span className="block text-right px-2 text-gray-400">—</span>
                                )}
                              </td>
                              <td className="border border-gray-200 px-2 py-[3px] text-center">
                                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_BADGE[cert.billingStatus] || ""}`}>
                                  {cert.billingStatus?.replace("_", " ")}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )
                    )}
                  </>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Summary bar */}
      {selectedCount === 0 ? (
        <div className="bg-gray-50 border-t border-gray-200 px-3 py-1.5 text-[11px] text-gray-400 italic">
          No cert bills selected — expand a sale order and select bills above
        </div>
      ) : (
        <div className="bg-blue-50 border-t border-blue-200 px-3 py-1.5 flex gap-6 text-[11.5px]">
          <span className="text-gray-600">{selectedCount} cert bill{selectedCount !== 1 ? "s" : ""} selected</span>
          <span>Basic: <strong className="text-gray-800">{fmtAmt(totalBasic)}</strong></span>
          <span>GST: <strong className="text-blue-700">{fmtAmt(totalGst)}</strong></span>
          <span>Total: <strong className="text-green-700">{fmtAmt(totalBasic + totalGst)}</strong></span>
        </div>
      )}
    </div>
  );
}
