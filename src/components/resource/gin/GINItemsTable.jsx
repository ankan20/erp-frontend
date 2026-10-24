"use client";

import { Input } from "@/components/ui/input";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import SearchableSelect from "@/components/common/SearchableSelect";
import { getInputClass } from "@/lib/formStyles";
import { useColumnResize } from "@/hooks/useColumnResize";

// ── HEADER CELL ───────────────────────────────────────────────────────────────
const TH = ({ children, w = "auto", center = false }) => (
  <th
    style={{ minWidth: w, width: w }}
    className={`
      sticky top-0 z-10
      border border-[#b7bcc5]
      bg-[#d2d2d2]
      px-1 py-1
      text-[12px] font-semibold
      whitespace-nowrap align-middle
      ${center ? "text-center" : "text-left"}
    `}
  >
    {children}
  </th>
);

// ── DATA CELL ─────────────────────────────────────────────────────────────────
const TD = ({ children, center = false, className = "" }) => (
  <td
    className={`
      border border-[#d5d5d5]
      px-[2px] py-[2px]
      text-[12px] align-top
      bg-[#faf7e6]
      ${center ? "text-center" : ""}
      ${className}
    `}
  >
    {children}
  </td>
);

// ── READ-ONLY CELL ────────────────────────────────────────────────────────────
const ReadCell = ({ value, disabled = true }) => (
  <div
    className={`
      ${getInputClass(false, disabled)}
      h-[28px] px-2
      flex items-center
      text-[12px] border-0 bg-transparent
      min-w-[60px]
    `}
  >
    {value ?? ""}
  </div>
);

// ── COMPONENT ─────────────────────────────────────────────────────────────────
export default function GINItemsTable({ items, onItemChange, disabled, storeLocations = [] }) {
  const { tableRef } = useColumnResize();
  if (!items?.length) {
    return (
      <div className="border rounded-sm p-4 text-center text-[13px] text-gray-400 italic">
        Select an Order No from the left panel to load items
      </div>
    );
  }

  return (
    <div className="border border-[#b7bcc5] overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto max-h-[840px] w-full">
        <table ref={tableRef} className="border-collapse text-[12px] min-w-[1100px] w-full">
          <thead>
            <tr>
              <TH w="50px"  center>SL no</TH>
              <TH w="120px">Item Code</TH>
              <TH w="240px">Item Name</TH>
              <TH w="70px"  center>Unit</TH>
              <TH w="100px" center>Stock Qty</TH>
              <TH w="130px" center>Issue Qty</TH>
              <TH w="200px">Store Location</TH>
              <TH w="200px">Item Used Location</TH>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => {
              const stockQty = Number(item.stockQty ?? 0);
              const issueQty = item.issueQty;
              const issueNum = issueQty === "" || issueQty == null ? 0 : Number(issueQty);
              const qtyError = issueNum > stockQty && issueNum > 0;

              return (
                <tr key={item.orderItemId ?? index}>

                  <TD center>{index + 1}</TD>

                  <TD>
                    <ReadCell value={item.itemCode} />
                  </TD>

                  {/* ITEM NAME — expandable read-only */}
                  <TD>
                    <ExpandableTextField
                      value={item.itemName || ""}
                      onChange={() => {}}
                      disabled
                      title="Item Name"
                      minHeight="min-h-[28px]"
                      modalHeight="min-h-[180px]"
                    />
                  </TD>

                  <TD center>
                    <ReadCell value={item.itemUnit} />
                  </TD>

                  {/* STOCK QTY — read-only */}
                  <TD center>
                    <ReadCell value={stockQty} />
                  </TD>

                  {/* ISSUE QTY — editable, cell turns red if > stockQty */}
                  <TD>
                    <Input
                      type="number"
                      value={issueQty ?? ""}
                      min="0"
                      step="any"
                      disabled={disabled}
                      onChange={(e) => onItemChange(index, "issueQty", e.target.value)}
                      title={qtyError ? `Max allowed: ${stockQty}` : undefined}
                      className={`${getInputClass(qtyError, disabled)} h-[28px]`}
                    />
                  </TD>

                  {/* STORE LOCATION — searchable select */}
                  <TD>
                    <SearchableSelect
                      options={storeLocations}
                      value={item.stockLocation || ""}
                      disabled={disabled}
                      onChange={(value) => onItemChange(index, "stockLocation", value)}
                      placeholder="Select store"
                      labelKey="locationName"
                      valueKey="locationName"
                      searchKeys={["locationName"]}
                      className="rounded-none border-0"
                    />
                  </TD>

                  {/* ITEM USED LOCATION — always read-only, comes from API */}
                  <TD>
                    <ExpandableTextField
                      value={item.itemUsedLocation || ""}
                      onChange={() => {}}
                      disabled
                      title="Item Used Location"
                      minHeight="min-h-[28px]"
                    />
                  </TD>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
