"use client";

// ─────────────────────────────────────────────────────────────────────────────
// LOGISTICS FORM PRIMITIVES
//
// Design brief: modern-classic ERP logistics. Not a SaaS card kit.
// The signature detail is the field row — it looks like a line on a
// shipping manifest: tan paper-strip label with a hi-viz amber tick,
// white input area to the right, and rows stack with shared borders so
// a filled section reads as one printed form.
//
// Color tokens (deliberately local to logistics):
//   ink       #0F2A3C  (deep navy — primary text / structure)
//   amber     #C97B2E  (shipping hi-viz — THE module's accent)
//   paper     #FBFAF6  (warm section background — never pure white)
//   strip     #F5E9D9  (tan label strip background)
//   line      #CBD5DD  (cool graphite — rules & borders)
// ─────────────────────────────────────────────────────────────────────────────

// A field row inside a LogisticsSection.
// Rows share borders with siblings — no gap between them.
//
// The input cell uses arbitrary-child selectors to force every nested
// shadcn Input / SelectTrigger / textarea / SearchableSelect button to
// be edge-to-edge: no visible border, no rounded corners, no inner shadow.
// The row's own border is the frame. On focus-within, the cell shifts
// to warm paper so the active row reads clearly.
export function LogisticsField({ label, required, error, children, className = "" }) {
  // Neutralise visible borders/rounding/bg on EVERY input-like child the cell
  // may contain — plain <input>, GstInput/AmountInput (<div><input>), shadcn
  // Select trigger (<button role="combobox">), SearchableSelect trigger
  // (<div><button>), textarea, and ExpandableTextField (<div role="button">).
  // Depth-2 selectors catch wrapped widgets; the row border + focus-within ring
  // provide the visual frame. Dropdown items inside SearchableSelect are at
  // depth 3+ and remain untouched.
  const cellInputReset = [
    // native + wrapped <input> (shadcn Input, GstInput, AmountInput)
    "[&_input]:!border-0 [&_input]:!rounded-none [&_input]:!shadow-none",
    "[&_input]:!bg-transparent [&_input]:!w-full [&_input]:!h-[32px] [&_input]:!text-[13px]",
    "[&_input]:focus-visible:!ring-0 [&_input]:focus-visible:!ring-offset-0 [&_input]:focus:!outline-none",
    // shadcn Select trigger (direct child button[role=combobox])
    "[&>button]:!border-0 [&>button]:!rounded-none [&>button]:!shadow-none",
    "[&>button]:!bg-transparent [&>button]:!w-full [&>button]:!h-[32px] [&>button]:!px-2 [&>button]:!text-[13px]",
    "[&>button]:focus:!ring-0 [&>button]:focus:!ring-offset-0 [&>button]:focus:!outline-none",
    // SearchableSelect trigger (nested button one level in)
    "[&>div>button]:!border-0 [&>div>button]:!rounded-none [&>div>button]:!shadow-none",
    "[&>div>button]:!bg-transparent [&>div>button]:!w-full [&>div>button]:!h-[32px] [&>div>button]:!px-2 [&>div>button]:!text-[13px]",
    "[&>div>button]:focus:!ring-0 [&>div>button]:focus:!outline-none",
    // textarea
    "[&_textarea]:!border-0 [&_textarea]:!rounded-none [&_textarea]:!shadow-none",
    "[&_textarea]:!bg-transparent [&_textarea]:!w-full [&_textarea]:!px-2 [&_textarea]:!text-[13px]",
    "[&_textarea]:focus-visible:!ring-0 [&_textarea]:focus-visible:!outline-none",
    // ExpandableTextField — its clickable surface is a div[role="button"]
    "[&>div[role='button']]:!border-0 [&>div[role='button']]:!rounded-none [&>div[role='button']]:!shadow-none",
    "[&>div[role='button']]:!bg-transparent [&>div[role='button']]:!min-h-[32px] [&>div[role='button']]:!px-2 [&>div[role='button']]:!text-[13px]",
    "[&>div[role='button']]:hover:!bg-[#FFFCF5]",
  ].join(" ");

  return (
    <div
      className={[
        "flex flex-col sm:flex-row items-stretch",
        "border-t border-[#CBD5DD] first:border-t-0",
        error ? "bg-rose-50/40" : "",
        "focus-within:bg-[#FFFCF5]",
        className,
      ].filter(Boolean).join(" ")}
    >
      {/* Paper-strip label */}
      <div
        className={[
          "relative flex items-center",
          "sm:w-[160px] sm:shrink-0",
          "bg-[#F5E9D9] sm:border-r border-[#CBD5DD]",
          "pl-4 pr-2 py-1.5 sm:py-0",
          "min-h-[34px]",
        ].join(" ")}
      >
        {/* Hi-viz amber tick */}
        <span className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#C97B2E]" aria-hidden="true" />
        <span className="text-[12.5px] font-medium text-[#0F2A3C] leading-tight">
          {label}
        </span>
        {required ? (
          <span
            className="inline-block ml-1.5 w-1.5 h-1.5 rounded-full bg-[#C97B2E]"
            aria-label="required"
          />
        ) : null}
      </div>

      {/* Input cell — children fill it edge-to-edge */}
      <div
        className={[
          "flex-1 min-w-0 flex items-stretch bg-white",
          "focus-within:ring-1 focus-within:ring-[#C97B2E] focus-within:ring-inset",
          cellInputReset,
        ].join(" ")}
      >
        {children}
      </div>
    </div>
  );
}

