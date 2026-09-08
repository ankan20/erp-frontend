"use client";

import { ACC }             from "./accountTheme";
import { amountToWordsIN } from "@/lib/amountToWords";
import AmountInput         from "@/components/common/AmountInput";
import { formatAmount }    from "@/helper/numberFormatter";

// formatAmount() returns "" for empty/NaN — summary cells always want a number
const fmt = (val) => formatAmount(Number(val) || 0);

const fmtRoundOff = (val) => {
  const n = Number(val) || 0;
  if (n === 0) return "0.00";
  return `${n > 0 ? "+" : "-"}${formatAmount(Math.abs(n))}`;
};

const ROW   = "flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-1.5";
const LABEL = `rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] font-semibold sm:flex-1 ${ACC.summaryLabelBg}`;
const VALUE = "rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] text-right font-semibold sm:w-[180px] sm:shrink-0 break-all";

export default function AccountSummary({
  basicTotal   = 0,
  gstTotal     = 0,
  totalInvoice = 0,
  register,
  watch,
  disabled     = false,
  wordsLabel   = "Amount (In word)",
}) {
  // Raw form value — keep it unconverted so partial input ("12.") stays typable
  const discountRaw      = watch ? watch("discount") : 0;
  const discountVal      = Number(discountRaw) || 0;
  const hasDiscountError = basicTotal > 0 && discountVal > basicTotal;

  // Clamp helper — called from discount onChange before passing to RHF.
  // AmountInput already blocks negatives and >2 decimals, so only the
  // basicTotal ceiling needs rewriting; everything else passes through as typed.
  const clampDiscount = (e, rhfOnChange) => {
    const val = parseFloat(e.target.value);
    if (!isNaN(val) && basicTotal > 0 && val > basicTotal) {
      e.target.value = String(basicTotal);
    }
    rhfOnChange?.(e);
  };

  const { onChange: discountOnChange, ...discountProps } =
    register ? register("discount") : {};

  return (
    <div className="space-y-1.5">

      {/* Basic Amount */}
      <div className={ROW}>
        <div className={LABEL}>Basic Amount</div>
        <div className={`${VALUE} ${ACC.summaryValueBg}`}>{fmt(basicTotal)}</div>
      </div>

      {/* GST Amount */}
      <div className={ROW}>
        <div className={LABEL}>GST Amount</div>
        <div className={`${VALUE} ${ACC.summaryValueBg}`}>{fmt(gstTotal)}</div>
      </div>

      {/* Discount */}
      <div className={ROW}>
        <div className={LABEL}>Discount</div>
        <div className={`rounded-sm border overflow-hidden sm:w-[180px] sm:shrink-0 ${
          hasDiscountError ? "border-red-500" : "border-gray-300"
        }`}>
          <AmountInput
            {...discountProps}
            value={discountRaw ?? ""}
            onChange={(e) => clampDiscount(e, discountOnChange)}
            disabled={disabled}
            placeholder="0.00"
            className={`w-full min-h-[34px] h-full text-[13px] md:text-[13px] text-right px-3 border-0 rounded-none outline-none focus-visible:ring-0 ${
              disabled
                ? ACC.inputDisabled
                : hasDiscountError
                ? ACC.inputError
                : "bg-white"
            }`}
          />
        </div>
      </div>
      {hasDiscountError && (
        <p className="text-[11px] text-red-500 text-right pr-0.5">
          Discount cannot exceed Basic Amount ({fmt(basicTotal)})
        </p>
      )}

      {/* Round On/Off — auto-calculated, always read-only */}
      {(() => {
        const roundOffVal = watch ? Number(watch("roundOff") || 0) : 0;
        const isPos = roundOffVal > 0;
        const isNeg = roundOffVal < 0;
        return (
          <div className={ROW}>
            <div className={LABEL}>Round On/Off.</div>
            <div className={`${VALUE} ${ACC.summaryValueBg} ${isPos ? "text-green-700" : isNeg ? "text-red-600" : ""}`}>
              {fmtRoundOff(roundOffVal)}
            </div>
          </div>
        );
      })()}

      {/* Total Invoice Amount */}
      <div className={ROW}>
        <div className={`${LABEL} font-bold`}>Total Invoice Amount (Rs.)</div>
        <div className={`${VALUE} ${ACC.totalValueBg} font-bold`}>{fmt(totalInvoice)}</div>
      </div>

      {/* Amount in words */}
      <div className="flex flex-col sm:flex-row sm:items-stretch gap-1 sm:gap-1.5">
        <div className={`rounded-sm border border-gray-300 px-3 py-[7px] text-[13px] font-semibold sm:w-[180px] sm:shrink-0 ${ACC.wordsLabelBg}`}>
          {wordsLabel}
        </div>
        <div className={`flex-1 rounded-sm border border-gray-300 px-3 py-[7px] text-[12px] leading-relaxed italic ${ACC.wordsValueBg}`}>
          {totalInvoice > 0
            ? amountToWordsIN(totalInvoice)
            : <span className="text-gray-400 not-italic">Auto Generated number to word</span>}
        </div>
      </div>

    </div>
  );
}
