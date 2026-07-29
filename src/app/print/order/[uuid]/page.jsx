"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, fmt, FmtNum, ITEM_NAME, ITEM_SUB } from "@/components/print/printStyles";

/* ─── helpers ─────────────────────────────────────────────────── */
function categoryLabel(data) {
  if (data.categoryCode === "Purchases_Order")       return "PURCHASE ORDER";
  if (data.categoryCode === "Customer_Supply_Order") return "CUSTOMER SUPPLY ORDER";
  if (data.categoryCode === "Site_Transfer_Order")   return "SITE TRANSFER ORDER";
  return (data.categoryCode || "ORDER").replace(/_/g, " ").toUpperCase();
}

function toWordsRupees(amount) {
  const n = Math.round(Number(amount || 0));
  if (!n) return "Zero Rupees Only";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen","Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function toWords(num) {
    if (num === 0) return "";
    if (num < 20) return ones[num] + " ";
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " "+ones[num%10] : "") + " ";
    if (num < 1000) return ones[Math.floor(num/100)] + " Hundred " + toWords(num%100);
    if (num < 100000) return toWords(Math.floor(num/1000)) + "Thousand " + toWords(num%1000);
    if (num < 10000000) return toWords(Math.floor(num/100000)) + "Lakh " + toWords(num%100000);
    return toWords(Math.floor(num/10000000)) + "Crore " + toWords(num%10000000);
  }
  return "Rupees " + toWords(n).trim() + " Only";
}

