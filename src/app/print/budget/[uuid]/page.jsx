"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";

import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar       from "@/components/print/PrintTopBar";
import PrintErrorPage    from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, FmtNum, fmt } from "@/components/print/printStyles";
import { amountToWordsIN } from "@/lib/amountToWords";

const B   = "border border-[#b0b0b0]";
const LBL = `${SIZE.labelText} ${WEIGHT.semibold} text-gray-800`;
const VAL = `${SIZE.labelText} text-gray-700`;

function InfoRow({ label, value }) {
  return (
    <p className={VAL}>
      <span className={LBL}>{label}</span> : {value || "—"}
    </p>
  );
}

function SigRow({ label, name, dateStr }) {
  return (
    <div className="flex items-baseline py-[1px]">
      <span className={`${SIZE.labelText} text-gray-700 w-[140px] min-w-[140px]`}>{label}</span>
      <span className={`${SIZE.labelText} text-gray-700 mr-2`}>:</span>
      <span className={`${SIZE.labelText} text-gray-900`}>{name || "—"}</span>
      {dateStr && dateStr !== "-" && (
        <span className={`${SIZE.labelText} text-gray-500 ml-3`}>[{dateStr}]</span>
      )}
    </div>
  );
}

function printAsPDF() { window.print(); }

/**
 * Normalise one budget item: prefer the values the API stored, fall back to the
 * same arithmetic the form uses — order_qty × rate, and order_qty × cc_value.
 */
function normalise(item) {
  const qty  = Number(item.orderQty || 0);
  const rate = Number(item.rate || 0);
  const ccCodes = (item.ccCodes || []).map((c) => ({
    ccCode:  c.ccCode || "",
    ccName:  c.ccName || "",
    ccValue: Number(c.ccValue || 0),
    ccTotal: c.ccTotal !== undefined && c.ccTotal !== null
      ? Number(c.ccTotal)
      : qty * Number(c.ccValue || 0),
  }));
  const initialAmount = item.initialAmount !== undefined && item.initialAmount !== null
    ? Number(item.initialAmount)
    : qty * rate;
  const totalCcCost = item.totalCcCost !== undefined && item.totalCcCost !== null
    ? Number(item.totalCcCost)
    : ccCodes.reduce((s, c) => s + c.ccTotal, 0);
  const totalCost = item.totalCost !== undefined && item.totalCost !== null
    ? Number(item.totalCost)
    : initialAmount + totalCcCost;
  return { ...item, orderQty: qty, rate, ccCodes, initialAmount, totalCcCost, totalCost };
}

async function downloadExcel(data, items, totals) {
  const XLSX = await import("xlsx");

  const aoa = [
    ["Budget Master"],
    [`Budget No: ${data.budgetNo || "—"}    Date: ${fmt.date(data.budgetDate)}    Project: ${data.projectCode || "—"}`],
    [`Sale Order: ${data.saleOrderNo || "—"}    ${data.saleOrderTitle || ""}`],
    [],
    ["Sl.", "Item Code", "Item Name", "Description", "Unit", "Order Qty", "Rate", "Initial Amt", "CC Code", "CC Name", "CC Value/unit", "CC Total", "Item CC Cost", "Total Cost"],
  ];

  items.forEach((it, i) => {
    const base = [
      it.slNo || i + 1, it.itemCode || "", it.itemName || "", it.itemDescription || "",
      it.unitItem || it.unit || "", it.orderQty, it.rate, it.initialAmount,
    ];
    if (!it.ccCodes.length) {
      aoa.push([...base, "", "", "", "", it.totalCcCost, it.totalCost]);
      return;
    }
    it.ccCodes.forEach((c, ci) => {
      aoa.push([
        ...(ci === 0 ? base : ["", "", "", "", "", "", "", ""]),
        c.ccCode, c.ccName, c.ccValue, c.ccTotal,
        ci === 0 ? it.totalCcCost : "",
        ci === 0 ? it.totalCost   : "",
      ]);
    });
  });

  aoa.push([]);
  aoa.push(["", "", "", "", "", "", "", totals.initial, "", "", "", "", totals.cc, totals.grand]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [
    { wch: 6 }, { wch: 12 }, { wch: 26 }, { wch: 26 }, { wch: 8 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 24 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 },
  ];
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 13 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 13 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 13 } },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Budget");
  XLSX.writeFile(wb, `Budget_${data.budgetNo || "master"}.xlsx`);
}

