"use client";

import { Input } from "@/components/ui/input";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { getInputClass } from "@/lib/formStyles";

// HEADER
const TH = ({ children, w = "auto", center = false }) => (
  <th
    style={{
      minWidth: w,
      width: w,
    }}
    className={`
      sticky top-0 z-10
      border border-[#b7bcc5]
      bg-[#d2d2d2]
      px-1 py-1
      text-[12px]
      font-semibold
      whitespace-nowrap
      align-middle
      ${center ? "text-center" : "text-left"}
    `}
  >
    {children}
  </th>
);

// CELL
const TD = ({
  children,
  center = false,
  className = "",
}) => (
  <td
    className={`
      border border-[#d5d5d5]
      px-[2px]
      py-[2px]
      text-[12px]
      align-top
      bg-[#faf7e6]
      ${center ? "text-center" : ""}
      ${className}
    `}
  >
    {children}
  </td>
);

// READ ONLY
const ReadCell = ({
  value,
  disabled = true,
}) => (
  <div
    className={`
      ${getInputClass(false, disabled)}
      h-[28px]
      px-2
      flex
      items-center
      text-[12px]
      border-0
      bg-transparent
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
}) {
  if (!items?.length) {
    return (
      <div className="border rounded-sm p-4 text-center text-gray-400">
        Select an Order No from the left panel to load items
      </div>
    );
  }

  return (
    <div className="border border-[#b7bcc5]  overflow-hidden">

      {/* BOTH X + Y SCROLL */}
      <div
        className="
          overflow-x-auto
          overflow-y-auto
          max-h-[840px]
          w-full
        "
      >
        <table
          className="
            border-collapse
            text-[12px]
            min-w-[1320px]
            w-full
          "
        >
          <thead>
            <tr>

              <TH w="50px" center>
                SL no
              </TH>

              {/* <TH w="100px">
                Indent No
              </TH> */}

              <TH w="90px">
                SRNL
              </TH>

              <TH w="120px" center>
                Item Code
              </TH>

              <TH w="240px" center>
                Item Name
              </TH>

              <TH w="180px" center>
                Note
              </TH>

              <TH w="70px" center>
                Unit
              </TH>

              <TH w="90px" >
                OrderQty
              </TH>

              <TH w="110px" >
                Pre.
                Received
                Qty
              </TH>

              <TH w="110px" center>
                Balance
                Qty
              </TH>

              <TH w="130px" center>
                Current
                Received
                Qty
              </TH>

              <TH w="220px" center>
                Use Location
              </TH>

              <TH w="220px" center>
                Store Location
              </TH>

            </tr>
          </thead>

          <tbody>
            {items.map((item, index) => {
              const balQty =
                Number(item.balanceQty ?? 0);

              const currQty =
                item.currentReceivedQty;

              const currNum =
                currQty === "" ||
                currQty == null
                  ? 0
                  : Number(currQty);

              const qtyError =
                currNum > balQty &&
                currNum > 0;

              return (
                <tr key={item.orderItemId ?? index}>

                  <TD center>
                    {index + 1}
                  </TD>

                  {/* <TD>
                    <ReadCell value={item.indentNo} />
                  </TD> */}

                  <TD>
                    <ReadCell value={item.srnl} />
                  </TD>

                  <TD>
                    <ReadCell value={item.itemCode} />
                  </TD>

                  {/* ITEM */}
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

                  <TD >
                    <ReadCell value={item.itemUnit} />
                  </TD>

                  <TD center>
                    <ReadCell value={item.orderQty} />
                  </TD>

                  <TD center>
                    <ReadCell value={item.preReceivedQty} />
                  </TD>

                  <TD center>
                    <ReadCell value={balQty} />
                  </TD>

                  {/* CURRENT */}
                  <TD>
                    <div>
                      <Input
                        type="number"
                        value={currQty ?? ""}
                        min="0"
                        step="any"
                        disabled={disabled}
                        onChange={(e) =>
                          onItemChange(
                            index,
                            "currentReceivedQty",
                            e.target.value
                          )
                        }
                        className={`
                          ${getInputClass(
                            qtyError,
                            disabled
                          )}
                          h-[28px]
                        `}
                      />

                      {qtyError && (
                        <p className="text-red-500 text-[10px] mt-1">
                          Max {balQty}
                        </p>
                      )}
                    </div>
                  </TD>

                  {/* USE LOCATION */}
                  <TD>
                    <ExpandableTextField
                      value={item.useLocation || ""}
                      disabled={disabled}
                      title="Use Location"
                      placeholder="Block A"
                      minHeight="min-h-[28px]"
                      onChange={(v) =>
                        onItemChange(
                          index,
                          "useLocation",
                          v
                        )
                      }
                    />
                  </TD>

                  {/* STORE LOCATION */}
                  <TD>
                    <ExpandableTextField
                      value={item.storeLocation || ""}
                      disabled={disabled}
                      title="Store Location"
                      placeholder="Store 1"
                      minHeight="min-h-[28px]"
                      onChange={(v) =>
                        onItemChange(
                          index,
                          "storeLocation",
                          v
                        )
                      }
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