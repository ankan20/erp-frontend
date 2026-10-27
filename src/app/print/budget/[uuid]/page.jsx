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

function normalise(item, poPercent, eoPercent) {
  const qty    = Number(item.orderQty  || 0);
  const rate   = Number(item.rate      || 0);
  const amount = item.initialAmount !== undefined && item.initialAmount !== null
    ? Number(item.initialAmount)
    : qty * rate;

  const ccCodes = (item.ccCodes || []).map((c) => ({
    ccCode:  c.ccCode  || "",
    ccName:  c.ccName  || "",
    ccValue: Number(c.ccValue || 0),
    ccTotal: c.ccTotal !== undefined && c.ccTotal !== null
      ? Number(c.ccTotal)
      : qty * Number(c.ccValue || 0),
  }));

  // DRCW = sum of all stored DE CC code totals (DRCW col itself is not stored)
  const drcwAmount = item.totalCcCost !== undefined && item.totalCcCost !== null
    ? Number(item.totalCcCost)
    : ccCodes.reduce((s, c) => s + c.ccTotal, 0);

  const poAmount  = amount * poPercent / 100;
  const eoAmount  = amount * eoPercent / 100;
  const tec       = drcwAmount + poAmount + eoAmount;
  const profit    = amount - tec;
  const profitPct = amount > 0 ? profit / amount * 100 : 0;

  return { ...item, orderQty: qty, rate, ccCodes, initialAmount: amount, drcwAmount, poAmount, eoAmount, tec, profit, profitPct };
}

