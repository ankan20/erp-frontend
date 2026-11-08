"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { QRCodeSVG } from "qrcode.react";
import { publicRequest } from "@/lib/publicRequest";
import { API_ENDPOINTS } from "@/config/api.config";
import PrintTopBar from "@/components/print/PrintTopBar";
import PrintErrorPage from "@/components/print/PrintErrorPage";
import { SIZE, WEIGHT, COLOR, fmt } from "@/components/print/printStyles";
import { DOCX_FONT } from "@/config/fonts.config";
import { longDay, timeOf } from "@/lib/dpr";

const SEV = { high: "text-red-700", medium: "text-amber-700", low: "text-gray-700" };

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start py-[2px]">
      <span className={`${SIZE.labelText} text-gray-700 w-[130px] min-w-[130px]`}>{label}</span>
      <span className={`${SIZE.labelText} text-gray-700 mr-2`}>:</span>
      <span className={`${SIZE.valueText} text-gray-900 flex-1`}>{value || "-"}</span>
    </div>
  );
}

function SectionHeader({ children }) {
  return <div className={`${COLOR.tableHeadBg} px-3 py-[3px] ${SIZE.labelText} ${WEIGHT.bold} text-gray-800`}>{children}</div>;
}

function Table({ head, rows }) {
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h} className={`border ${COLOR.tableBorder} px-2 py-1 text-left ${SIZE.tableHead} ${WEIGHT.semibold} bg-[#f2f2f2]`}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="break-inside-avoid">
            {r.map((c, j) => (
              <td key={j} className={`border ${COLOR.tableBorder} px-2 py-1 align-top ${SIZE.tableCell}`}>{c ?? "-"}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function downloadExcel(d) {
  const XLSX = require("xlsx");
  const c = d.content || {};
  const r = d.siteRecords || {};
  const rows = [
    ["DAILY PROGRESS REPORT", d.dprNo],
    ["Project", `${d.projectCode} — ${d.projectName || ""}`],
    ["Date", longDay(d.reportDate)],
    ["Status", d.workflowStatus],
    ["Weather", d.weather || "-"],
    ["Manpower", d.manpowerTotal ?? "-"],
    [],
    ["SUMMARY"], [d.summary || ""],
    [],
    ["WORK DONE", "Area", "Description"],
    ...(c.work_done || []).map((w, i) => [i + 1, w.area, w.description]),
    [],
    ["MANPOWER", "Category", "Count"],
    ...((c.manpower?.by_category || []).map((m, i) => [i + 1, m.category, m.count])),
    [],
    ["MACHINERY", "Name", "Note"],
    ...(c.machinery || []).map((m, i) => [i + 1, m.name, m.note]),
    [],
    ["MATERIALS", "Item", "Quantity", "Note"],
    ...(c.materials || []).map((m, i) => [i + 1, m.item, m.quantity, m.note]),
    [],
    ["ISSUES"], ...(c.issues || []).map((s) => [s]),
    [],
    ["SAFETY", "Severity", "Issue"],
    ...(c.safety || []).map((s, i) => [i + 1, s.severity, s.issue]),
    [],
    ["LABOUR (DLR)", "Category", "Count"],
    ...(r.labour || []).map((l, i) => [i + 1, l.category, l.count]),
    [],
    ["PHOTOS", "Time", "Location", "Activity", "Link"],
    ...(d.photos || []).map((p, i) => [i + 1, timeOf(p.takenAt), p.subLocation || "", p.ai?.activity || "", p.fileUrl]),
    [],
    ["Remarks", d.remarks || ""],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 18 }, { wch: 28 }, { wch: 60 }, { wch: 40 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws, "DPR");
  XLSX.writeFile(wb, `DPR_${d.dprNo || d.reportDate}.xlsx`);
}

export default function DprPrintPage() {
  const { uuid } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const pageUrl = typeof window !== "undefined" ? window.location.href : "";

  useEffect(() => {
    if (!uuid) return;
    publicRequest({ url: `${API_ENDPOINTS.PROJECT.DPR.GET_BY_UUID}/${uuid}` })
      .then((res) => setData(res.data))
      .catch((err) => setError({ status: err.status, message: err.message }))
      .finally(() => setLoading(false));
  }, [uuid]);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="w-8 h-8 border-4 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  if (error || !data) return <PrintErrorPage status={error?.status} message={error?.message} />;

  const c = data.content || {};
  const rec = data.siteRecords || {};
  const photos = data.photos || [];
  const highlight = new Set(data.highlightPhotoIds || []);
  const ordered = [...photos.filter((p) => highlight.has(p.id)), ...photos.filter((p) => !highlight.has(p.id))];
  const photoNo = Object.fromEntries(ordered.map((p, i) => [p.id, i + 1]));
  const refs = (ids) => (ids?.length ? ` (photo ${ids.map((i) => photoNo[i]).filter(Boolean).join(", ")})` : "");

  return (
    <>
      <PrintTopBar
        title={`Daily Progress Report — ${data.dprNo} · ${longDay(data.reportDate)}`}
        onDownloadPDF={() => window.print()}
        onDownloadExcel={() => downloadExcel(data)}
      />

      <div className="bg-gray-100 py-6 px-3 print:p-0 print:bg-white">
        <div className="bg-white max-w-[900px] mx-auto shadow-md print:shadow-none print:max-w-none" style={{ fontFamily: "var(--font-print), sans-serif" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-4 pb-3 border-b border-gray-200">
            <div className="w-[160px] shrink-0">
              <Image src="/assets/pdf-images/erp_company_img_pdf.png" alt="Logo" width={160} height={80} className="object-contain" priority />
            </div>
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <h1 className={`${SIZE.pageTitle} ${WEIGHT.bold} tracking-widest text-gray-900 uppercase`}>Daily Progress Report</h1>
              <p className={`${SIZE.sectionTitle} ${WEIGHT.bold} text-gray-700 tracking-widest mt-0.5`}>{data.dprNo}</p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <span className={`${SIZE.subText} text-gray-600`}>www.dishaanhitech.com</span>
              <QRCodeSVG value={pageUrl} size={68} level="M" />
            </div>
          </div>

          {/* Info */}
          <div className="grid px-6 py-3 border-b border-gray-200" style={{ gridTemplateColumns: "55% 45%" }}>
            <div>
              <InfoRow label="Project Code" value={data.projectCode} />
              <InfoRow label="Project Name" value={data.projectDetails?.name || data.projectName} />
              <InfoRow label="Client" value={data.projectDetails?.client} />
              <InfoRow label="Date" value={longDay(data.reportDate)} />
            </div>
            <div className="pl-6 border-l border-gray-200">
              <InfoRow label="Status" value={data.workflowStatus?.replace("_", " ")} />
              <InfoRow label="Weather" value={data.weather} />
              <InfoRow label="Manpower" value={data.manpowerTotal != null ? String(data.manpowerTotal) : null} />
              <InfoRow label="Photos" value={String(photos.length)} />
            </div>
          </div>

          <SectionHeader>Summary</SectionHeader>
          <p className={`px-6 py-2 ${SIZE.valueText} text-gray-900 whitespace-pre-line`}>{data.summary || "-"}</p>

          <SectionHeader>Work Done</SectionHeader>
          <div className="px-6 py-2">
            {(c.work_done || []).length ? (
              <Table head={["#", "Area", "Work done"]} rows={c.work_done.map((w, i) => [i + 1, w.area, `${w.description}${refs(w.photo_ids)}`])} />
            ) : <p className={SIZE.valueText}>-</p>}
          </div>

          <div className="grid border-t border-gray-200" style={{ gridTemplateColumns: "50% 50%" }}>
            <div className="border-r border-gray-200">
              <SectionHeader>Manpower</SectionHeader>
              <div className="px-3 py-2">
                {(c.manpower?.by_category || []).length ? (
                  <Table head={["Category", "Count"]} rows={c.manpower.by_category.map((m) => [m.category, m.count])} />
                ) : <InfoRow label="Total" value={data.manpowerTotal != null ? String(data.manpowerTotal) : null} />}
                {c.manpower?.note && <p className={`${SIZE.subText} text-gray-500 mt-1`}>{c.manpower.note}</p>}
              </div>
            </div>
            <div>
              <SectionHeader>Machinery</SectionHeader>
              <div className="px-3 py-2">
                {(c.machinery || []).length ? (
                  <Table head={["Machine", "Note"]} rows={c.machinery.map((m) => [m.name, m.note])} />
                ) : <p className={SIZE.valueText}>-</p>}
              </div>
            </div>
          </div>

          <SectionHeader>Materials</SectionHeader>
          <div className="px-6 py-2">
            {(c.materials || []).length ? (
              <Table head={["Item", "Quantity", "Note"]} rows={c.materials.map((m) => [m.item, m.quantity, m.note])} />
            ) : <p className={SIZE.valueText}>-</p>}
          </div>

          <SectionHeader>Issues &amp; Hindrances</SectionHeader>
          <div className={`px-6 py-2 ${SIZE.valueText}`}>
            {(c.issues || []).length ? c.issues.map((s, i) => <div key={i}>• {s}</div>) : "None"}
          </div>

          <SectionHeader>Safety</SectionHeader>
          <div className={`px-6 py-2 ${SIZE.valueText}`}>
            {(c.safety || []).length
              ? c.safety.map((s, i) => (
                  <div key={i}>
                    <b className={`uppercase ${SEV[s.severity] || ""}`}>{s.severity}</b> — {s.issue}{refs(s.photo_ids)}
                  </div>
                ))
              : "No safety issues seen in photos"}
          </div>

          {(rec.concrete?.length > 0 || rec.materials_received?.length > 0) && (
            <>
              <SectionHeader>Site Records</SectionHeader>
              <div className="px-6 py-2 space-y-2">
                {rec.concrete?.length > 0 && (
                  <Table head={["Concrete — location", "Segment", "Grade", "Volume"]} rows={rec.concrete.map((r) => [r.location, r.segment, r.grade, r.volume])} />
                )}
                {rec.materials_received?.length > 0 && (
                  <Table head={["Material received", "Quantity", "GRN"]} rows={rec.materials_received.map((m) => [m.item, `${m.quantity ?? ""} ${m.unit || ""}`, m.grn_no])} />
                )}
              </div>
            </>
          )}

          {data.remarks && (
            <>
              <SectionHeader>Engineer&apos;s Remarks</SectionHeader>
              <p className={`px-6 py-2 ${SIZE.valueText} whitespace-pre-line`}>{data.remarks}</p>
            </>
          )}

          {/* Photos */}
          {ordered.length > 0 && (
            <>
              <SectionHeader>Site Photos</SectionHeader>
              <div className="px-6 py-3 grid grid-cols-3 gap-3">
                {ordered.map((p) => (
                  <figure key={p.id} className="break-inside-avoid">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.fileUrl} alt="" className="w-full aspect-[4/3] object-cover border border-gray-200" />
                    <figcaption className={`${SIZE.subText} text-gray-700 mt-0.5 leading-snug`}>
                      <b>{photoNo[p.id]}.</b> {timeOf(p.takenAt)}
                      {p.subLocation ? ` · ${p.subLocation}` : ""}
                      {p.ai?.activity ? ` · ${p.ai.activity}` : ""}
                      {p.source === "camera" && p.onSite ? " · ✓ on site" : ""}
                      {p.caption ? <span className="block text-gray-500">{p.caption}</span> : null}
                    </figcaption>
                  </figure>
                ))}
              </div>
            </>
          )}

          {/* Sign-off */}
          <div className="px-6 pt-3 pb-5 grid grid-cols-3 gap-8 border-t border-gray-200">
            <div className={`${SIZE.labelText} text-gray-700`}>
              <div>Prepared by: {data.createdBy || "-"}</div>
              <div>Approved by: {data.approvedBy || "-"} {data.finalApprovedAt ? `[${fmt.dateTime(data.finalApprovedAt)}]` : ""}</div>
              <div className={`${SIZE.subText} text-gray-400 mt-1`}>
                Report drafted by AI from site photos and records{data.edited ? ", reviewed and edited by the site team" : ""}.
              </div>
            </div>
            {["Site Engineer", "Project Manager"].map((lbl) => (
              <div key={lbl} className="flex flex-col justify-end">
                <div style={{ borderTop: "1px solid #1f2937" }} />
                <p className={`mt-0.5 text-center ${SIZE.labelText} ${WEIGHT.bold} text-gray-800 uppercase tracking-wider`}>{lbl}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @page {
          size: A4;
          margin: 8mm 8mm 12mm 8mm;
          @bottom-center {
            content: counter(page, decimal-leading-zero) " of " counter(pages, decimal-leading-zero);
            font-size: 9pt;
            color: #6b7280;
            font-family: ${DOCX_FONT}, sans-serif;
          }
        }
        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body, body > * { background: white !important; margin: 0 !important; }
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
