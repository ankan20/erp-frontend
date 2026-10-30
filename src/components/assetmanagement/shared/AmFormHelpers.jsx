"use client";

import { Input } from "@/components/ui/input";
import { getInputClass } from "@/lib/formStyles";
import { getfmtDisplaydate } from "@/helper/getfmtDisplayDate";
import { formatAmount, formatQtyDisplay } from "@/helper/numberFormatter";
import SearchableSelect from "@/components/common/SearchableSelect";
import ExpandableTextArea from "@/components/common/ExpandableTextArea";
import AmountInput from "@/components/common/AmountInput";
import QtyInput from "@/components/common/QtyInput";

// ─── Normalize options: string[] | {value,label}[] → [{value,label}] ──────────
function normalizeOptions(options = []) {
  if (!options.length) return [];
  if (typeof options[0] === "string") return options.map((s) => ({ value: s, label: s }));
  return options;
}

// ─── Layout primitives ────────────────────────────────────────────────────────
export function FieldRow({ label, children, required }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function FormGrid({ children, cols = 3 }) {
  const colClass = { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3", 4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" }[cols] || "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  return <div className={`grid ${colClass} gap-x-4 gap-y-3`}>{children}</div>;
}

export function SectionCard({ title, children, action }) {
  return (
    <div className="rounded-lg border border-[#dde5ef] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#144664] text-white">
        <h3 className="text-sm font-semibold tracking-wide">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ─── Text input — uses project Input + getInputClass ──────────────────────────
export function TextInput({ value, onChange, placeholder, disabled, readOnly, hasError, className = "" }) {
  const isDisabled = disabled || readOnly;
  return (
    <Input
      value={value ?? ""}
      onChange={(e) => !isDisabled && onChange?.(e.target.value)}
      placeholder={placeholder}
      disabled={isDisabled}
      readOnly={readOnly && !disabled}
      className={`${getInputClass(hasError, isDisabled)} ${className}`}
    />
  );
}

// ─── Searchable select — wraps SearchableSelect ───────────────────────────────
export function SelectInput({ value, onChange, options = [], placeholder, disabled, hasError, searchKeys }) {
  const normalized = normalizeOptions(options);
  const keys = searchKeys || ["label"];
  return (
    <SearchableSelect
      options={normalized}
      value={value ?? ""}
      onChange={onChange}
      placeholder={placeholder || "Select..."}
      labelKey="label"
      valueKey="value"
      searchKeys={keys}
      disabled={disabled}
      className={hasError ? "ring-1 ring-red-500 rounded-sm" : ""}
      clearLabel={placeholder || "Select..."}
    />
  );
}

// ─── Date input — uses project Input + getInputClass ─────────────────────────
export function DateInput({ value, onChange, disabled, min, max, hasError }) {
  return (
    <Input
      type="date"
      value={value ?? ""}
      min={min}
      max={max}
      onChange={(e) => !disabled && onChange?.(e.target.value)}
      disabled={disabled}
      className={getInputClass(hasError, disabled)}
    />
  );
}

// ─── Date display — formats stored dates nicely for read-only show ─────────────
export function DateDisplay({ value }) {
  return (
    <Input
      value={getfmtDisplaydate(value) || "—"}
      disabled
      className={getInputClass(false, true)}
    />
  );
}

// ─── Expandable textarea — wraps ExpandableTextArea ──────────────────────────
export function TextArea({ value, onChange, disabled, placeholder, rows = 3, hasError, title }) {
  return (
    <ExpandableTextArea
      value={value ?? ""}
      onChange={disabled ? undefined : onChange}
      disabled={disabled}
      placeholder={placeholder || "Enter text…"}
      rows={rows}
      hasError={hasError}
      title={title}
    />
  );
}

// ─── Amount field — AmountInput (edit) or formatAmount display (disabled) ─────
// Use this for ALL monetary / ₹ values
export function AmountField({ value, onChange, disabled, readOnly, placeholder, hasError, className = "" }) {
  const isDisabled = disabled || readOnly;
  return (
    <AmountInput
      value={value ?? ""}
      onChange={(e) => !isDisabled && onChange?.(e.target.value)}
      disabled={isDisabled}
      placeholder={placeholder}
      className={`${getInputClass(hasError, isDisabled)} ${className}`}
    />
  );
}

// ─── Qty field — QtyInput (edit) or formatQtyDisplay (disabled) ───────────────
// Use this for counts / quantities
export function QtyField({ value, onChange, disabled, readOnly, placeholder, hasError, className = "" }) {
  const isDisabled = disabled || readOnly;
  return (
    <QtyInput
      value={value ?? ""}
      onChange={(e) => !isDisabled && onChange?.(e.target.value)}
      disabled={isDisabled}
      placeholder={placeholder}
      className={`${getInputClass(hasError, isDisabled)} ${className}`}
    />
  );
}

// ─── Plain number input — for non-monetary integers (downtime hrs, useful life)
export function NumberInput({ value, onChange, disabled, readOnly, placeholder, min, max, hasError, className = "" }) {
  const isDisabled = disabled || readOnly;
  return (
    <Input
      type="number"
      value={value ?? ""}
      onChange={(e) => !isDisabled && onChange?.(e.target.value)}
      disabled={isDisabled}
      placeholder={placeholder}
      min={min}
      max={max}
      className={`${getInputClass(hasError, isDisabled)} ${className}`}
    />
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
const STATUS_MAP = {
  draft:           { label: "Draft",           cls: "bg-gray-100 text-gray-600" },
  pending:         { label: "Pending",          cls: "bg-yellow-100 text-yellow-700" },
  under_review:    { label: "Under Review",     cls: "bg-yellow-100 text-yellow-700" },
  approved:        { label: "Approved",         cls: "bg-green-100 text-green-700" },
  in_transit:      { label: "In Transit",       cls: "bg-blue-100 text-blue-700" },
  completed:       { label: "Completed",        cls: "bg-emerald-100 text-emerald-700" },
  rejected:        { label: "Rejected",         cls: "bg-red-100 text-red-600" },
  cancelled:       { label: "Cancelled",        cls: "bg-red-100 text-red-600" },
  reported:        { label: "Reported",         cls: "bg-orange-100 text-orange-700" },
  scheduled:       { label: "Scheduled",        cls: "bg-blue-100 text-blue-700" },
  in_progress:     { label: "In Progress",      cls: "bg-amber-100 text-amber-700" },
  closed:          { label: "Closed",           cls: "bg-gray-100 text-gray-600" },
  active:          { label: "Active",           cls: "bg-emerald-100 text-emerald-700" },
  extended:        { label: "Extended",         cls: "bg-purple-100 text-purple-700" },
  returned:        { label: "Returned",         cls: "bg-emerald-100 text-emerald-700" },
  overdue:         { label: "Overdue",          cls: "bg-red-100 text-red-600" },
  disposed:        { label: "Disposed",         cls: "bg-gray-100 text-gray-500" },
  written_off:     { label: "Written Off",      cls: "bg-gray-100 text-gray-500" },
  issued:          { label: "Issued",           cls: "bg-blue-100 text-blue-700" },
  partial_returned:{ label: "Partial Return",   cls: "bg-amber-100 text-amber-700" },
  lost:            { label: "Lost",             cls: "bg-red-100 text-red-700" },
  damaged:         { label: "Damaged",          cls: "bg-orange-100 text-orange-700" },
  in_maintenance:  { label: "In Maintenance",   cls: "bg-amber-100 text-amber-700" },
  transferred:     { label: "Transferred",      cls: "bg-sky-100 text-sky-700" },
  inactive:        { label: "Inactive",         cls: "bg-gray-100 text-gray-500" },
};

export function AmStatusBadge({ status }) {
  const s = STATUS_MAP[status] || { label: status || "—", cls: "bg-gray-100 text-gray-600" };
  return (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── Asset picker row (used inside AssetPickerModal) ─────────────────────────
export function AssetPickerRow({ asset, isSelected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(asset)}
      className={`w-full text-left px-3 py-2 border-b border-gray-100 text-[13px] hover:bg-[#d6e6f2] transition-colors ${isSelected ? "bg-[#d6e6f2]" : "bg-white"}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <span className="font-medium text-gray-800">{asset.assetId}</span>
          <span className="mx-2 text-gray-400">·</span>
          <span className="text-gray-700">{asset.assetName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-gray-500">{asset.category}</span>
          <AmStatusBadge status={asset.status} />
        </div>
      </div>
      {asset.location && (
        <div className="text-[11px] text-gray-400 mt-0.5">{asset.location}</div>
      )}
    </button>
  );
}
