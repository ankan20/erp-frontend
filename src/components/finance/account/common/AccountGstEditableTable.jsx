"use client";

/**
 * AccountGstEditableTable
 * GST section for account forms where the user types the rate themselves.
 *
 * Use this when NOTHING pre-fills the document — Purchase Voucher, where the user
 * enters every item and rate by hand. For forms whose rates arrive from an API
 * (Sale Bill, Purchase Bill, Credit / Debit Note) use AccountGstTable instead:
 * there the % is read-only because the document already carries it.
 *
 * ─── HOW THE RATE WORKS ──────────────────────────────────────────────────────
 *   Nothing is hardcoded. The three rows always describe ONE effective rate,
 *   so editing any of them keeps the other two consistent:
 *
 *     type IGST 11   →  CGST 5.5, SGST 5.5      (halves)
 *     type CGST 5.5  →  SGST 5.5, IGST 11       (mirror + double)
 *     type SGST 5.5  →  CGST 5.5, IGST 11
 *
 *   GST amount is always basicTotal × that row's % ÷ 100, and only the selected
 *   rows contribute — IGST is mutually exclusive with CGST + SGST, exactly as in
 *   AccountGstTable.
 *
 * Props
 *   watch, setValue, control — RHF
 *   disabled                 — bool
 *   basicTotal               — number, drives every amount
 *   fieldName                — RHF field array name (default "gstLines")
 *   showDescription          — bool (default true)
 */

import { useEffect }  from "react";
import { Controller } from "react-hook-form";
import { ACC }        from "./accountTheme";
import GstInput       from "@/components/common/GstInput";
import ExpandableTextCell from "@/components/project-management/common/ExpandableTextCell";
import { formatAmount }   from "@/helper/numberFormatter";

// Blank rates — the user supplies them. Deliberately NOT AccountGstTable's
// DEFAULT_GST_LINES, whose 18 / 9 / 9 would be a hardcoded rate on this form.
export const EMPTY_GST_LINES = [
  { gstType: "IGST", ccCode: "IGST", ccName: "Output-IGST", description: "", percent: 0, gstAmount: 0, isSelected: true  },
  { gstType: "CGST", ccCode: "CGST", ccName: "Output-CGST", description: "", percent: 0, gstAmount: 0, isSelected: false },
  { gstType: "SGST", ccCode: "SGST", ccName: "Output-SGST", description: "", percent: 0, gstAmount: 0, isSelected: false },
];