// A section groups related field rows. Header is a tally bar + sequence number.
// Pass `seq={1|2|3…}` to show the small amber number in the top-right.
export function LogisticsSection({ title, icon: Icon, children, right, seq }) {
  return (
    <section className="bg-[#FBFAF6] border border-[#CBD5DD]">
      <header className="flex items-center justify-between px-3 py-2 bg-white border-b border-[#CBD5DD]">
        <div className="flex items-center gap-2.5">
          {/* Three amber tally squares — module signature */}
          <span className="flex items-center gap-[2px]" aria-hidden="true">
            <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
            <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
            <span className="w-[6px] h-[6px] bg-[#C97B2E]" />
          </span>
          {Icon ? <Icon className="w-3.5 h-3.5 text-[#0F2A3C]" /> : null}
          <h3 className="text-[11px] font-bold tracking-[0.15em] uppercase text-[#0F2A3C]">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {right}
          {seq != null && (
            <span className="font-mono text-[11px] tabular-nums text-[#C97B2E] font-bold">
              {String(seq).padStart(2, "0")}
            </span>
          )}
        </div>
      </header>
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

// ─── Input classes ──────────────────────────────────────────────────────────
//
// Inputs live INSIDE a row's white input cell. The row's borders provide the
// visual frame, so inputs themselves are borderless by default. On focus they
// gain an amber 1px ring so the user always knows where the cursor is.
// Numbers use tabular-nums.

export const LOGISTICS_INPUT =
  "w-full h-[28px] px-1 text-[13px] bg-transparent border-0 " +
  "focus:outline-none focus:ring-1 focus:ring-[#C97B2E] focus:ring-inset " +
  "disabled:text-[#0F2A3C]/90 tabular-nums";

export const LOGISTICS_INPUT_ERR =
  "w-full h-[28px] px-1 text-[13px] bg-rose-50 border-0 text-rose-900 " +
  "focus:outline-none focus:ring-1 focus:ring-rose-400 focus:ring-inset " +
  "tabular-nums";

export const inputCls = (err, _disabled) =>
  err ? LOGISTICS_INPUT_ERR : LOGISTICS_INPUT;

// Read-only text display for a cell — used for auto-generated numbers
// (TR No / DC No / LB No). On create it shows an italic hint; once the
// record is saved it shows the number in monospace, no visible input.
export function LogisticsReadOnly({ value, hint = "Auto-generated on save", mono = true }) {
  const cls = [
    "flex-1 flex items-center px-2 min-h-[32px] text-[13px]",
    value ? "text-[#0F2A3C] font-semibold" : "text-[#4B5A66]/70 italic text-[12.5px]",
    value && mono ? "font-mono tabular-nums tracking-tight" : "",
  ].filter(Boolean).join(" ");
  return <span className={cls}>{value || hint}</span>;
}
