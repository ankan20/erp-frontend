"use client";

import { Pencil } from "lucide-react";
import ExpandableTextField from "@/components/common/ExpandableTextField";
import { getInputClass } from "@/lib/formStyles";
import GRNItemSelectionModal from "../modals/GRNItemSelectionModal";
import SRNItemSelectionModal from "../modals/SRNItemSelectionModal";

const TH = ({ children, w = "auto", center = false }) => (
  <th
    style={{ minWidth: w, width: w }}
    className={`sticky top-0 z-10 border border-[#b7bcc5] bg-[#d2d2d2] px-1 py-1 text-[12px] font-semibold whitespace-nowrap align-middle ${center ? "text-center" : "text-left"}`}
  >
    {children}
  </th>
);

const TD = ({ children, center = false, className = "" }) => (
  <td className={`border border-[#d5d5d5] px-[2px] py-[2px] text-[12px] align-top bg-[#faf7e6] ${center ? "text-center" : ""} ${className}`}>
    {children}
  </td>
);

const ReadCell = ({ value }) => (
  <div className={`${getInputClass(false, true)} h-[28px] px-2 flex items-center text-[12px] border-0 bg-transparent min-w-[60px]`}>
    {value ?? ""}
  </div>
);

const inr = (n) =>
  n > 0
    ? Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "";

function calcAmounts(item) {
  const qty      = Number(item.billingQty ?? 0);
  const rate     = Number(item.rate ?? 0);
  const gstPct   = Number(item.gstPercent ?? 0);
  const amount   = qty * rate;
  const gstAmt   = amount * gstPct / 100;
  const totalAmt = amount + gstAmt;
  return {
    amount:    inr(amount),
    gstAmount: inr(gstAmt),
    totalAmt:  inr(totalAmt),
  };
}

const FTD = ({ children, align = "left", colSpan }) => (
  <td
    colSpan={colSpan}
    className={`border border-[#b7bcc5] px-2 py-[3px] text-[12px] font-semibold bg-[#dcefd4] whitespace-nowrap ${
      align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left"
    }`}
  >
    {children ?? ""}
  </td>
);

