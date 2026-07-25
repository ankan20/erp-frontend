"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { amountToWordsIN } from "@/lib/amountToWords";

export default function BRRBillingSummaryTab({ form }) {
  const { watch, setValue } = form;

  const ccSummary          = watch("ccSummary") || [];
  const gstType            = watch("gstType") || "";
  const backendBasicAmount = Number(watch("basicAmount") || 0);
  const backendGstAmount   = Number(watch("gstAmount") || 0);
  const backendTotalAmount = Number(watch("totalAmount") || 0);

  const isIGST     = gstType === "IGST";
  const isCGSTSGST = gstType === "CGST_SGST";

  const handleIGST     = (checked) => setValue("gstType", checked ? "IGST" : "");
  const handleCGSTSGST = (checked) => setValue("gstType", checked ? "CGST_SGST" : "");

  const igstAmount = isIGST     ? backendGstAmount       : 0;
  const cgstAmount = isCGSTSGST ? backendGstAmount / 2   : 0;
  const sgstAmount = isCGSTSGST ? backendGstAmount / 2   : 0;

  const amountInWords = amountToWordsIN(backendTotalAmount);

  return (
    <div className="space-y-3 p-3">
      {/* BASIC TABLE */}
      <div className="border border-gray-300">
        <div className="w-full bg-[#DCE8D2] border-b border-gray-300 px-4 py-1">
          <h2 className="text-[15px] font-semibold">BASIC</h2>
        </div>
        <div className="max-h-[295px] overflow-y-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#D3D3D3]">
                <th className="border px-2 py-1 text-sm w-[90px]">Sl no</th>
                <th className="border px-2 py-1 text-sm w-[180px]">CC Code</th>
                <th className="border px-2 py-1 text-sm">CC Name</th>
                <th className="border px-2 py-1 text-sm w-[120px]">Basic Amount</th>
                <th className="border px-2 py-1 text-sm w-[120px]">GST Amount</th>
                <th className="border px-2 py-1 text-sm w-[120px]">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {ccSummary.length
                ? ccSummary.map((item, index) => (
                    <tr key={index}>
                      <td className="border px-2 py-[2px] text-center text-sm">{index + 1}</td>
                      <td className="border px-2 py-[2px] text-sm">{item.ccCode}</td>
                      <td className="border px-2 py-[2px] text-sm">{item.ccName}</td>
                      <td className="border px-2 py-[2px] text-right text-sm">{Number(item.basicAmount || 0).toFixed(2)}</td>
                      <td className="border px-2 py-[2px] text-right text-sm">{Number(item.gstAmount || 0).toFixed(2)}</td>
                      <td className="border px-2 py-[2px] text-right text-sm">{Number(item.totalAmount || 0).toFixed(2)}</td>
                    </tr>
                  ))
                : Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 6 }).map((__, ci) => (
                        <td key={ci} className="border px-2 py-[2px] h-[26px]" />
                      ))}
                    </tr>
                  ))}
              <tr className="bg-[#D3D3D3] font-semibold">
                <td className="border px-2 py-1" />
                <td className="border px-2 py-1" />
                <td className="border px-2 py-1 text-center text-sm">TOTAL</td>
                <td className="border px-2 py-1 text-center text-sm">{backendBasicAmount.toFixed(2)}</td>
                <td className="border px-2 py-1 text-center text-sm">{backendGstAmount.toFixed(2)}</td>
                <td className="border px-2 py-1 text-center text-sm">{backendTotalAmount.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* GST TABLE */}
      <div className="border border-gray-300">
        <div className="w-full bg-[#F5E4D7] border-b border-gray-300 px-4 py-1">
          <h2 className="text-[15px] font-semibold">GST</h2>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#D3D3D3]">
              <th className="border px-2 py-1 text-sm w-[120px]">Select</th>
              <th className="border px-2 py-1 text-sm w-[180px]">CC Code</th>
              <th className="border px-2 py-1 text-sm">CC Name</th>
              <th className="border px-2 py-1 text-sm w-[180px]">GST Amount</th>
            </tr>
          </thead>
          <tbody>
            {[
              { checked: isIGST,     onChange: handleIGST,     code: "IGST",  name: "Input-IGST",  amount: igstAmount },
              { checked: isCGSTSGST, onChange: handleCGSTSGST, code: "CGST",  name: "Input-CGST",  amount: cgstAmount },
              { checked: isCGSTSGST, onChange: handleCGSTSGST, code: "SGST",  name: "Input-SGST",  amount: sgstAmount },
            ].map((row) => (
              <tr key={row.code}>
                <td className="border px-2 py-[2px] text-center">
                  <Checkbox checked={row.checked} onCheckedChange={row.onChange} />
                </td>
                <td className="border px-2 py-[2px] text-sm">{row.code}</td>
                <td className="border px-2 py-[2px] text-sm">{row.name}</td>
                <td className="border px-2 py-[2px] text-right text-sm">{row.amount.toFixed(2)}</td>
              </tr>
            ))}
            <tr className="bg-[#D3D3D3] font-semibold">
              <td className="border px-2 py-1" />
              <td className="border px-2 py-1" />
              <td className="border px-2 py-1 text-center text-sm">TOTAL</td>
              <td className="border px-2 py-1 text-center text-sm">{backendGstAmount.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TOTALS */}
      <div className="space-y-0.5">
        {[
          { label: "Basic Amount",                  value: backendBasicAmount,  bg: "#DCE8D2", vbg: "#D5DBE6", bold: false },
          { label: "GST Amount",                    value: backendGstAmount,    bg: "#DCE8D2", vbg: "#D5DBE6", bold: false },
          { label: "Total Invoice Amount (Rs.)",    value: backendTotalAmount,  bg: "#DCE8D2", vbg: "#F2B07E", bold: true  },
        ].map(({ label, value, bg, vbg, bold }) => (
          <div key={label} className="flex items-center">
            <div style={{ background: bg }} className={`w-[80%] border px-4 py-1 text-[16px] rounded-sm ${bold ? "font-bold" : "font-semibold"}`}>
              {label}
            </div>
            <div style={{ background: vbg }} className={`w-[20%] border px-4 py-1 text-right text-[16px] rounded-sm ${bold ? "font-bold" : "font-semibold"}`}>
              {value.toFixed(2)}
            </div>
          </div>
        ))}
        <div className="flex items-center mt-1.5">
          <div className="w-[180px] bg-[#DCE8D2] border px-3 py-1 text-[15px] font-semibold rounded-sm">
            Amount (In word)
          </div>
          <div className="flex-1 bg-[#F8EFC8] border px-4 py-1 text-[15px] rounded-sm">
            {amountInWords}
          </div>
        </div>
      </div>
    </div>
  );
}