export default function AccountGstEditableTable({
  watch,
  setValue,
  control,
  disabled        = false,
  basicTotal      = 0,
  fieldName       = "gstLines",
  showDescription = true,
}) {
  const gstLines = watch(fieldName) || EMPTY_GST_LINES;

  const isIGST     = !!gstLines[0]?.isSelected;
  const isCGSTSGST = !!gstLines[1]?.isSelected;

  const igstPct = Number(gstLines[0]?.percent || 0);
  const cgstPct = Number(gstLines[1]?.percent || 0);
  const sgstPct = Number(gstLines[2]?.percent || 0);

  const igstAmt  = isIGST     ? (basicTotal * igstPct) / 100 : 0;
  const cgstAmt  = isCGSTSGST ? (basicTotal * cgstPct) / 100 : 0;
  const sgstAmt  = isCGSTSGST ? (basicTotal * sgstPct) / 100 : 0;
  const gstTotal = igstAmt + cgstAmt + sgstAmt;

  // Keep form state's amounts in step with what's on screen, so the payload
  // never disagrees with the table.
  useEffect(() => {
    setValue(`${fieldName}.0.gstAmount`, igstAmt, { shouldDirty: false });
    setValue(`${fieldName}.1.gstAmount`, cgstAmt, { shouldDirty: false });
    setValue(`${fieldName}.2.gstAmount`, sgstAmt, { shouldDirty: false });
  }, [igstAmt, cgstAmt, sgstAmt, fieldName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Selection: IGST ⇄ CGST + SGST ────────────────────────────────────────
  const handleIGST = (checked) => {
    setValue(`${fieldName}.0.isSelected`, checked, { shouldDirty: true });
    if (checked) {
      setValue(`${fieldName}.1.isSelected`, false, { shouldDirty: true });
      setValue(`${fieldName}.2.isSelected`, false, { shouldDirty: true });
    }
  };

  const handleCGSTSGST = (checked) => {
    setValue(`${fieldName}.1.isSelected`, checked, { shouldDirty: true });
    setValue(`${fieldName}.2.isSelected`, checked, { shouldDirty: true });
    if (checked) setValue(`${fieldName}.0.isSelected`, false, { shouldDirty: true });
  };

  // ── Rate entry: one rate, three rows kept consistent ─────────────────────
  const spreadRate = (idx, raw) => {
    const blank = raw === "" || raw === null || raw === undefined;
    const n     = blank ? 0 : Number(raw);
    if (!blank && isNaN(n)) return;

    // The row being typed keeps the raw text — converting it here would turn
    // "5." into 5 and make the decimal point impossible to type. Zod coerces it
    // on submit, and the amount maths runs it through Number() anyway.
    const set     = (i, v) => setValue(`${fieldName}.${i}.percent`, v, { shouldDirty: true });
    const derived = (v) => (blank ? "" : v);

    set(idx, raw);
    if (idx === 0) {
      set(1, derived(n / 2));            // IGST → CGST and SGST take half each
      set(2, derived(n / 2));
    } else {
      set(idx === 1 ? 2 : 1, derived(n)); // CGST ⇄ SGST mirror each other…
      set(0, derived(n * 2));             // …and IGST is their sum
    }
  };

  const rows = [
    { idx: 0, checked: isIGST,     onToggle: handleIGST,     amount: igstAmt },
    { idx: 1, checked: isCGSTSGST, onToggle: handleCGSTSGST, amount: cgstAmt },
    { idx: 2, checked: isCGSTSGST, onToggle: handleCGSTSGST, amount: sgstAmt },
  ];

  return (
    <div className="border border-gray-300 rounded-sm overflow-hidden">
      <div className={`${ACC.gstHeader} px-3 py-[5px]`}>
        <span className={ACC.sectionTitle}>GST</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[460px] border-collapse text-[12px]">
          <thead>
            <tr className={ACC.tableHead}>
              <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[72px]">Select</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[76px]">CC Code</th>
              <th className="border border-gray-300 px-2 py-1.5 text-left  font-semibold w-[132px]">CC Name</th>
              {showDescription && (
                <th className="border border-gray-300 px-2 py-1.5 text-left font-semibold">Description</th>
              )}
              <th className="border border-gray-300 px-2 py-1.5 text-center font-semibold w-[86px]">%</th>
              <th className="border border-gray-300 px-2 py-1.5 text-right font-semibold w-[115px]">GST Amount</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ idx, checked, onToggle, amount }) => {
              const line = gstLines[idx] || EMPTY_GST_LINES[idx];
              return (
                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-[#fdf8f6]"}>
                  <td className="border border-gray-200 px-2 py-[3px] text-center">
                    <input
                      type="checkbox"
                      checked={!!checked}
                      onChange={(e) => !disabled && onToggle(e.target.checked)}
                      disabled={disabled}
                      className="w-[15px] h-[15px] accent-[#3b6ea5] cursor-pointer disabled:cursor-not-allowed"
                    />
                  </td>
                  <td className="border border-gray-200 px-2 py-[3px]">{line.ccCode}</td>
                  <td className="border border-gray-200 px-2 py-[3px]">{line.ccName}</td>

                  {showDescription && (
                    <td className="border border-gray-200 p-0 min-w-[100px]">
                      <Controller
                        name={`${fieldName}.${idx}.description`}
                        control={control}
                        render={({ field: f }) => (
                          <ExpandableTextCell
                            value={f.value || ""}
                            onChange={disabled ? undefined : f.onChange}
                            disabled={disabled}
                            placeholder="Description"
                            label="GST Description"
                          />
                        )}
                      />
                    </td>
                  )}

                  {/* Rate — typed by the user, spread across the other two rows */}
                  <td className="border border-gray-200 p-0.5">
                    <Controller
                      name={`${fieldName}.${idx}.percent`}
                      control={control}
                      render={({ field: f }) => (
                        <GstInput
                          {...f}
                          value={f.value ?? ""}
                          onChange={(e) => spreadRate(idx, e.target.value)}
                          disabled={disabled}
                          placeholder="0"
                          className={`w-full h-[26px] text-[12px] text-right rounded-sm border-0 outline-none focus-visible:ring-0 md:text-[12px] ${
                            disabled ? "bg-[#edf8ed] text-gray-500" : "bg-[#fffbe6] focus:bg-white"
                          }`}
                        />
                      )}
                    />
                  </td>

                  <td className="border border-gray-200 px-2 py-[3px] text-right font-medium">
                    {formatAmount(amount)}
                  </td>
                </tr>
              );
            })}

            <tr className={`${ACC.tableHead} font-semibold`}>
              <td
                colSpan={4 + (showDescription ? 1 : 0)}
                className="border border-gray-300 px-2 py-1.5 text-right text-[12px]"
              >
                TOTAL
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-right text-[12px]">
                {formatAmount(gstTotal)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
