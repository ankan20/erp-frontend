"use client";

import { Input } from "@/components/ui/input";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import SearchableSelect from "@/components/common/SearchableSelect";
import { getInputClass } from "@/lib/formStyles";
import { useColumnResize } from "@/hooks/useColumnResize";

// HEADER
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

// CELL
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

// READ ONLY
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

export default function SRNItemsTable({
  items,
  onItemChange,
  disabled,
  storeLocations = [],
}) {
  const { tableRef } = useColumnResize();
  if (!items?.length) {
    return (
      <div className="border rounded-sm p-4 text-center text-gray-400">
        Select an Order No from the left panel to load items
      </div>
    );
  }

  return (
    <div className="border border-[#b7bcc5] overflow-hidden">
      <div className="overflow-x-auto overflow-y-auto max-h-[840px] w-full">
        <table ref={tableRef} className="border-collapse text-[12px] min-w-[1050px] w-full">
          <thead>
            <tr>
              <TH w="50px"  center>SL no</TH>
              <TH w="90px">SRNL</TH>
              <TH w="120px" center>Item Code</TH>
              <TH w="160px" center>Item Name</TH>
              <TH w="180px" center>Note</TH>
              <TH w="70px"  center>Unit</TH>
              <TH w="90px">OrderQty</TH>
              <TH w="110px">Pre. Received Qty</TH>
              <TH w="110px" center>Balance Qty</TH>
              <TH w="130px" center>Current Received Qty</TH>
              <TH w="140px" center>Use Location</TH>
              <TH w="140px" center>Store Location</TH>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => {
              const balQty      = Number(item.balanceQty ?? 0);
              const effectiveMax = Number(item.effectiveMax ?? item.balanceQty ?? 0);
              const currQty     = item.currentReceivedQty;
              const currNum     = currQty === "" || currQty == null ? 0 : Number(currQty);
              const qtyError    = currNum > effectiveMax && currNum > 0;

              return (
                <tr key={item.orderItemId ?? index}>

                  <TD center>{index + 1}</TD>

                  <TD><ReadCell value={item.srnl} /></TD>

                  <TD><ReadCell value={item.itemCode} /></TD>

                  {/* ITEM NAME */}
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

                  {/* NOTE */}
                  <TD>
                    <ExpandableTextField
                      value={item.note || ""}
                      onChange={() => {}}
                      disabled
                      title="Note"
                      minHeight="min-h-[28px]"
                      modalHeight="min-h-[180px]"
                    />
                  </TD>

                  <TD><ReadCell value={item.itemUnit} /></TD>

                  <TD center><ReadCell value={item.orderQty} /></TD>

                  <TD center><ReadCell value={item.preReceivedQty} /></TD>

                  <TD center><ReadCell value={balQty} /></TD>

                  {/* CURRENT RECEIVED QTY */}
                  <TD>
                    <Input
                      type="number"
                      value={currQty ?? ""}
                      min="0"
                      step="any"
                      disabled={disabled}
                      onChange={(e) => onItemChange(index, "currentReceivedQty", e.target.value)}
                      title={qtyError ? `Max allowed: ${effectiveMax}` : undefined}
                      className={`${getInputClass(qtyError, disabled)} h-[28px]`}
                    />
                  </TD>

                  {/* USE LOCATION — always read-only, comes from API */}
                  <TD>
                    <ExpandableTextField
                      value={item.useLocation || ""}
                      onChange={() => {}}
                      disabled
                      title="Use Location"
                      minHeight="min-h-[28px]"
                    />
                  </TD>

                  {/* STORE LOCATION */}
                  <TD>
                    <SearchableSelect
                      options={storeLocations}
                      value={item.storeLocation || ""}
                      disabled={disabled}
                      onChange={(value) => onItemChange(index, "storeLocation", value)}
                      placeholder="Select store location"
                      labelKey="locationName"
                      valueKey="locationName"
                      searchKeys={["locationName"]}
                      className="rounded-none border-0"
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