function fmtNum(n) {
  return Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/* ─── Box components ─────────────────────────────────────────── */
const LBL = `${SIZE.labelText} ${WEIGHT.semibold} text-gray-800`;
const VAL = `${SIZE.labelText} text-gray-700`;

/* Shared table-row layout so every group row aligns across all 3 columns */
function ThreeBoxSection({ data, pageUrl }) {
  const v = data.vendor || {};
  const p = data.project || {};
  const c = data.company || {};
  const TD = "align-top px-2.5 py-0";
  const DIVIDER_TD = "py-2";  // gap row between groups

  return (
    <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "35%" }} />
        <col style={{ width: "38%" }} />
        <col style={{ width: "27%" }} />
      </colgroup>
      <tbody>
        {/* ── HEADER ROW ── */}
        <tr className="bg-[#e0e0e0]">
          {["Service From (Saler):", "Service To / Buyer:", "Reference:"].map((h, i) => (
            <td key={h} className={`${SIZE.sectionTitle} font-extrabold text-gray-900 px-2.5 py-1${i < 2 ? " border-r border-[#b0b0b0]" : ""}`}>{h}</td>
          ))}
        </tr>

        {/* ── GROUP 1 ── Name+C/o / Company+C/o / SGB+Date+Phone+Website */}
        <tr>
          <td className={`${TD} pt-2 border-r border-[#b0b0b0]`}>
            <p className={`${SIZE.labelText} ${WEIGHT.bold} text-gray-900`}>
              {v.ledgerName || data.partyName || "-"}
              {v.ledgerCode && <span className={`${SIZE.subText} text-gray-500 ml-1`}>(VC: {v.ledgerCode})</span>}
            </p>
          </td>
          <td className={`${TD} pt-2 border-r border-[#b0b0b0]`}>
            <p className={`${SIZE.labelText} ${WEIGHT.bold} text-gray-900`}>DISHAAN HI-TECH (INDIA) PVT. LTD.</p>
            {p.projectName && <p className={`${SIZE.subText} text-gray-600`}>C/o: {p.projectName}</p>}
          </td>
          <td className={`${TD} pt-2`}>
            <div className="space-y-0.5">
              <p className={VAL}><span className={LBL}>Order No.</span> : {data.orderNo || "-"}</p>
              <p className={VAL}><span className={LBL}>Order Date</span> : {fmt.date(data.orderDate)}</p>
            </div>
          </td>
        </tr>

        {/* ── GROUP 2 ── Address / Address / Address (vacant) */}
        <tr>
          <td className={`${TD} pt-3 border-r border-[#b0b0b0]`}>
            <p className={VAL}><span className={LBL}>Address</span> : {v.registeredAddress || "-"}</p>
          </td>
          <td className={`${TD} pt-3 border-r border-[#b0b0b0]`}>
            <p className={VAL}><span className={LBL}>Address</span> : {data.shippingAddress || "-"}</p>
          </td>
          <td className={`${TD} pt-3`}>
            <div className="flex justify-end pr-1">
              <div className="relative p-[5px]">
                <span className="absolute top-0 left-0 w-3 h-3 border-t-2 border-l-2 border-gray-900" />
                <span className="absolute top-0 right-0 w-3 h-3 border-t-2 border-r-2 border-gray-900" />
                <span className="absolute bottom-0 left-0 w-3 h-3 border-b-2 border-l-2 border-gray-900" />
                <span className="absolute bottom-0 right-0 w-3 h-3 border-b-2 border-r-2 border-gray-900" />
                <QRCodeSVG value={pageUrl} size={60} bgColor="#ffffff" fgColor="#000000" level="M" />
              </div>
            </div>
          </td>
        </tr>

        {/* ── GROUP 3 ── Contact / Email+Contact / Order No+Date */}
        <tr>
          <td className={`${TD} pt-3 border-r border-[#b0b0b0]`}>
            <div className="space-y-0.5">
              <p className={VAL}><span className={LBL}>Email</span> : {v.email || ""}</p>
              <p className={VAL}><span className={LBL}>Contact Person</span> : {v.primaryContact || ""}</p>
              <p className={VAL}><span className={LBL}>Contact No</span> : {v.primaryPhone || ""}</p>
            </div>
          </td>
          <td className={`${TD} pt-3 border-r border-[#b0b0b0]`}>
            <div className="space-y-0.5">
              <p className={VAL}><span className={LBL}>Email</span> : {p.projMgmtEmail || ""}</p>
              <p className={VAL}><span className={LBL}>Contact Person</span> : {data.contactPerson || ""}</p>
              <p className={VAL}><span className={LBL}>Contact No</span> : {data.contactNumber || ""}</p>
            </div>
          </td>
          <td className={`${TD} pt-3`}>
            <div className="space-y-0.5">
              <p className={VAL}><span className={LBL}>Site</span> : {p.projectCode || "-"}</p>
            </div>
          </td>
        </tr>

        {/* ── GROUP 4 ── PAN/GSTIN/State/Quotation / GSTIN+State+Enquiry / Created by+Status */}
        <tr>
          <td className={`${TD} pt-3 pb-2.5 border-r border-[#b0b0b0]`}>
            <div className="space-y-0.5">
              <p className={VAL}><span className={LBL}>PAN No.</span> : {v.pan || ""}</p>
              {/* if gstin is absent/invalid (empty, NA, N/A etc.) → show URGD; state shows "-" for value */}
              {(() => { const g = (v.gstin || "").trim(); const invalid = !g || /^(na|n\/a|nil|none|invalid)$/i.test(g); return (
                <>
                  <p className={VAL}><span className={LBL}>GSTIN NO.</span> : {invalid ? "URGD" : g}</p>
                  <p className={VAL}><span className={LBL}>State</span> : {invalid ? "-" : v.stateName || ""}{!invalid && v.stateCode ? ` | State Code : ${v.stateCode}` : invalid ? " | State Code : -" : ""}</p>
                </>
              ); })()}
              {data.quotationNo && <p className={VAL}><span className={LBL}>Quotation No.</span> : {data.quotationNo}{data.quotationDate ? ` | dtd.-${fmt.date(data.quotationDate)}` : ""}</p>}
            </div>
          </td>
          <td className={`${TD} pt-3 pb-2.5 border-r border-[#b0b0b0]`}>
            <div className="space-y-0.5">
              {/* company details */}
              <p className={VAL}><span className={LBL}>PAN No.</span> : {c.pan || ""}</p>
              <p className={VAL}><span className={LBL}>GSTIN NO.</span> : {c.gstn || ""}</p>
              <p className={VAL}><span className={LBL}>State</span> : {c.state || ""}{c.stateCode ? ` | State Code : ${c.stateCode}` : ""}</p>
              <p className={VAL}><span className={LBL}>Enquiry No</span> : {data.enquiryNo || ""}</p>
            </div>
          </td>
          <td className={`${TD} pb-2.5`} style={{ verticalAlign: "top", paddingTop: "12px" }}>
            <div className="space-y-0.5">
              <p className={VAL}><span className={LBL}>Created by</span> : {data.createdBy || ""}</p>
              <p className={VAL}><span className={LBL}>Status</span> : {data.workflowStatus || "-"}</p>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

/* ─── Terms helpers ──────────────────────────────────────────── */
function renderGroups(groups, startIndex = 0) {
  return (groups || []).map((grp, gi) => (
    <div key={gi} className="mb-2">
      <p className={`${SIZE.labelText} ${WEIGHT.bold} text-gray-900`}>{startIndex + gi + 1}. {grp.title}</p>
      {grp.description && <p className={`${SIZE.labelText} text-gray-700`}>{grp.description}</p>}
      {(grp.points || []).length > 0 && (
        <ul className="ml-4 mt-0.5">
          {grp.points.sort((a, b) => a.sortOrder - b.sortOrder).map((pt, pi) => {
            const marker = grp.pointStyle === "alpha" ? `${String.fromCharCode(97+pi)}) ` : "• ";
            return <li key={pi} className={`${SIZE.labelText} text-gray-700`}>{marker}{pt.text}</li>;
          })}
        </ul>
      )}
    </div>
  ));
}

function SpecificTerms({ terms }) {
  const specific = (terms || []).filter((t) => t.termType === "Special_Terms").sort((a, b) => a.sequenceNo - b.sequenceNo);
  if (!specific.length) return null;
  const allGroups = specific.flatMap((term) => (term.termGroups || []).sort((a, b) => a.sortOrder - b.sortOrder));
  return (
    <div className="px-6 pb-2">
      <div className={`${SIZE.sectionTitle} ${WEIGHT.bold} text-gray-900 uppercase text-center py-1 mb-2`}>
        Special Terms and Conditions
      </div>
      {renderGroups(allGroups)}
    </div>
  );
}

function GeneralTerms({ terms }) {
  const general = (terms || []).filter((t) => t.termType === "General_Terms").sort((a, b) => a.sequenceNo - b.sequenceNo);
  if (!general.length) return null;
  const allGroups = general.flatMap((term) => (term.termGroups || []).sort((a, b) => a.sortOrder - b.sortOrder));
  return (
    <div className="px-6 pb-2">
      <div className={`${SIZE.sectionTitle} ${WEIGHT.bold} text-gray-900 uppercase text-center py-1 mb-2`}>
        General Terms and Conditions
      </div>
      {renderGroups(allGroups)}
    </div>
  );
}

function BillingAddressSection({ data }) {
  const p = data.project || {};
  return (
    <div className="px-6 pb-3">
      <p className={`${SIZE.labelText} ${WEIGHT.semibold} text-gray-800`}>
        Note : GST amount to be paid after submission of GSTR-1 by the vendor.
      </p>
      <div className="mt-2">
        <p className={`${SIZE.labelText} ${WEIGHT.bold} text-gray-900`}>BILLING ADDRESS.</p>
        <p className={`${SIZE.labelText} text-gray-700`}>All the invoices/documents should be addressed and shipped to:-</p>
        <p className={`${SIZE.labelText} ${WEIGHT.bold} text-gray-900`}>DISHAAN HI-TECH (INDIA) PRIVATE LIMITED.</p>
        {data.billingAddress && <p className={`${SIZE.labelText} text-gray-800`}>{data.billingAddress}</p>}
        {p.gstn && <p className={`${SIZE.labelText} text-gray-800`}>GSTIN NO: {p.gstn}</p>}
      </div>
    </div>
  );
}

function SignatureSection({ data }) {
  return (
    <div className="px-6 pb-4 flex justify-end pr-20">
      <div className="flex flex-col items-center">
        <p className={`${SIZE.labelText} ${WEIGHT.semibold} text-gray-800`}>Dishaan Hi-tech (India) Pvt. Ltd.</p>
        <div className="mt-10 mb-1 border-b border-gray-700 w-[180px]" />
        <p className={`${SIZE.labelText} ${WEIGHT.bold} text-gray-900 text-center`}>Signature</p>
        <p className={`${SIZE.labelText} ${WEIGHT.semibold} text-gray-800 text-center`}>Biswajit Dinda</p>
      </div>
    </div>
  );
}

/* ─── Download helpers ────────────────────────────────────────── */
function printAsPDF() { window.print(); }

function downloadExcel(data) {
  const XLSX = require("xlsx");
  const v = data.vendor || {};
  const p = data.project || {};
  const fin = data.financials || {};
  const items = data.items || [];
  const isIGST = (data.gstType || "") === "IGST";
  const rows = [
    [categoryLabel(data)],
    [],
    ["Order No", data.orderNo || "-", "", "Order Date", fmt.date(data.orderDate)],
    ["Vendor", v.ledgerName || "-", "", "Validity", fmt.date(data.validityDate)],
    ["Project", p.projectName || "-", "", "Quotation No", data.quotationNo || "-"],
    ["Billing Address", data.billingAddress || "-"],
    ["Shipping Address", data.shippingAddress || "-"],
    [],
    ["Sl No","Item Details","HSN/SAC","Unit","Order Qty","Unit Rate (INR)","Basic Amount","GST %","GST Amount","Total Amount"],
    ...items.map((item, i) => [i+1, item.itemName||item.itemDescription||"-", item.hsnSac||"-", item.unit||"-", item.qty, item.rate, item.basicAmount, item.gstPercent, item.gstAmount, item.lineTotal]),
    [],
    ["","","","","","","Total Basic Amount","","",fin.basicAmount],
    isIGST ? ["","","","","","","IGST @","","",fin.gstAmount] : ["","","","","","","CGST @","","",(fin.gstAmount||0)/2],
    !isIGST ? ["","","","","","","SGST @","","",(fin.gstAmount||0)/2] : [],
    ["","","","","","","Total Order Amount","","",fin.totalAmount],
    [],
    ["Amount in Words", toWordsRupees(fin.totalAmount)],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{wch:5},{wch:35},{wch:12},{wch:8},{wch:10},{wch:14},{wch:14},{wch:8},{wch:12},{wch:14}];
  XLSX.utils.book_append_sheet(wb, ws, "Order");
  XLSX.writeFile(wb, `${categoryLabel(data)}_${data.orderNo}.xlsx`);
}

async function downloadDocx(data, qrCanvasRef) {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun, ImageRun, WidthType, AlignmentType, ShadingType, BorderStyle } = await import("docx");
  let logoBuffer = null;
  try { const r = await fetch("/assets/pdf-images/erp_company_img_pdf.png"); logoBuffer = await r.arrayBuffer(); } catch(_) {}
  let qrBuffer = null;
  try { const c = qrCanvasRef?.current; if (c) { const d = c.toDataURL("image/png"); qrBuffer = await fetch(d).then(r=>r.arrayBuffer()); } } catch(_) {}
  const run = (text, opts={}) => new TextRun({ text: String(text??"-"), font:"Calibri", size:20, ...opts });
  const nilB = { style: BorderStyle.NIL, size:0, color:"auto" };
  const nilBorders = { top:nilB, bottom:nilB, left:nilB, right:nilB, insideH:nilB, insideV:nilB };
  const tblBorder = { style:BorderStyle.SINGLE, size:4, color:"B0B0B0" };
  const tblBorders = { top:tblBorder, bottom:tblBorder, left:tblBorder, right:tblBorder, insideH:tblBorder, insideV:tblBorder };
  const headShading = { type:ShadingType.CLEAR, color:"D9D9D9", fill:"D9D9D9" };
  const blueShading = { type:ShadingType.CLEAR, color:"B6DDE8", fill:"B6DDE8" };
  const PAGE_W = 10466;
  const v = data.vendor||{}; const p = data.project||{}; const fin = data.financials||{}; const items = data.items||[];
  const isIGST = (data.gstType||"")==="IGST";
  const hLogoW=2600; const hQrW=2400; const hSpacerW=PAGE_W-hLogoW-hQrW;
  const logoContent = logoBuffer ? [new ImageRun({data:logoBuffer, transformation:{width:180,height:90}, type:"png"})] : [run("DISHAAN HI-TECH",{bold:true,size:22})];
  const headerTable = new Table({
    columnWidths:[hLogoW,hSpacerW,hQrW], width:{size:PAGE_W,type:WidthType.DXA}, borders:nilBorders,
    rows:[new TableRow({children:[
      new TableCell({children:[new Paragraph({children:logoContent})], width:{size:hLogoW,type:WidthType.DXA}, borders:nilBorders, margins:{top:60,bottom:60,left:80,right:80}}),
      new TableCell({children:[new Paragraph({text:""})], width:{size:hSpacerW,type:WidthType.DXA}, borders:nilBorders, margins:{top:60,bottom:60,left:80,right:80}}),
      new TableCell({children:[new Paragraph({alignment:AlignmentType.RIGHT,children:[run(categoryLabel(data),{bold:true,size:36})]}),...(qrBuffer?[new Paragraph({alignment:AlignmentType.RIGHT,children:[new ImageRun({data:qrBuffer,transformation:{width:68,height:68},type:"png"})]})]:[]),(new Paragraph({alignment:AlignmentType.RIGHT,children:[run("www.dishaanhitech.com",{size:16,color:"4B5563"})]}))], width:{size:hQrW,type:WidthType.DXA}, borders:nilBorders, margins:{top:60,bottom:60,left:80,right:80}}),
    ]})],
  });
  const cW = [0.05,0.22,0.09,0.06,0.07,0.10,0.10,0.07,0.10,0.10].map(r=>Math.round(PAGE_W*r));
  cW[9] = PAGE_W - cW.slice(0,9).reduce((a,b)=>a+b,0);
  const tCell = (text,w,bold=false,shading,align=AlignmentType.LEFT) => new TableCell({children:[new Paragraph({alignment:align,children:[run(text,{bold,size:bold?20:18})]})], width:{size:w,type:WidthType.DXA}, shading:shading||undefined, borders:tblBorders, margins:{top:40,bottom:40,left:60,right:60}});
  const hdrs = ["Sl\nNo","Item Details","HSN/\nSAC","Unit","Order\nQty","Unit Rate\n(INR)","Basic\nAmount","GST\n%","GST\nAmount","Total\nAmount"];
  const itemsTable = new Table({
    columnWidths:cW, width:{size:PAGE_W,type:WidthType.DXA}, borders:tblBorders,
    rows:[
      new TableRow({tableHeader:true, children:hdrs.map((h,i)=>tCell(h,cW[i],true,headShading,AlignmentType.CENTER))}),
      ...items.map((item,idx)=>new TableRow({children:[
        tCell(String(idx+1),cW[0],false,undefined,AlignmentType.CENTER),
        tCell(`${item.itemName||""}${item.itemDescription?"\n"+item.itemDescription:""}`,cW[1]),
        tCell(item.hsnSac||"-",cW[2],false,undefined,AlignmentType.CENTER),
        tCell(item.unit||"-",cW[3],false,undefined,AlignmentType.CENTER),
        tCell(String(item.qty??"-"),cW[4],false,undefined,AlignmentType.RIGHT),
        tCell(fmtNum(item.rate),cW[5],false,undefined,AlignmentType.RIGHT),
        tCell(fmtNum(item.basicAmount),cW[6],false,undefined,AlignmentType.RIGHT),
        tCell(String(item.gstPercent??""),cW[7],false,undefined,AlignmentType.CENTER),
        tCell(fmtNum(item.gstAmount),cW[8],false,undefined,AlignmentType.RIGHT),
        tCell(fmtNum(item.lineTotal),cW[9],false,undefined,AlignmentType.RIGHT),
      ]})),
      new TableRow({children:[tCell("",cW[0],false,blueShading),tCell("",cW[1],false,blueShading),tCell("",cW[2],false,blueShading),tCell("",cW[3],false,blueShading),tCell("",cW[4],false,blueShading),tCell("",cW[5],false,blueShading),tCell(fmtNum(fin.basicAmount),cW[6],true,blueShading,AlignmentType.RIGHT),tCell("",cW[7],false,blueShading),tCell(fmtNum(fin.gstAmount),cW[8],true,blueShading,AlignmentType.RIGHT),tCell(fmtNum(fin.totalAmount),cW[9],true,blueShading,AlignmentType.RIGHT)]}),
    ],
  });
  const doc = new Document({sections:[{properties:{page:{margin:{top:720,bottom:720,left:720,right:720}}},children:[headerTable,new Paragraph({text:"",spacing:{after:80}}),itemsTable,new Paragraph({text:"",spacing:{after:120}}),...[["Total Basic Amount",fmtNum(fin.basicAmount)],isIGST?["IGST @",fmtNum(fin.gstAmount)]:["CGST @",fmtNum((fin.gstAmount||0)/2)],...(!isIGST?[["SGST @",fmtNum((fin.gstAmount||0)/2)]]:[]),(["Total Order Amount",fmtNum(fin.totalAmount)])].map(([lbl,val])=>new Paragraph({children:[run(lbl,{bold:lbl==="Total Order Amount"}),run("     "),run(val,{bold:lbl==="Total Order Amount"})],spacing:{after:40}})),new Paragraph({text:"",spacing:{after:80}}),new Paragraph({children:[run(`Amount in Words: ${toWordsRupees(fin.totalAmount)}`,{italic:true,size:18})],spacing:{after:200}}),new Paragraph({children:[run("For Dishaan Hi-tech (India) Pvt. Ltd.",{bold:true})],spacing:{before:400,after:40}}),new Paragraph({children:[run(data.approvedBy||"Authorised Signatory",{size:18,color:"6B7280"})]})]}]});
  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href=url; a.download=`${categoryLabel(data)}_${data.orderNo}.docx`; a.click();
  URL.revokeObjectURL(url);
}

