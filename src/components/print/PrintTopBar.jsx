"use client";

import { useState } from "react";
import { FileDown, FileSpreadsheet, FileText, Printer, Loader2 } from "lucide-react";

/**
 * PrintTopBar — shared action bar for all print pages.
 *
 * Props:
 *   onDownloadPDF   {Function} async — triggered by "Download PDF" button
 *   onDownloadExcel {Function} async — triggered by "Download Excel" button
 *   onDownloadDocx  {Function} async — triggered by "Download DOCX" button
 *   title           {string}  — document title shown in bar (e.g. "Indent #350142")
 */
export default function PrintTopBar({ onDownloadPDF, onDownloadExcel, onDownloadDocx, title }) {
  const [loading, setLoading] = useState(null); // "pdf" | "excel" | "docx" | null

  const run = async (key, fn) => {
    if (!fn) return;
    setLoading(key);
    try { await fn(); } finally { setLoading(null); }
  };

  const btn = (key, label, Icon, fn, colorClass) => fn && (
    <button
      onClick={() => run(key, fn)}
      disabled={!!loading}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium text-white transition disabled:opacity-60 ${colorClass}`}
    >
      {loading === key
        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
        : <Icon className="w-3.5 h-3.5" />}
      {label}
    </button>
  );

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm print:hidden">
      <div className="max-w-[900px] mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-gray-700 truncate">{title}</span>
        <div className="flex flex-wrap gap-2">
          {btn("pdf",   "Save as PDF",   FileDown,        onDownloadPDF,   "bg-red-500 hover:bg-red-600")}
          {btn("excel", "Download Excel",FileSpreadsheet, onDownloadExcel, "bg-green-600 hover:bg-green-700")}
          {btn("docx",  "Download DOCX", FileText,        onDownloadDocx,  "bg-blue-600 hover:bg-blue-700")}
          <button
            onClick={() => window.print()}
            disabled={!!loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[12px] font-medium text-white bg-gray-600 hover:bg-gray-700 transition disabled:opacity-60"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>
        </div>
      </div>
    </div>
  );
}
