"use client";

import { useEffect, useMemo } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { amountToWordsIN } from "@/lib/amountToWords";

export default function OrderSummaryTab({
  form,
  disabled,
}) {
  const {
    watch,

    setValue,
  } = form;

  const items = watch("items") || [];

  const gstType = watch("gstType") || "";

  const ccSummary = watch("ccSummary") || [];

  const backendBasicAmount = Number(watch("basicAmount") || 0);

  const backendGstAmount = Number(watch("gstAmount") || 0);

  const backendTotalAmount = Number(watch("totalAmount") || 0);

  // CALCULATIONS

  // const calculations = useMemo(() => {
  //   const basicAmount = items.reduce(
  //     (total, item) => total + Number(item.amount || 0),

  //     0,
  //   );

  //   const gstAmount = items.reduce(
  //     (total, item) => total + Number(item.gstAmount || 0),

  //     0,
  //   );

  //   const totalAmount = basicAmount + gstAmount;

  //   return {
  //     basicAmount: Number(basicAmount.toFixed(2)),

  //     gstAmount: Number(gstAmount.toFixed(2)),

  //     totalAmount: Number(totalAmount.toFixed(2)),
  //   };
  // }, [items]);

  // // SUMMARY SYNC

  // useEffect(() => {
  //   setValue(
  //     "summary.basicAmount",

  //     calculations.basicAmount,
  //   );

  //   setValue(
  //     "summary.gstAmount",

  //     calculations.gstAmount,
  //   );

  //   setValue(
  //     "summary.totalAmount",

  //     calculations.totalAmount,
  //   );
  // }, [calculations, setValue]);

  // GST LOGIC

  const isIGST = gstType === "IGST";

  const isCGSTSGST = gstType === "CGST_SGST";

  const handleIGST = (checked) => {
    if (checked) {
      setValue("gstType", "IGST");
    } else {
      setValue("gstType", "");
    }
  };

  const handleCGSTSGST = (checked) => {
    if (checked) {
      setValue(
        "gstType",

        "CGST_SGST",
      );
    } else {
      setValue("gstType", "");
    }
  };

  // GST VALUES

  const igstAmount = isIGST ? backendGstAmount : 0;

  const cgstAmount = isCGSTSGST ? backendGstAmount / 2 : 0;

  const sgstAmount = isCGSTSGST ? backendGstAmount / 2 : 0;

  const amountInWords = amountToWordsIN(backendTotalAmount);

  return (
    <div
      className="
        space-y-3
      "
    >
      {/* BASIC TABLE */}

      <div
        className="
          border
          border-gray-300
        "
      >
        {/* HEADER */}

        <div
          className="
            w-full

            bg-[#DCE8D2]

            border-b
            border-gray-300

            px-4
            py-1
          "
        >
          <h2
            className="
              text-[15px]
              font-semibold
            "
          >
            BASIC
          </h2>
        </div>

        {/* TABLE */}
        <div
          className="
    max-h-[295px]
    overflow-y-auto
  "
        >
          <table
            className="
            w-full
            border-collapse
          "
          >
            <thead>
              <tr
                className="
                bg-[#D3D3D3]
              "
              >
                <th className="border px-2 py-1 text-sm w-[90px]">Sl no</th>

                <th className="border px-2 py-1 text-sm w-[180px]">CC Code</th>

                <th className="border px-2 py-1 text-sm">CC Name</th>

                <th className="border px-2 py-1 text-sm w-[180px]">
                  Basic Amount
                </th>
              </tr>
            </thead>

            <tbody>
              {ccSummary.length
                ? ccSummary.map((item, index) => (
                    <tr key={index}>
                      <td className="border px-2 py-[2px] text-center text-sm">
                        {index + 1}
                      </td>

                      <td className="border px-2 py-[2px] text-sm">
                        {item.ccCode}
                      </td>

                      <td className="border px-2 py-[2px] text-sm">
                        {item.ccName}
                      </td>

                      <td className="border px-2 py-[2px] text-right text-sm">
                        {Number(item.basicAmount || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))
                : Array.from({
                    length: 6,
                  }).map((_, index) => (
                    <tr key={index}>
                      <td className="border px-2 py-[2px] h-[26px]" />

                      <td className="border px-2 py-[2px]" />

                      <td className="border px-2 py-[2px]" />

                      <td className="border px-2 py-[2px]" />
                    </tr>
                  ))}

              {/* TOTAL */}

              <tr
                className="
                bg-[#D3D3D3]
                font-semibold
              "
              >
                <td className="border px-2 py-1" />

                <td className="border px-2 py-1" />

                <td className="border px-2 py-1 text-center text-sm">TOTAL</td>

                <td className="border px-2 py-1 text-center text-sm">
                  {backendBasicAmount.toFixed(2)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* GST TABLE */}

      <div
        className="
          border
          border-gray-300
        "
      >
        {/* HEADER */}

        <div
          className="
            w-full

            bg-[#F5E4D7]

            border-b
            border-gray-300

            px-4
            py-1
          "
        >
          <h2
            className="
              text-[15px]
              font-semibold
            "
          >
            GST
          </h2>
        </div>

        {/* TABLE */}

        <table
          className="
            w-full
            border-collapse
          "
        >
          <thead>
            <tr
              className="
                bg-[#D3D3D3]
              "
            >
              <th className="border px-2 py-1 text-sm w-[120px]">Select</th>

              <th className="border px-2 py-1 text-sm w-[180px]">CC Code</th>

              <th className="border px-2 py-1 text-sm">CC Name</th>

              <th className="border px-2 py-1 text-sm w-[180px]">GST Amount</th>
            </tr>
          </thead>

          <tbody>
            {/* IGST */}

            <tr>
              <td className="border px-2 py-[2px] text-center">
                <Checkbox
                  checked={isIGST}
                  disabled={false}
                  onCheckedChange={handleIGST}
                />
              </td>

              <td className="border px-2 py-[2px] text-sm">IGST</td>

              <td className="border px-2 py-[2px] text-sm">Input-IGST</td>

              <td className="border px-2 py-[2px] text-right text-sm">
                {igstAmount.toFixed(2)}
              </td>
            </tr>

            {/* CGST */}

            <tr>
              <td className="border px-2 py-[2px] text-center">
                <Checkbox
                  checked={isCGSTSGST}
                  disabled={false}
                  onCheckedChange={handleCGSTSGST}
                />
              </td>

              <td className="border px-2 py-[2px] text-sm">CGST</td>

              <td className="border px-2 py-[2px] text-sm">Input-CGST</td>

              <td className="border px-2 py-[2px] text-right text-sm">
                {cgstAmount.toFixed(2)}
              </td>
            </tr>

            {/* SGST */}

            <tr>
              <td className="border px-2 py-[2px] text-center">
                <Checkbox
                  checked={isCGSTSGST}
                  disabled={false}
                  onCheckedChange={handleCGSTSGST}
                />
              </td>

              <td className="border px-2 py-[2px] text-sm">SGST</td>

              <td className="border px-2 py-[2px] text-sm">Input-SGST</td>

              <td className="border px-2 py-[2px] text-right text-sm">
                {sgstAmount.toFixed(2)}
              </td>
            </tr>

            {/* TOTAL */}

            <tr
              className="
                bg-[#D3D3D3]
                font-semibold
              "
            >
              <td className="border px-2 py-1" />

              <td className="border px-2 py-1" />

              <td className="border px-2 py-1 text-center text-sm">TOTAL</td>

              <td className="border px-2 py-1 text-center text-sm">
                {backendGstAmount.toFixed(2)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* TOTAL SECTION */}

      <div
        className="
          space-y-0.5
        "
      >
        {/* BASIC */}

        <div
          className="
            flex
            items-center
          "
        >
          <div
            className="
              w-[80%]
              bg-[#DCE8D2]
              border
              px-4
              py-1
              text-[16px]
              font-semibold
              rounded-sm
            "
          >
            Basic Amount
          </div>

          <div
            className="
              w-[20%]
              bg-[#D5DBE6]
              border
              px-4
              py-1
              text-right
              text-[16px]
              font-semibold
              rounded-sm
            "
          >
            {backendBasicAmount.toFixed(2)}
          </div>
        </div>

        {/* GST */}

        <div
          className="
            flex
            items-center
          "
        >
          <div
            className="
              w-[80%]
              bg-[#DCE8D2]
              border
              px-4
              py-1
              text-[16px]
              font-semibold
              rounded-sm
            "
          >
            GST Amount
          </div>

          <div
            className="
              w-[20%]
              bg-[#D5DBE6]
              border
              px-4
              py-1
              text-right
              text-[16px]
              font-semibold
              rounded-sm
            "
          >
            {backendGstAmount.toFixed(2)}
          </div>
        </div>

        {/* TOTAL */}

        <div
          className="
            flex
            items-center
          "
        >
          <div
            className="
              w-[80%]
              bg-[#DCE8D2]
              border
              px-4
              py-1
              text-[16px]
              font-bold
              rounded-sm
            "
          >
            Total Invoice Amount (Rs.)
          </div>

          <div
            className="
              w-[20%]
              bg-[#F2B07E]
              border
              px-4
              py-1
              text-right
              text-[16px]
              font-bold
              rounded-sm
            "
          >
            {backendTotalAmount.toFixed(2)}
          </div>
        </div>

        {/* AMOUNT IN WORD */}

        <div
          className="
            flex
            items-center
            mt-1.5
          "
        >
          <div
            className="
              w-[180px]
              bg-[#DCE8D2]
              border
              px-3
              py-1
              text-[15px]
              font-semibold
              rounded-sm
            "
          >
            Amount (In word)
          </div>

          <div
            className="
              flex-1
              bg-[#F8EFC8]
              border
              px-4
              py-1
              text-[15px]
              rounded-sm
            "
          >
            {amountInWords}
          </div>
        </div>
      </div>
    </div>
  );
}
