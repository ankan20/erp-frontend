"use client";

import {
  useEffect,
  useMemo,
} from "react";

import { Checkbox } from "@/components/ui/checkbox";

import { Input } from "@/components/ui/input";

import { getInputClass } from "@/lib/formStyles";

export default function OrderSummaryTab({

  form,

  disabled,
}) {

  const {

    watch,

    setValue,
  } = form;

  const items =
    watch(
      "items",
    ) || [];

  const gstType =
    watch(
      "gstType",
    ) || "";

  // CALCULATIONS

  const calculations =
    useMemo(() => {

      const basicAmount =
        items.reduce(
          (
            total,
            item,
          ) =>

            total +
            Number(
              item.amount ||
                0,
            ),

          0,
        );

      const gstAmount =
        items.reduce(
          (
            total,
            item,
          ) =>

            total +
            Number(
              item.gstAmount ||
                0,
            ),

          0,
        );

      const totalAmount =

        basicAmount +
        gstAmount;

      return {

        basicAmount:
          Number(
            basicAmount.toFixed(
              3,
            ),
          ),

        gstAmount:
          Number(
            gstAmount.toFixed(
              3,
            ),
          ),

        totalAmount:
          Number(
            totalAmount.toFixed(
              3,
            ),
          ),
      };

    }, [items]);

  // SYNC SUMMARY

  useEffect(() => {

    setValue(

      "summary.basicAmount",

      calculations.basicAmount,
    );

    setValue(

      "summary.gstAmount",

      calculations.gstAmount,
    );

    setValue(

      "summary.totalAmount",

      calculations.totalAmount,
    );

  }, [
    calculations,
    setValue,
  ]);

  // GST LOGIC

  const isIGST =
    gstType ===
    "IGST";

  const isCGSTSGST =
    gstType ===
    "CGST_SGST";

  const handleIGST =
    (
      checked,
    ) => {

      if (
        checked
      ) {

        setValue(
          "gstType",
          "IGST",
        );

      } else {

        setValue(
          "gstType",
          "",
        );
      }
    };

  const handleCGSTSGST =
    (
      checked,
    ) => {

      if (
        checked
      ) {

        setValue(

          "gstType",

          "CGST_SGST",
        );

      } else {

        setValue(
          "gstType",
          "",
        );
      }
    };

  return (

    <div
      className="
        space-y-4
      "
    >

      {/* SUMMARY */}

      <div
        className="
          border
          rounded-md

          bg-white

          p-4
        "
      >

        <h2
          className="
            text-base
            font-semibold

            mb-4
          "
        >

          Summary

        </h2>

        <div
          className="
            overflow-x-auto
          "
        >

          <table
            className="
              w-full
              border-collapse
            "
          >

            <tbody>

              {/* BASIC */}

              <tr>

                <td className="border p-3 font-medium bg-gray-50 w-[300px]">
                  Basic Amount
                </td>

                <td className="border p-3">

                  <Input

                    value={
                      calculations.basicAmount
                    }

                    disabled

                    className={getInputClass(
                      null,
                      true,
                    )}
                  />

                </td>

              </tr>

              {/* GST */}

              <tr>

                <td className="border p-3 font-medium bg-gray-50">
                  GST Amount
                </td>

                <td className="border p-3">

                  <Input

                    value={
                      calculations.gstAmount
                    }

                    disabled

                    className={getInputClass(
                      null,
                      true,
                    )}
                  />

                </td>

              </tr>

              {/* TOTAL */}

              <tr>

                <td className="border p-3 font-medium bg-gray-50">
                  Total Invoice Amount
                </td>

                <td className="border p-3">

                  <Input

                    value={
                      calculations.totalAmount
                    }

                    disabled

                    className={getInputClass(
                      null,
                      true,
                    )}
                  />

                </td>

              </tr>

            </tbody>

          </table>

        </div>

      </div>

      {/* GST SECTION */}

      <div
        className="
          border
          rounded-md

          bg-white

          p-4
        "
      >

        <h2
          className="
            text-base
            font-semibold

            mb-4
          "
        >

          GST Selection

        </h2>

        <div
          className="
            flex
            flex-wrap
            items-center

            gap-6
          "
        >

          {/* IGST */}

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <Checkbox

              checked={
                isIGST
              }

              disabled={
                disabled
              }

              onCheckedChange={
                handleIGST
              }
            />

            <label
              className="
                text-sm
                font-medium
              "
            >

              IGST

            </label>

          </div>

          {/* CGST */}

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <Checkbox

              checked={
                isCGSTSGST
              }

              disabled={
                disabled
              }

              onCheckedChange={
                handleCGSTSGST
              }
            />

            <label
              className="
                text-sm
                font-medium
              "
            >

              CGST

            </label>

          </div>

          {/* SGST */}

          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <Checkbox

              checked={
                isCGSTSGST
              }

              disabled={
                disabled
              }

              onCheckedChange={
                handleCGSTSGST
              }
            />

            <label
              className="
                text-sm
                font-medium
              "
            >

              SGST

            </label>

          </div>

        </div>

      </div>

    </div>
  );
}