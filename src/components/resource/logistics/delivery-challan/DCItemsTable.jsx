"use client";

import { Input } from "@/components/ui/input";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { getInputClass } from "@/lib/formStyles";
import { useColumnResize } from "@/hooks/useColumnResize";

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

const ReadCell = ({ value }) => (
  <div
    className={`
      ${getInputClass(false, true)}
      h-[28px] px-2
      flex items-center
      text-[12px] border-0 bg-transparent
      min-w-[60px]
    `}
  >
    {value ?? ""}
  </div>
);

export default function DCItemsTable({ items, onItemChange, disabled }) {
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
        <table ref={tableRef} className="border-collapse text-[12px] min-w-[900px] w-full">
          <thead>
            <tr>
              <TH w="50px"  center>SL no</TH>
              <TH w="120px">Item Code</TH>
              <TH w="240px">Item Name</TH>
              <TH w="70px"  center>Unit</TH>
              <TH w="100px" center>Balance Qty</TH>
              <TH w="130px" center>Issue Qty</TH>
              <TH w="180px">Stock Location</TH>
            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => {
              const balanceQty = Number(item.balanceQty ?? 0);
              const issueQty   = item.issueQty;
              const issueNum   = issueQty === "" || issueQty == null ? 0 : Number(issueQty);
              const qtyError   = issueNum > balanceQty && issueNum > 0;

              return (
                <tr key={item.orderItemId ?? index}>
                  <TD center>{index + 1}</TD>

                  <TD>
                    <ReadCell value={item.itemCode} />
                  </TD>

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

                  <TD center>
                    <ReadCell value={balanceQty} />
                  </TD>

                  <TD>
                    <Input
                      type="number"
                      value={issueQty ?? ""}
                      min="0"
                      step="any"
                      disabled={disabled}
                      onChange={(e) => onItemChange(index, "issueQty", e.target.value)}
                      title={qtyError ? `Max allowed: ${balanceQty}` : undefined}
                      className={`${getInputClass(qtyError, disabled)} h-[28px]`}
                    />
                  </TD>

                  <TD>
                    <ReadCell value={item.stockLocation} />
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