/* ─── Main Page ──────────────────────────────────────────────── */
export default function OrderPrintPage() {
  const { uuid } = useParams();
  const [data, setData]       = useState(null);
  const [error, setError]     = useState(null);
  const [loading, setLoading] = useState(true);
  const qrCanvasRef = useRef(null);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.GET_BY_UUID}/${uuid}` })
      .then((res) => setData(res.data))
      .catch((err) => setError({ status: err.status, message: err.message }))
      .finally(() => setLoading(false));
  }, [uuid]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <p className={`${SIZE.labelText} text-gray-500`}>Loading document…</p>
        </div>
      </div>
    );
  }

  if (error || !data) return <PrintErrorPage status={error?.status} message={error?.message} />;

  const items  = data.items || [];
  const fin    = data.financials || {};
  const company = data.company || {};
  const isIGST = (data.gstType || "") === "IGST";
  const cgstAmt = isIGST ? 0 : (fin.gstAmount || 0) / 2;
  const sgstAmt = isIGST ? 0 : (fin.gstAmount || 0) / 2;
  const igstAmt = isIGST ? fin.gstAmount || 0 : 0;
  const allTerms = data.termsConditions || data.terms || [];

  return (
    <>
      <PrintTopBar
        title={`${categoryLabel(data)} — ${data.orderNo}`}
        onDownloadPDF={printAsPDF}
        onDownloadExcel={() => downloadExcel(data)}
        onDownloadDocx={() => downloadDocx(data, qrCanvasRef)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        {/* Wrapping table so <thead> repeats on every printed page */}
        <table className="w-full max-w-[900px] mx-auto print:max-w-none" style={{ borderCollapse: "collapse", fontFamily: "var(--font-print), sans-serif" }}>
          {/* ── PRINT-ONLY RUNNING HEADER — small logo repeats on pages 2+ */}
          <thead className="print-thead">
            <tr>
              <td style={{ paddingLeft: 24, paddingTop: 10, paddingBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/pdf-images/erp_company_img_pdf.png" alt="" style={{ width: 130, height: 60, objectFit: "contain", objectPosition: "left center" }} />
                <div style={{ paddingRight: 24, fontFamily: "var(--font-print), sans-serif" }}>
                  {[["Order No", data.orderNo || ""], ["Order Date", fmt.date(data.orderDate)]].map(([lbl, val]) => (
                    <div key={lbl} style={{ display: "flex", alignItems: "baseline", margin: 0 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#374151", width: 72, minWidth: 72 }}>{lbl}</span>
                      <span style={{ fontSize: 11, color: "#374151" }}> : {val}</span>
                    </div>
                  ))}
                </div>
              </td>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td>
                {/*
                  print-body-offset: in print, shifts content up by the thead height so the
                  full first-page header (below) covers the thead logo on page 1.
                  Pages 2+ the thead logo is visible since this div is no longer at the top.
                */}
                <div className="bg-white shadow-md print:shadow-none print-body-cover">

                  {/* ── FIRST-PAGE HEADER — visible on screen and page 1 of print ── */}
                  <div className="print-full-header flex items-center px-6 pt-4 pb-3">
                    <div className="w-[160px] shrink-0">
                      <Image src="/assets/pdf-images/erp_company_img_pdf.png" alt="Logo"
                        width={160} height={80} className="object-contain" priority />
                    </div>
                    <div className="flex-1 flex items-center justify-center">
                      <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>
                        {categoryLabel(data)}
                      </h1>
                    </div>
                    <div className="w-[27%] shrink-0 flex flex-col items-start gap-0.5">
                      <p className={`${SIZE.labelText} ${WEIGHT.normal} text-gray-800`}><span className={WEIGHT.bold}>Address</span> : {company.registeredAddress || ""}</p>
                      <p className={`${SIZE.subText} text-gray-700`}>Mobile: {company.contactNumber || ""}</p>
                      <a href="https://www.dishaanhitech.com" className={`${SIZE.subText} text-gray-700`}>Website: www.dishaanhitech.com</a>
                    </div>
                  </div>

                  {/* ── 3-BOX SECTION — outer border connects with table ── */}
                  <div className="mx-6 border border-[#b0b0b0]">
                    <ThreeBoxSection data={data} pageUrl={pageUrl} />
                  </div>

                  {/* ── INTRO TEXT — same left/right border as table ── */}
                  <div className="mx-6 border-x border-b border-[#b0b0b0] px-2.5 py-2">
                    <p className={`${SIZE.labelText} text-gray-700`}>Dear Sir / Madam,</p>
                    <p className={`${SIZE.labelText} text-gray-700 mt-1`}>
                      With reference to your above mentioned offer and subsequent discussion we had with you, we are pleased to place our Purchase Order / Service Order in your favour for supply of following items as per terms and conditions mentioned herein.
                    </p>
                  </div>

                  {/* ── ITEMS TABLE ────────────────────────── */}
                  <div className="px-6 pb-0">
                    <div className="overflow-x-auto">
                      <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
                        <colgroup>
                          <col style={{ width: "5%" }}  /><col style={{ width: "27%" }} /><col style={{ width: "9%" }} />
                          <col style={{ width: "6%" }}  /><col style={{ width: "7%" }}  /><col style={{ width: "10%" }} />
                          <col style={{ width: "10%" }} /><col style={{ width: "7%" }}  /><col style={{ width: "10%" }} />
                          <col style={{ width: "9%" }} />
                        </colgroup>
                        <thead>
                          <tr className={COLOR.tableHeadBg}>
                            {[
                              { label: "SL\nno"          },
                              { label: "Item Details"    },
                              { label: "HSN/\nSAC"       },
                              { label: "Unit"            },
                              { label: "Order\nQty"      },
                              { label: "Unit Rate\n(INR)"},
                              { label: "Basic\nAmount"   },
                              { label: "GST\n%"          },
                              { label: "GST\nAmount"     },
                              { label: "Total\nAmount"   },
                            ].map(({ label }) => (
                              <th key={label} style={{ whiteSpace: "pre-line" }}
                                className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableHead} ${WEIGHT.bold} text-gray-900 text-center`}>
                                {label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {items.map((item, idx) => (
                            <tr key={idx} style={{ breakInside: "avoid" }}>
                              <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`}>{idx + 1}.</td>
                              <td className={`border ${COLOR.tableBorder} px-1 py-1.5`}>
                                <p className={ITEM_NAME}>{item.itemName || "-"}</p>
                                {/* {item.itemDescription && <p className={ITEM_SUB}>{item.itemDescription}</p>} */}
                                {item.customNote && <p className={ITEM_SUB}>{item.customNote}</p>}
                                {item.itemCode && <p className={ITEM_SUB}><span className={WEIGHT.medium}>Item Code</span> : {item.itemCode}</p>}
                              </td>
                              <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`}>{item.hsnSac || "-"}</td>
                              <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`}>{item.unit || "-"}</td>
                              <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`}>{item.qty ?? "-"}</td>
                              <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-right`}><FmtNum value={item.rate} /></td>
                              <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-right`}><FmtNum value={item.basicAmount} /></td>
                              <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-center`}>{item.gstPercent != null && Number(item.gstPercent) !== 0 ? `${item.gstPercent}%` : "-"}</td>
                              <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-right`}>{!item.gstAmount || Number(item.gstAmount) === 0 ? "-" : <FmtNum value={item.gstAmount} />}</td>
                              <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} text-right`}><FmtNum value={item.lineTotal} /></td>
                            </tr>
                          ))}

                          {/* ── TOTAL row ── */}
                          <tr className={COLOR.signatureBg}>
                            <td colSpan={6} className={`border ${COLOR.tableBorder} px-2 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}>TOTAL</td>
                            <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}><FmtNum value={fin.basicAmount} /></td>
                            <td className={`border ${COLOR.tableBorder} px-1 py-1.5`} />
                            <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}><FmtNum value={fin.gstAmount} /></td>
                            <td className={`border ${COLOR.tableBorder} px-1 py-1.5 ${SIZE.tableCell} ${WEIGHT.bold} text-right`}><FmtNum value={fin.totalAmount} /></td>
                          </tr>

                          {/* ── Summary rows ── */}
                          {[
                            ["Total Basic Amount", fin.basicAmount],
                            ["CGST @",             cgstAmt],
                            ["SGST @",             sgstAmt],
                            ["IGST @",             igstAmt || null],
                          ].map(([label, val]) => (
                            <tr key={label}>
                              <td colSpan={5} style={{ borderLeft: "1px solid #b0b0b0", borderTop: "none", borderBottom: "none", borderRight: "none", padding: 0 }} />
                              <td colSpan={4} style={{ borderLeft: "1px solid #b0b0b0", borderTop: "none", borderBottom: "none", borderRight: "none", padding: "2px 6px" }}
                                className={`${SIZE.tableCell} text-left text-gray-700`}>{label}</td>
                              <td style={{ borderLeft: "1px solid #b0b0b0", borderRight: "1px solid #b0b0b0", borderTop: "none", borderBottom: "none", padding: "2px 4px" }}
                                className={`${SIZE.tableCell} text-right`}>{val != null ? <FmtNum value={val} /> : "-"}</td>
                            </tr>
                          ))}

                          {/* ── Total Order Amount ── */}
                          <tr>
                            <td colSpan={5} style={{ borderLeft: "1px solid #b0b0b0", borderTop: "none", borderBottom: "1px solid #b0b0b0", borderRight: "none", padding: 0 }} />
                            <td colSpan={4}
                              style={{ border: "1px solid #b0b0b0", padding: "4px 6px", fontWeight: 700, backgroundColor: "#d9d9d9" }}
                              className={`${SIZE.tableCell} text-left`}>Total Order Amount</td>
                            <td style={{ border: "1px solid #b0b0b0", padding: "4px 4px", fontWeight: 700, backgroundColor: "#d9d9d9" }}
                              className={`${SIZE.tableCell} text-right`}><FmtNum value={fin.totalAmount} /></td>
                          </tr>

                          {/* ── Order Value in words ── */}
                          <tr>
                            <td colSpan={10} style={{ borderLeft: "1px solid #b0b0b0", borderRight: "1px solid #b0b0b0", borderBottom: "1px solid #b0b0b0", borderTop: "none", padding: "4px 8px" }}
                              className={SIZE.labelText}>
                              <span style={{ fontWeight: 700 }}>Order Value in words:</span>{" "}{toWordsRupees(fin.totalAmount)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* ── SPECIFIC TERMS ─────────────────────── */}

                  <SpecificTerms terms={allTerms} />

                  {/* ── BILLING ADDRESS ────────────────────── */}
                  <BillingAddressSection data={data} />

                  {/* ── SIGNATURE ──────────────────────────── */}
                  <SignatureSection data={data} />

                  {/* ── GENERAL TERMS ──────────────────────── */}
                  <GeneralTerms terms={allTerms} />

                  {/* ── BOTTOM NOTE (static) ───────────────── */}
                  <div className="px-6 pb-6">
                    <hr className="mb-2 border-t border-gray-400" />
                    <p className={`${SIZE.subText} text-gray-500`}>
                      Note: This is an electronically verified document and does not require any physical signature or stamp.
                    </p>
                  </div>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Hidden QR canvas for DOCX */}
      <div style={{ position: "fixed", left: "-9999px", top: 0 }}>
        <QRCodeCanvas ref={qrCanvasRef} value={pageUrl} size={80} />
      </div>

      <style>{`
        /* Screen: hide the thead running logo */
        .print-thead { display: none; }

        @page {
          size: A4;
          margin: 0 8mm 12mm 8mm;
          @bottom-center {
            content: counter(page, decimal-leading-zero) " of " counter(pages, decimal-leading-zero);
            font-size: 9pt;
            color: #6b7280;
            font-family: Calibri, sans-serif;
          }
        }

        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { background: white !important; margin: 0 !important; }
          .print\\:p-0   { padding: 0 !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:max-w-none { max-width: none !important; }

          /* Show the small logo thead on print — repeats on pages 2+ */
          .print-thead { display: table-header-group; }

          /*
           * Shift the content div UP by the thead height so the full header
           * starts at the very top of page 1 (no blank gap).
           * ::before (z-index:1) covers the thead logo behind it.
           * .print-full-header (z-index:2) paints on top of the cover.
           */
          .print-body-cover {
            position: relative;
            margin-top: -79px;
          }
          .print-body-cover::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 79px;
            background: white;
            z-index: 1;
          }
          .print-full-header {
            position: relative;
            z-index: 2;
            background: white;
          }

          /* Hide the sticky top bar */
          .print\\:hidden, [class*="print:hidden"] { display: none !important; }
        }
      `}</style>
    </>
  );
}