async function downloadExcel(data, items, totals, poPercent, eoPercent) {
  const XLSX = await import("xlsx");

  // Collect unique sibling DE CC codes in encounter order (across all items)
  const allDeCcCols = [];
  const seenCodes = new Set();
  items.forEach((it) => {
    (it.ccCodes || []).forEach((c) => {
      if (!seenCodes.has(c.ccCode)) {
        seenCodes.add(c.ccCode);
        allDeCcCols.push({ ccCode: c.ccCode, ccName: c.ccName });
      }
    });
  });

  // Fixed col count: Sl, Item Name, Unit, Qty, Rate, Amount → 6
  // Then: DRCW, [DE cols...], PO, EO, TEC, Profit, Profit% → variable
  const fixedCount = 6;
  const drcwColIdx = fixedCount;               // col G (0-indexed = 6)
  const deStartIdx = drcwColIdx + 1;           // col H+
  const deEndIdx   = deStartIdx + allDeCcCols.length - 1;
  const poIdx      = deEndIdx + 1;
  const eoIdx      = poIdx + 1;
  const totalCols  = eoIdx + 3 + 1;            // +TEC, Profit, Profit%

  // Helper: col index → Excel letter (A, B, ... Z, AA...)
  const colLetter = (i) => {
    let s = "";
    let n = i + 1;
    while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
    return s;
  };
  const poLetter = colLetter(poIdx);
  const eoLetter = colLetter(eoIdx);

  // ── Header info rows ──────────────────────────────────────────────────────
  const aoa = [];
  aoa.push(["DISHAANHI TECH IT SOLUTIONS PVT. LTD."]);
  aoa.push([]);
  aoa.push(["Budget No", data.budgetNo || "—", "", "Budget Date", fmt.date(data.budgetDate)]);
  aoa.push(["Sale Order", data.saleOrderNo || "—", "", "Sale Order Title", data.saleOrderTitle || "—"]);
  aoa.push(["Project", data.projectCode || "—", "", "Status", (data.workflowStatus || "").replace(/_/g, " ")]);
  aoa.push(["Order Value (excl. GST)", totals.orderValue, "", "Remarks", data.remarks || "—"]);
  aoa.push([]);

  // ── Overhead % row (matches reference: just values in PO and EO columns) ──
  const pctRow = new Array(totalCols).fill(null);
  pctRow[poIdx] = poPercent / 100;
  pctRow[eoIdx] = eoPercent / 100;
  aoa.push(pctRow);

  // ── Column header row ─────────────────────────────────────────────────────
  const headers = [
    "Sl No", "Details Description", "Unit", "BOQ", "Rate", "Amount",
    "Composite Work Charges (DRCW)",
    ...allDeCcCols.map((c) => c.ccName || c.ccCode),
    "Project Overhead",
    "Employee Overhead",
    "Total Execution Cost",
    "Profit",
    "Profit %",
  ];
  aoa.push(headers);

  // ── Data rows ─────────────────────────────────────────────────────────────
  const dataStartRow = aoa.length + 1; // 1-indexed for XLSX formulas
  items.forEach((it, i) => {
    const r = dataStartRow + i; // 1-indexed row for formulas
    const deVals = allDeCcCols.map((col) => {
      const match = (it.ccCodes || []).find((c) => c.ccCode === col.ccCode);
      return match ? Number(match.ccValue || 0) : 0;
    });
    const drcwPerUnit = deVals.reduce((s, v) => s + v, 0);
    const poPerUnit   = Number(it.rate) * poPercent / 100;
    const eoPerUnit   = Number(it.rate) * eoPercent / 100;
    const tecPerUnit  = drcwPerUnit + poPerUnit + eoPerUnit;
    const profitPerUnit = Number(it.rate) - tecPerUnit;
    const profitPct   = Number(it.rate) > 0 ? profitPerUnit / Number(it.rate) * 100 : 0;
    aoa.push([
      it.slNo || i + 1,
      it.itemName || "",
      it.unitItem || it.unit || "",
      Number(it.orderQty),
      Number(it.rate),
      Number(it.initialAmount),
      drcwPerUnit,
      ...deVals,
      poPerUnit,
      eoPerUnit,
      tecPerUnit,
      profitPerUnit,
      Number(profitPct.toFixed(2)),
    ]);
  });

  // ── Total row ─────────────────────────────────────────────────────────────
  const totalRow = new Array(totalCols).fill(null);
  totalRow[0] = "TOTAL";
  totalRow[5] = totals.amount;
  totalRow[drcwColIdx] = totals.drcw;
  allDeCcCols.forEach((col, ci) => {
    totalRow[deStartIdx + ci] = items.reduce((s, it) => {
      const match = (it.ccCodes || []).find((c) => c.ccCode === col.ccCode);
      return s + (match ? Number(match.ccValue || 0) : 0);
    }, 0);
  });
  totalRow[poIdx]      = totals.po;
  totalRow[eoIdx]      = totals.eo;
  totalRow[eoIdx + 1]  = totals.tec;
  totalRow[eoIdx + 2]  = totals.profit;
  totalRow[eoIdx + 3]  = Number(totals.profitPct.toFixed(2));
  aoa.push(totalRow);

  // ── Overhead CC sheet ─────────────────────────────────────────────────────
  const poRows = (data.projectOverhead || []).map((c) => {
    const est = Number(c.estimatedCost || 0);
    return [c.ccCode, c.ccName, est, totals.orderValue,
      totals.orderValue > 0 ? Number((est / totals.orderValue * 100).toFixed(2)) : 0];
  });
  const eoRows = (data.employeeOverhead || []).map((c) => {
    const est = Number(c.estimatedCost || 0);
    return [c.ccCode, c.ccName, est, totals.orderValue,
      totals.orderValue > 0 ? Number((est / totals.orderValue * 100).toFixed(2)) : 0];
  });
  const ohHeader = ["CC Code", "CC Name", "Estimated Cost (₹)", "Order Value excl. GST (₹)", "%"];
  const aoaOH = [
    ["Overhead CC Code Breakdown"],
    [],
    [`Project Overhead — ${poPercent.toFixed(2)}%`],
    ohHeader, ...poRows,
    [],
    [`Employee Overhead — ${eoPercent.toFixed(2)}%`],
    ohHeader, ...eoRows,
  ];

  // ── Build workbook ────────────────────────────────────────────────────────
  const ws  = XLSX.utils.aoa_to_sheet(aoa);
  const wsO = XLSX.utils.aoa_to_sheet(aoaOH);

  // Column widths for main sheet
  const wCols = [
    { wch: 6 }, { wch: 40 }, { wch: 7 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
    { wch: 16 }, // DRCW
    ...allDeCcCols.map(() => ({ wch: 18 })),
    { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 9 },
  ];
  ws["!cols"] = wCols;
  wsO["!cols"] = [{ wch: 14 }, { wch: 30 }, { wch: 18 }, { wch: 20 }, { wch: 8 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws,  "Budget Items");
  XLSX.utils.book_append_sheet(wb, wsO, "Overhead CCs");
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

  // ── Overhead percent (budget-level) ───────────────────────────────────────
  const orderValue       = Number(data.orderValueExclGst || 0);
  const poTotalEstimated = (data.projectOverhead  || []).reduce((s, c) => s + Number(c.estimatedCost || 0), 0);
  const eoTotalEstimated = (data.employeeOverhead || []).reduce((s, c) => s + Number(c.estimatedCost || 0), 0);
  const poPercent        = orderValue > 0 ? poTotalEstimated / orderValue * 100 : 0;
  const eoPercent        = orderValue > 0 ? eoTotalEstimated / orderValue * 100 : 0;

  // ── Items ─────────────────────────────────────────────────────────────────
  const items = (data.items || [])
    .slice()
    .sort((a, b) => (a.slNo || 0) - (b.slNo || 0))
    .map((it) => normalise(it, poPercent, eoPercent));

  // ── Budget-level totals ───────────────────────────────────────────────────
  const totalAmount = data.totalInitialCost !== undefined && data.totalInitialCost !== null
    ? Number(data.totalInitialCost) : items.reduce((s, it) => s + it.initialAmount, 0);
  const totalDrcw   = data.totalCcCost !== undefined && data.totalCcCost !== null
    ? Number(data.totalCcCost) : items.reduce((s, it) => s + it.drcwAmount, 0);
  const totalPo     = totalAmount * poPercent / 100;
  const totalEo     = totalAmount * eoPercent / 100;
  const totalTec    = totalDrcw + totalPo + totalEo;
  const totalProfit = totalAmount - totalTec;
  const totalProfitPct = totalAmount > 0 ? totalProfit / totalAmount * 100 : 0;

  const totals = {
    orderValue,
    amount: totalAmount, drcw: totalDrcw,
    po: totalPo, eo: totalEo, tec: totalTec,
    profit: totalProfit, profitPct: totalProfitPct,
  };

  // ─── Column headers ────────────────────────────────────────────────────────
  const HEADS = [
    "Sl.", "Code", "Item Name & Description", "Unit",
    "Qty", "Rate (₹)", "Amount (₹)",
    "Direct Exp. (₹)", "Proj. OH (₹)", "Emp. OH (₹)",
    "TEC (₹)", "Profit (₹)", "Profit %",
  ];

  const poHasData = (data.projectOverhead  || []).length > 0;
  const eoHasData = (data.employeeOverhead || []).length > 0;

  return (
    <>
      <PrintTopBar
        title={`Budget Master — ${data.budgetNo || ""}`}
        onDownloadPDF={printAsPDF}
        onDownloadExcel={() => downloadExcel(data, items, totals, poPercent, eoPercent)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div
          className="bg-white max-w-[1160px] mx-auto shadow-md print:shadow-none print:max-w-none"
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
          <div className="grid px-6 pb-3" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
            <div className="space-y-0.5">
              <InfoRow label="Budget No"   value={data.budgetNo} />
              <InfoRow label="Budget Date" value={fmt.date(data.budgetDate)} />
              <InfoRow label="Status"      value={(data.workflowStatus || "").replace(/_/g, " ")} />
            </div>
            <div className="space-y-0.5 pl-4">
              <InfoRow label="Sale Order"  value={data.saleOrderNo} />
              <InfoRow label="Order Title" value={data.saleOrderTitle} />
              <InfoRow label="Project"     value={data.projectCode} />
            </div>
            <div className="space-y-0.5 pl-4">
              <InfoRow label="Order Value (excl. GST)" value={`₹ ${fmt.number(orderValue)}`} />
              <InfoRow label="Proj. Overhead %"  value={`${poPercent.toFixed(2)}%  (₹ ${fmt.number(poTotalEstimated)})`} />
              <InfoRow label="Emp. Overhead %"   value={`${eoPercent.toFixed(2)}%  (₹ ${fmt.number(eoTotalEstimated)})`} />
            </div>
          </div>

          {/* ── COST SUMMARY STRIP ── */}
          <div className="px-6 pb-3">
            <div className="grid border border-[#b0b0b0] text-center" style={{ gridTemplateColumns: "repeat(7, 1fr)" }}>
              {[
                { label: "Sale Order Amount",     value: fmt.number(totalAmount) },
                { label: "Direct Expenses",        value: fmt.number(totalDrcw),   bg: "#e0f2fe" },
                { label: `Proj. Overhead (${poPercent.toFixed(1)}%)`, value: fmt.number(totalPo), bg: "#ede9fe" },
                { label: `Emp. Overhead (${eoPercent.toFixed(1)}%)`,  value: fmt.number(totalEo), bg: "#ede9fe" },
                { label: "Total Execution Cost",   value: fmt.number(totalTec),    bg: "#fff1f2" },
                { label: "Profit",                 value: fmt.number(totalProfit), bg: totalProfit >= 0 ? "#dcfce7" : "#fef2f2" },
                { label: "Profit %",               value: `${totalProfitPct.toFixed(2)}%`, bg: totalProfit >= 0 ? "#dcfce7" : "#fef2f2" },
              ].map(({ label, value, bg }) => (
                <div
                  key={label}
                  className="border-r border-[#b0b0b0] last:border-r-0 px-1.5 py-1.5"
                  style={bg ? { backgroundColor: bg } : {}}
                >
                  <div className={`${SIZE.subText} text-gray-500`}>{label}</div>
                  <div className={`${SIZE.tableHead} ${WEIGHT.bold} text-gray-900 tabular-nums mt-0.5`}>₹ {value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── ITEMS TABLE ── */}
          <div className="px-6 pb-3">
            <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
              <colgroup>
                <col style={{ width: "3.5%" }} />
                <col style={{ width: "7%"   }} />
                <col style={{ width: "17%"  }} />
                <col style={{ width: "5%"   }} />
                <col style={{ width: "6%"   }} />
                <col style={{ width: "7%"   }} />
                <col style={{ width: "8%"   }} />
                <col style={{ width: "8%"   }} />
                <col style={{ width: "7%"   }} />
                <col style={{ width: "7%"   }} />
                <col style={{ width: "8%"   }} />
                <col style={{ width: "8%"   }} />
                <col style={{ width: "8%"   }} />
              </colgroup>
              <thead>
                {/* Group header */}
                <tr>
                  <th colSpan={7} className={`border border-[#b0b0b0] px-2 py-1 text-center ${SIZE.subText} ${WEIGHT.bold}`}
                    style={{ backgroundColor: "#dbeafe", color: "#1e3a5f" }}>
                    Sale Order Items
                  </th>
                  <th className={`border border-[#b0b0b0] px-2 py-1 text-center ${SIZE.subText} ${WEIGHT.bold}`}
                    style={{ backgroundColor: "#cffafe", color: "#0e4f6c" }}>
                    Direct Exp.
                  </th>
                  <th colSpan={2} className={`border border-[#b0b0b0] px-2 py-1 text-center ${SIZE.subText} ${WEIGHT.bold}`}
                    style={{ backgroundColor: "#ede9fe", color: "#3b0764" }}>
                    Overhead
                  </th>
                  <th className={`border border-[#b0b0b0] px-2 py-1 text-center ${SIZE.subText} ${WEIGHT.bold}`}
                    style={{ backgroundColor: "#fff1f2", color: "#7f1d1d" }}>
                    Cost
                  </th>
                  <th colSpan={2} className={`border border-[#b0b0b0] px-2 py-1 text-center ${SIZE.subText} ${WEIGHT.bold}`}
                    style={{ backgroundColor: "#dcfce7", color: "#14532d" }}>
                    Margin
                  </th>
                </tr>
                {/* Column header */}
                <tr className={COLOR.tableHeadBg}>
                  {HEADS.map((h) => (
                    <th key={h} className={`${B} px-1.5 py-1.5 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 && (
                  <tr>
                    <td colSpan={13} className={`${B} px-2 py-4 text-center ${SIZE.tableCell} text-gray-400 italic`}>
                      No items on this budget
                    </td>
                  </tr>
                )}

                {items.map((it, idx) => (
                  <ItemBlock key={idx} item={it} idx={idx} />
                ))}

                {/* TOTAL ROW */}
                <tr className={`${COLOR.tableHeadBg} ${WEIGHT.bold}`}>
                  <td colSpan={6} className={`${B} px-3 py-1.5 ${SIZE.tableCell} text-right`}>TOTAL</td>
                  <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
                    <FmtNum value={totalAmount} />
                  </td>
                  <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
                    style={{ whiteSpace: "nowrap", backgroundColor: "#e0f2fe" }}>
                    <FmtNum value={totalDrcw} />
                  </td>
                  <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
                    style={{ whiteSpace: "nowrap", backgroundColor: "#ede9fe" }}>
                    <FmtNum value={totalPo} />
                  </td>
                  <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
                    style={{ whiteSpace: "nowrap", backgroundColor: "#ede9fe" }}>
                    <FmtNum value={totalEo} />
                  </td>
                  <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
                    style={{ whiteSpace: "nowrap", backgroundColor: "#fff1f2" }}>
                    <FmtNum value={totalTec} />
                  </td>
                  <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
                    style={{ whiteSpace: "nowrap", backgroundColor: totalProfit >= 0 ? "#dcfce7" : "#fef2f2" }}>
                    <FmtNum value={totalProfit} />
                  </td>
                  <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
                    style={{ whiteSpace: "nowrap", backgroundColor: totalProfit >= 0 ? "#dcfce7" : "#fef2f2" }}>
                    {totalProfitPct.toFixed(2)}%
                  </td>
                </tr>

                {/* Grand total in words */}
                <tr>
                  <td
                    colSpan={13}
                    style={{
                      borderLeft: "1px solid #b0b0b0", borderRight: "1px solid #b0b0b0",
                      borderBottom: "1px solid #b0b0b0", borderTop: "none", padding: "5px 10px",
                    }}
                    className={SIZE.labelText}
                  >
                    <span className={WEIGHT.bold}>Sale Order Amount in Words: </span>
                    {totalAmount > 0 ? amountToWordsIN(totalAmount) : "—"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* ── OVERHEAD CC BREAKDOWN ── */}
          {(poHasData || eoHasData) && (
            <div className="px-6 pb-3">
              <div className={`${SIZE.labelText} ${WEIGHT.bold} text-gray-700 mb-1`}>Overhead CC Code Breakdown</div>
              <div className="grid gap-4" style={{ gridTemplateColumns: poHasData && eoHasData ? "1fr 1fr" : "1fr" }}>
                {poHasData && (
                  <OverheadTable
                    title={`Project Overhead — ${poPercent.toFixed(2)}%`}
                    rows={data.projectOverhead}
                    orderValue={orderValue}
                    bgHead="#ede9fe"
                    colorHead="#3b0764"
                  />
                )}
                {eoHasData && (
                  <OverheadTable
                    title={`Employee Overhead — ${eoPercent.toFixed(2)}%`}
                    rows={data.employeeOverhead}
                    orderValue={orderValue}
                    bgHead="#ede9fe"
                    colorHead="#3b0764"
                  />
                )}
              </div>
            </div>
          )}

          {/* ── REMARKS ── */}
          {data.remarks && (
            <div className="px-6 pb-3">
              <p className={VAL}>
                <span className={LBL}>Remarks</span> : {data.remarks}
              </p>
            </div>
          )}

          {/* ── SIGNATURES ── */}
          <div className="px-6 pt-3 pb-4 border-t border-gray-200 mt-2">
            <div className="grid" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div>
                <SigRow label="Created By"   name={data.createdBy}   dateStr={fmt.dateTime(data.createdAt)} />
              </div>
              <div>
                <SigRow label="Submitted By" name={data.submittedBy} dateStr={fmt.dateTime(data.submittedAt)} />
              </div>
              <div>
                <SigRow label="Approved By"  name={data.approvedBy}  dateStr={fmt.dateTime(data.finalApprovedAt)} />
              </div>
            </div>
          </div>

          {/* ── PRINT FOOTER ── */}
          <div
            className="px-6 py-2 border-t border-[#b0b0b0] flex items-center justify-between"
            style={{ backgroundColor: "#f5f5f5" }}
          >
            <span className={`${SIZE.subText} text-gray-500`}>
              {data.budgetNo || "—"} | {fmt.date(data.budgetDate)} | {data.projectCode || "—"}
            </span>
            <span className={`${SIZE.subText} text-gray-500`}>
              www.dishaanhitech.com
            </span>
            <span className={`${SIZE.subText} text-gray-500 print-page-num`}>
              Page 1 / 1
            </span>
          </div>
        </div>
      </div>

      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <QRCodeCanvas ref={qrCanvasRef} value={pageUrl} size={80} />
      </div>

      <style>{`
        @page { size: A4 landscape; margin: 8mm 8mm 14mm 8mm; }
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
          .print-page-num { display: none; }
          @page {
            @bottom-right {
              content: "Page " counter(page) " / " counter(pages);
              font-size: 10px;
              color: #6b7280;
            }
            @bottom-left {
              content: attr(data-budget-no);
              font-size: 10px;
              color: #6b7280;
            }
          }
        }
      `}</style>
    </>
  );
}

function ItemBlock({ item, idx }) {
  const zebra = idx % 2 === 0 ? "bg-white" : "bg-gray-50";
  return (
    <>
      <tr className={zebra}>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-center text-gray-500`}>{item.slNo || idx + 1}</td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-center`} style={{ wordBreak: "break-word" }}>{item.itemCode || "—"}</td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell}`} style={{ wordBreak: "break-word" }}>
          {item.itemName || "—"}
          {item.itemDescription && (
            <div className="text-[11px] text-gray-500">{item.itemDescription}</div>
          )}
        </td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-center text-gray-600`}>{item.unitItem || item.unit || "—"}</td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
          <FmtNum value={item.orderQty} decimals={3} />
        </td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
          <FmtNum value={item.rate} />
        </td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
          <FmtNum value={item.initialAmount} />
        </td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
          style={{ whiteSpace: "nowrap", backgroundColor: "#e0f2fe" }}>
          <FmtNum value={item.drcwAmount} />
        </td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
          style={{ whiteSpace: "nowrap", backgroundColor: "#ede9fe" }}>
          <FmtNum value={item.poAmount} />
        </td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
          style={{ whiteSpace: "nowrap", backgroundColor: "#ede9fe" }}>
          <FmtNum value={item.eoAmount} />
        </td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
          style={{ whiteSpace: "nowrap", backgroundColor: "#fff1f2" }}>
          <FmtNum value={item.tec} />
        </td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
          style={{ whiteSpace: "nowrap", backgroundColor: item.profit >= 0 ? "#dcfce7" : "#fef2f2" }}>
          <FmtNum value={item.profit} />
        </td>
        <td className={`${B} px-1.5 py-1.5 ${SIZE.tableCell} text-right tabular-nums`}
          style={{ whiteSpace: "nowrap", backgroundColor: item.profit >= 0 ? "#dcfce7" : "#fef2f2" }}>
          {item.profitPct.toFixed(2)}%
        </td>
      </tr>

      {item.ccCodes.map((c, ci) => (
        <tr key={ci} className="cc-row" style={{ backgroundColor: "#f0fafa" }}>
          <td className={`${B} px-1.5 py-0.5`} />
          <td className={`${B} px-1.5 py-0.5 ${SIZE.tableCell} text-center text-gray-500`}>{c.ccCode || "—"}</td>
          <td className={`${B} px-1.5 py-0.5 ${SIZE.tableCell} text-gray-500`} style={{ wordBreak: "break-word" }}>
            <span className="text-gray-400 mr-1">↳</span>{c.ccName || "—"}
          </td>
          <td className={`${B} px-1.5 py-0.5`} colSpan={3} />
          <td className={`${B} px-1.5 py-0.5 ${SIZE.tableCell} text-right tabular-nums text-gray-500`} style={{ whiteSpace: "nowrap" }}>
            <FmtNum value={c.ccValue} />
          </td>
          <td className={`${B} px-1.5 py-0.5 ${SIZE.tableCell} text-right tabular-nums text-gray-500`}
            style={{ whiteSpace: "nowrap", backgroundColor: "#e0f2fe" }}>
            <FmtNum value={c.ccTotal} />
          </td>
          <td colSpan={5} className={`${B} px-1.5 py-0.5`} />
        </tr>
      ))}
    </>
  );
}

function OverheadTable({ title, rows = [], orderValue, bgHead, colorHead }) {
  const total = rows.reduce((s, c) => s + Number(c.estimatedCost || 0), 0);
  return (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "15%" }} />
        <col style={{ width: "35%" }} />
        <col style={{ width: "20%" }} />
        <col style={{ width: "20%" }} />
        <col style={{ width: "10%" }} />
      </colgroup>
      <thead>
        <tr>
          <th
            colSpan={5}
            className={`border border-[#b0b0b0] px-2 py-1 text-left ${SIZE.tableHead} ${WEIGHT.bold}`}
            style={{ backgroundColor: bgHead, color: colorHead }}
          >
            {title}
          </th>
        </tr>
        <tr className={COLOR.tableHeadBg}>
          {["CC Code", "CC Name", "Estimated Cost (₹)", "Order Value (₹)", "%"].map((h) => (
            <th key={h} className={`${B} px-1.5 py-1 text-center ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 && (
          <tr>
            <td colSpan={5} className={`${B} px-2 py-2 text-center ${SIZE.tableCell} text-gray-400 italic`}>No data</td>
          </tr>
        )}
        {rows.map((c, i) => {
          const pct = orderValue > 0 ? Number(c.estimatedCost || 0) / orderValue * 100 : 0;
          return (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              <td className={`${B} px-1.5 py-1 ${SIZE.tableCell} text-center`}>{c.ccCode || "—"}</td>
              <td className={`${B} px-1.5 py-1 ${SIZE.tableCell}`}>{c.ccName || "—"}</td>
              <td className={`${B} px-1.5 py-1 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
                <FmtNum value={Number(c.estimatedCost || 0)} />
              </td>
              <td className={`${B} px-1.5 py-1 ${SIZE.tableCell} text-right tabular-nums text-gray-500`} style={{ whiteSpace: "nowrap" }}>
                <FmtNum value={orderValue} />
              </td>
              <td className={`${B} px-1.5 py-1 ${SIZE.tableCell} text-right tabular-nums`}>{pct.toFixed(2)}%</td>
            </tr>
          );
        })}
        <tr className={`${COLOR.tableHeadBg} ${WEIGHT.bold}`}>
          <td colSpan={2} className={`${B} px-2 py-1 ${SIZE.tableCell} text-right`}>Total</td>
          <td className={`${B} px-1.5 py-1 ${SIZE.tableCell} text-right tabular-nums`} style={{ whiteSpace: "nowrap" }}>
            <FmtNum value={total} />
          </td>
          <td className={`${B} px-1.5 py-1`} />
          <td className={`${B} px-1.5 py-1 ${SIZE.tableCell} text-right tabular-nums`}>
            {orderValue > 0 ? (total / orderValue * 100).toFixed(2) : "0.00"}%
          </td>
        </tr>
      </tbody>
    </table>
  );
}