export default function BRRBillingDetailsTab({
  form,
  disabled,
  billingType,
  brrId,
  brrContext = null,
  onContextFetched,
  openItemModal,
  setOpenItemModal,
}) {
  const items = form.watch("items") || [];
  const isGRN = billingType === "grn";

  const totals = items.reduce(
    (acc, item) => {
      const qty    = Number(item.billingQty ?? 0);
      const rate   = Number(item.rate ?? 0);
      const gstPct = Number(item.gstPercent ?? 0);
      const amt    = qty * rate;
      const gst    = amt * gstPct / 100;
      acc.amount += amt;
      acc.gst    += gst;
      acc.total  += amt + gst;
      return acc;
    },
    { amount: 0, gst: 0, total: 0 },
  );

  const fmt = (n) => inr(n);

  if (!items.length) {
    return (
      <>
        <div className="border rounded-sm p-4 text-center text-gray-400">
          {isGRN ? "Add GRN items using the button above" : "Add SRN items using the button above"}
        </div>
        {isGRN
          ? <GRNItemSelectionModal open={openItemModal} onClose={() => setOpenItemModal(false)} form={form} brrId={brrId} initialData={brrContext} onFetched={onContextFetched} />
          : <SRNItemSelectionModal open={openItemModal} onClose={() => setOpenItemModal(false)} form={form} brrId={brrId} initialData={brrContext} onFetched={onContextFetched} />
        }
      </>
    );
  }

  return (
    <div className="w-full bg-white">
      <div className="border border-gray-300">
        <div className="w-full bg-[#DCE8D2] border-b border-gray-300 px-4 py-1">
          <h2 className="text-[15px] font-semibold text-black">{isGRN ? "GRN Items List" : "SRN Items List"}</h2>
        </div>
        <div className="overflow-x-auto overflow-y-auto max-h-[680px] w-full">
          {isGRN ? (
            <table className="border-collapse text-[12px] min-w-[1400px] w-full">
              <thead>
                <tr>
                  <TH w="50px"  center>Sl.</TH>
                  <TH w="110px">GRN No</TH>
                  <TH w="90px">GRN Date</TH>
                  <TH w="70px">GRNL</TH>
                  <TH w="110px">Item Code</TH>
                  <TH w="180px">Item Name</TH>
                  <TH w="130px">Note</TH>
                  <TH w="55px"  center>Unit</TH>
                  <TH w="85px"  center>Rcvd Qty</TH>
                  <TH w="75px"  center>Rate</TH>
                  <TH w="90px"  center>Amount</TH>
                  <TH w="60px"  center>GST %</TH>
                  <TH w="85px"  center>GST Amt</TH>
                  <TH w="90px"  center>Total Amt</TH>
                  <TH w="150px">Use Location</TH>
                  <TH w="150px">Store Location</TH>
                  {!disabled && <TH w="45px" center>Edit</TH>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const { amount, gstAmount, totalAmt } = calcAmounts(item);
                  return (
                    <tr key={item.grnItemId ?? index}>
                      <TD center>{index + 1}</TD>
                      <TD><ReadCell value={item.grnNo} /></TD>
                      <TD><ReadCell value={item.grnDate} /></TD>
                      <TD><ReadCell value={item.grnl} /></TD>
                      <TD><ReadCell value={item.itemCode} /></TD>
                      <TD>
                        <ExpandableTextField value={item.itemName || ""} onChange={() => {}} disabled title="Item Name" minHeight="min-h-[28px]" modalHeight="min-h-[180px]" />
                      </TD>
                      <TD>
                        <ExpandableTextField value={item.note || ""} onChange={() => {}} disabled title="Note" minHeight="min-h-[28px]" modalHeight="min-h-[180px]" />
                      </TD>
                      <TD center><ReadCell value={item.itemUnit} /></TD>
                      <TD center><ReadCell value={item.receivedQty} /></TD>
                      <TD center><ReadCell value={item.rate} /></TD>
                      <TD center><ReadCell value={amount} /></TD>
                      <TD center><ReadCell value={item.gstPercent} /></TD>
                      <TD center><ReadCell value={gstAmount} /></TD>
                      <TD center><ReadCell value={totalAmt} /></TD>
                      <TD>
                        <ExpandableTextField value={item.useLocation || ""} onChange={() => {}} disabled title="Use Location" minHeight="min-h-[28px]" modalHeight="min-h-[180px]" />
                      </TD>
                      <TD>
                        <ExpandableTextField value={item.storeLocation || ""} onChange={() => {}} disabled title="Store Location" minHeight="min-h-[28px]" modalHeight="min-h-[180px]" />
                      </TD>
                      {!disabled && (
                        <TD center>
                          <button type="button" onClick={() => setOpenItemModal(true)} className="text-blue-500 hover:text-blue-700">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </TD>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <FTD colSpan={10} align="right">Total</FTD>
                  <FTD>{fmt(totals.amount)}</FTD>
                  <FTD />
                  <FTD>{fmt(totals.gst)}</FTD>
                  <FTD>{fmt(totals.total)}</FTD>
                  <FTD colSpan={disabled ? 2 : 3} />
                </tr>
              </tfoot>
            </table>
          ) : (
            <table className="border-collapse text-[12px] min-w-[1300px] w-full">
              <thead>
                <tr>
                  <TH w="50px"  center>Sl.</TH>
                  <TH w="110px">SRN No</TH>
                  <TH w="90px">SRN Date</TH>
                  <TH w="70px">SRNL</TH>
                  <TH w="110px">Item Code</TH>
                  <TH w="180px">Item Name</TH>
                  <TH w="55px"  center>Unit</TH>
                  <TH w="85px"  center>Rcvd Qty</TH>
                  <TH w="75px"  center>Rate</TH>
                  <TH w="90px"  center>Amount</TH>
                  <TH w="60px"  center>GST %</TH>
                  <TH w="85px"  center>GST Amt</TH>
                  <TH w="90px"  center>Total Amt</TH>
                  <TH w="150px">Use Location</TH>
                  <TH w="150px">Store Location</TH>
                  {!disabled && <TH w="45px" center>Edit</TH>}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const { amount, gstAmount, totalAmt } = calcAmounts(item);
                  return (
                    <tr key={item.srnItemId ?? index}>
                      <TD center>{index + 1}</TD>
                      <TD><ReadCell value={item.srnNo} /></TD>
                      <TD><ReadCell value={item.srnDate} /></TD>
                      <TD><ReadCell value={item.srnl} /></TD>
                      <TD><ReadCell value={item.itemCode} /></TD>
                      <TD>
                        <ExpandableTextField value={item.itemName || ""} onChange={() => {}} disabled title="Item Name" minHeight="min-h-[28px]" modalHeight="min-h-[180px]" />
                      </TD>
                      <TD center><ReadCell value={item.itemUnit} /></TD>
                      <TD center><ReadCell value={item.receivedQty} /></TD>
                      <TD center><ReadCell value={item.rate} /></TD>
                      <TD center><ReadCell value={amount} /></TD>
                      <TD center><ReadCell value={item.gstPercent} /></TD>
                      <TD center><ReadCell value={gstAmount} /></TD>
                      <TD center><ReadCell value={totalAmt} /></TD>
                      <TD>
                        <ExpandableTextField value={item.useLocation || ""} onChange={() => {}} disabled title="Use Location" minHeight="min-h-[28px]" modalHeight="min-h-[180px]" />
                      </TD>
                      <TD>
                        <ExpandableTextField value={item.storeLocation || ""} onChange={() => {}} disabled title="Store Location" minHeight="min-h-[28px]" modalHeight="min-h-[180px]" />
                      </TD>
                      {!disabled && (
                        <TD center>
                          <button type="button" onClick={() => setOpenItemModal(true)} className="text-blue-500 hover:text-blue-700">
                            <Pencil className="w-4 h-4" />
                          </button>
                        </TD>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr>
                  <FTD colSpan={9} align="right">Total</FTD>
                  <FTD>{fmt(totals.amount)}</FTD>
                  <FTD />
                  <FTD>{fmt(totals.gst)}</FTD>
                  <FTD>{fmt(totals.total)}</FTD>
                  <FTD colSpan={disabled ? 2 : 3} />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {isGRN
        ? <GRNItemSelectionModal open={openItemModal} onClose={() => setOpenItemModal(false)} form={form} brrId={brrId} initialData={brrContext} onFetched={onContextFetched} />
        : <SRNItemSelectionModal open={openItemModal} onClose={() => setOpenItemModal(false)} form={form} brrId={brrId} initialData={brrContext} onFetched={onContextFetched} />
      }
    </div>
  );
}
