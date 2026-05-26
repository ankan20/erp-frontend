"use client";

import { useState } from "react";

import {
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";

import { Button } from "@/components/ui/button";

import ExpandableTextField from "@/components/common/ExpandableTextField";

import TermsSelectionModal from "../modals/TermsSelectionModal";

export default function OrderTermsTab({

  form,

  disabled,
}) {

  const [openTermsModal, setOpenTermsModal] =
    useState(false);

  const terms =
    form.watch(
      "terms",
    ) || [];

  const handleDelete =
    (
      index,
    ) => {

      const updated =
        [...terms];

      updated.splice(
        index,
        1,
      );

      form.setValue(
        "terms",
        updated,
      );
    };

  return (

    <div
      className="
        border
        rounded-md

        bg-white

        p-4
      "
    >

      {/* HEADER */}

      <div
        className="
          flex
          items-center
          justify-between

          gap-3

          mb-4
        "
      >

        <h2
          className="
            text-base
            font-semibold
          "
        >

          Terms & Conditions

        </h2>

        {!disabled && (

          <Button

            type="button"

            onClick={() =>
              setOpenTermsModal(
                true,
              )
            }

            className="
              h-9
              px-4
            "
          >

            <Plus
              className="
                w-4
                h-4
                mr-1
              "
            />

            Add Terms

          </Button>
        )}

      </div>

      {/* EMPTY */}

      {!terms.length && (

        <div
          className="
            h-[120px]

            border
            border-dashed

            rounded-md

            flex
            items-center
            justify-center

            text-sm
            text-gray-500
          "
        >

          No Terms Added

        </div>
      )}

      {/* TABLE */}

      {!!terms.length && (

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

            <thead>

              <tr
                className="
                  bg-gray-100
                "
              >

                <th className="border p-2 text-sm min-w-[180px]">
                  Header
                </th>

                <th className="border p-2 text-sm min-w-[180px]">
                  Sub Header
                </th>

                <th className="border p-2 text-sm min-w-[320px]">
                  Description
                </th>

                {!disabled && (

                  <th className="border p-2 text-sm min-w-[120px]">
                    Action
                  </th>
                )}

              </tr>

            </thead>

            <tbody>

              {terms.map(
                (
                  term,
                  index,
                ) => (

                  <tr
                    key={
                      term.termId
                    }
                  >

                    {/* HEADER */}

                    <td className="border p-2 text-sm">

                      {term.header}

                    </td>

                    {/* SUB HEADER */}

                    <td className="border p-2 text-sm">

                      {term.subHeader}

                    </td>

                    {/* DESCRIPTION */}

                    <td className="border p-2 align-top">

                      <ExpandableTextField

                        value={
                          term.description
                        }

                        disabled

                        title="Term Description"

                        placeholder="No Description"

                        minHeight="min-h-[42px]"

                        modalHeight="min-h-[220px]"
                      />

                    </td>

                    {/* ACTION */}

                    {!disabled && (

                      <td className="border p-2">

                        <div
                          className="
                            flex
                            items-center
                            justify-center

                            gap-3
                          "
                        >

                          <button

                            type="button"

                            onClick={() =>
                              setOpenTermsModal(
                                true,
                              )
                            }

                            className="
                              text-blue-600

                              hover:text-blue-800
                            "
                          >

                            <Pencil
                              className="
                                w-4
                                h-4
                              "
                            />

                          </button>

                          <button

                            type="button"

                            onClick={() =>
                              handleDelete(
                                index,
                              )
                            }

                            className="
                              text-red-500

                              hover:text-red-700
                            "
                          >

                            <Trash2
                              className="
                                w-4
                                h-4
                              "
                            />

                          </button>

                        </div>

                      </td>
                    )}

                  </tr>
                ),
              )}

            </tbody>

          </table>

        </div>
      )}

      {/* MODAL */}

      <TermsSelectionModal

        open={
          openTermsModal
        }

        onClose={() =>
          setOpenTermsModal(
            false,
          )
        }

        form={form}

        disabled={
          disabled
        }
      />

    </div>
  );
}