export default function BudgetPrintPage() {
  const { uuid } = useParams();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);
  const qrCanvasRef = useRef(null);

  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.PROJECT.BUDGET_MASTER.GET_BY_UUID}${uuid}` })
      .then((res) => setData(res.data))
      .catch((err) => setError({ status: err.status, message: err.message }))
      .finally(() => setLoading(false));
  }, [uuid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <p className="text-[13px] text-gray-500">Loading document…</p>
        </div>
      </div>
    );
  }

  if (error || !data) return <PrintErrorPage status={error?.status} message={error?.message} />;

  const items = (data.items || [])
    .slice()
    .sort((a, b) => (a.slNo || 0) - (b.slNo || 0))
    .map(normalise);

  const totals = {
    initial: data.totalInitialCost !== undefined && data.totalInitialCost !== null
      ? Number(data.totalInitialCost)
      : items.reduce((s, it) => s + it.initialAmount, 0),
    cc: data.totalCcCost !== undefined && data.totalCcCost !== null
      ? Number(data.totalCcCost)
      : items.reduce((s, it) => s + it.totalCcCost, 0),
  };
  totals.grand = data.grandTotal !== undefined && data.grandTotal !== null
    ? Number(data.grandTotal)
    : totals.initial + totals.cc;

  const HEADS = [
    "Sl.", "Item Code", "Item Name & Description", "Unit",
    "Order Qty", "Rate (₹)", "Initial Amt (₹)", "CC Cost (₹)", "Total Cost (₹)",
  ];

  return (
    <>
      <PrintTopBar
        title={`Budget Master — ${data.budgetNo || ""}`}
        onDownloadPDF={printAsPDF}
        onDownloadExcel={() => downloadExcel(data, items, totals)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[860px] mx-auto shadow-md print:shadow-none print:max-w-none"
          style={{ fontFamily: "var(--font-print), sans-serif" }}
        >
          {/* ── HEADER ── */}
          <div className="flex items-center px-6 pt-4 pb-3">
            <div className="w-[130px] shrink-0">
              <Image
                src="/assets/pdf-images/erp_company_img_pdf.png"
                alt="Logo" width={130} height={65} className="object-contain" priority
              />
            </div>
            <div className="flex-1 flex items-center justify-center">
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>
                Budget Master
              </h1>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`${SIZE.subText} text-gray-600`}>www.dishaanhitech.com</span>
              <div className="relative p-[5px]">
                <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-gray-900" />
                <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-gray-900" />
                <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-gray-900" />
                <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-gray-900" />
                <QRCodeSVG value={pageUrl} size={60} bgColor="#ffffff" fgColor="#000000" level="M" />
              </div>
            </div>
          </div>

          {/* ── INFO ── */}
          <div className="grid px-6 pb-3" style={{ gridTemplateColumns: "50% 50%" }}>
            <div className="space-y-0.5">
              <InfoRow label="Budget No"   value={data.budgetNo} />
              <InfoRow label="Budget Date" value={fmt.date(data.budgetDate)} />
              <InfoRow label="Sale Order"  value={data.saleOrderNo} />
              <InfoRow label="Order Title" value={data.saleOrderTitle} />
            </div>
            <div className="space-y-0.5 pl-6">
              <InfoRow label="Project"      value={data.projectCode} />
              <InfoRow label="Status"       value={(data.workflowStatus || "").replace(/_/g, " ")} />
              <InfoRow label="Initial Cost" value={`₹ ${fmt.number(totals.initial)}`} />
              <InfoRow label="CC Code Cost" value={`₹ ${fmt.number(totals.cc)}`} />
            </div>
          </div>

          {/* ── ITEMS + CC ALLOCATION ── */}
          <div className="px-6 pb-3">
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "5%"  }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "25%" }} />
                <col style={{ width: "7%"  }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "10%" }} />
              </colgroup>
              <thead>
                <tr className={COLOR.tableHeadBg}>
                  {HEADS.map((h) => (
                    <th key={h} className={`${B} px-2 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={9} className={`${B} px-2 py-4 text-center ${SIZE.tableCell} text-gray-400 italic`}>
                      No items on this budget
                    </td>
                  </tr>
                )}

                {items.map((it, idx) => (
                  <ItemBlock key={idx} item={it} idx={idx} />
                ))}

                {/* TOTAL */}
                <tr className={`${COLOR.tableHeadBg} ${WEIGHT.bold}`}>
                  <td colSpan={6} className={`${B} px-3 py-1.5 ${SIZE.tableCell} text-right`}>TOTAL</td>
                  <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
                    <FmtNum value={totals.initial} />
                  </td>
                  <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
                    <FmtNum value={totals.cc} />
                  </td>
                  <td className={`${B} px-2 py-1.5 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
                    <FmtNum value={totals.grand} />
                  </td>
                </tr>

                {/* GRAND TOTAL in words */}
                <tr>
                  <td
                    colSpan={9}
                    style={{
                      borderLeft: "1px solid #b0b0b0", borderRight: "1px solid #b0b0b0",
                      borderBottom: "1px solid #b0b0b0", borderTop: "none", padding: "5px 10px",
                    }}
                    className={SIZE.labelText}
                  >
                    <span className={WEIGHT.bold}>Grand Total in Words: </span>
                    {totals.grand > 0 ? amountToWordsIN(totals.grand) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── REMARKS ── */}
          {data.remarks && (
            <div className="px-6 pb-3">
              <p className={VAL}>
                <span className={LBL}>Remarks</span> : {data.remarks}
              </p>
            </div>
          )}

          {/* ── SIGNATURES ── */}
          <div className="px-6 pb-6 pt-2 border-t border-gray-200 mt-2">
            <SigRow label="Created By"   name={data.createdBy}   dateStr={fmt.dateTime(data.createdAt)} />
            <SigRow label="Submitted By" name={data.submittedBy} dateStr={fmt.dateTime(data.submittedAt)} />
            <SigRow label="Approved By"  name={data.approvedBy}  dateStr={fmt.dateTime(data.finalApprovedAt)} />
          </div>
        </div>
      </div>

      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <QRCodeCanvas ref={qrCanvasRef} value={pageUrl} size={80} />
      </div>

      <style>{`
        @page { size: A4; margin: 8mm 8mm 12mm 8mm; }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body, body > * { background: white !important; margin: 0 !important; }
          tr, .cc-row { break-inside: avoid; page-break-inside: avoid; }
          thead { display: table-header-group; }
          .print\\:hidden { display: none !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:max-w-none { max-width: none !important; }
        }
      `}</style>
    </>
  );
}

/* One item row plus an indented row per CC code allocated to it */
function ItemBlock({ item, idx }) {
  const zebra = idx % 2 === 0 ? "bg-white" : "bg-gray-50";
  return (
    <>
      <tr className={zebra}>
        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-center text-gray-500`}>{item.slNo || idx + 1}</td>
        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-center ${WEIGHT.medium}`}>{item.itemCode || "—"}</td>
        <td className={`${B} px-2 py-2 ${SIZE.tableCell}`} style={{ wordBreak: "break-word" }}>
          {item.itemName || "—"}
          {item.itemDescription && (
            <div className="text-[11px] text-gray-500">{item.itemDescription}</div>
          )}
        </td>
        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-center text-gray-600`}>{item.unitItem || item.unit || "—"}</td>
        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
          <FmtNum value={item.orderQty} decimals={3} />
        </td>
        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
          <FmtNum value={item.rate} />
        </td>
        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
          <FmtNum value={item.initialAmount} />
        </td>
        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
          <FmtNum value={item.totalCcCost} />
        </td>
        <td className={`${B} px-2 py-2 ${SIZE.tableCell} text-right tabular-nums ${WEIGHT.semibold}`} style={{ whiteSpace: "nowrap" }}>
          <FmtNum value={item.totalCost} />
        </td>
      </tr>

      {item.ccCodes.map((c, ci) => (
        <tr key={ci} className="cc-row bg-[#fbfbfb]">
          <td className={`${B} px-2 py-1`} />
          <td className={`${B} px-2 py-1 ${SIZE.tableCell} text-center text-gray-600`}>{c.ccCode || "—"}</td>
          <td className={`${B} px-2 py-1 ${SIZE.tableCell} text-gray-600`} style={{ wordBreak: "break-word" }}>
            <span className="text-gray-400 mr-1">↳</span>{c.ccName || "—"}
          </td>
          <td className={`${B} px-2 py-1`} colSpan={2} />
          <td className={`${B} px-2 py-1 ${SIZE.tableCell} text-right tabular-nums text-gray-600`} style={{ whiteSpace: "nowrap" }}>
            <FmtNum value={c.ccValue} />
          </td>
          <td className={`${B} px-2 py-1 ${SIZE.tableCell} text-center text-gray-400`}>—</td>
          <td className={`${B} px-2 py-1 ${SIZE.tableCell} text-right tabular-nums text-gray-600`} style={{ whiteSpace: "nowrap" }}>
            <FmtNum value={c.ccTotal} />
          </td>
          <td className={`${B} px-2 py-1`} />
        </tr>
      ))}
    </>
  );
}
