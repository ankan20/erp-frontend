"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Check,
  Loader2,
  Search,
} from "lucide-react";

import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { Checkbox } from "@/components/ui/checkbox";

import { Input } from "@/components/ui/input";

import ExpandableTextField from "@/components/common/ExpandableTextField";

import { apiRequest } from "@/lib/apiClient";

import { API_ENDPOINTS } from "@/config/api.config";

export default function TermsSelectionModal({

  open,

  onClose,

  form,
}) {

  const [loading, setLoading] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [terms, setTerms] =
    useState([]);

  const [tempTerms, setTempTerms] =
    useState([]);

  const existingTerms =
    form.watch(
      "terms",
    ) || [];

  // LOAD TERMS

  useEffect(() => {

    if (!open) {
      return;
    }

    const fetchTerms =
      async () => {

        try {

          setLoading(
            true,
          );

          const res =
            await apiRequest({

              url:
                `${API_ENDPOINTS.MASTER.TERM.LIST}?module=Order`,

              method:
                "GET",
            });

          const apiTerms =
            res.data || [];

          const merged =
            apiTerms.map(
              (
                item,
              ) => {

                const existing =
                  existingTerms.find(
                    (
                      term,
                    ) =>

                      String(
                        term.termId,
                      ) ===
                      String(
                        item.termId,
                      ),
                  );

                return {

                  termId:
                    item.termId,

                  header:
                    item.header,

                  subHeader:
                    item.sub_header,

                  description:
                    existing?.description ||

                    item.term_description ||

                    "",

                  selected:
                    !!existing,
                };
              },
            );

          setTerms(
            merged,
          );

          setTempTerms(
            merged,
          );

        } catch {

          toast.error(
            "Failed to load terms",
          );

        } finally {

          setLoading(
            false,
          );
        }
      };

    fetchTerms();

  }, [
    open,
    existingTerms,
  ]);

  // SEARCH

  const filteredTerms =
    useMemo(() => {

      if (
        !search
      ) {

        return tempTerms;
      }

      return tempTerms.filter(
        (
          item,
        ) =>

          Object.values(
            item,
          ).some(
            (
              value,
            ) =>

              String(
                value,
              )

                .toLowerCase()

                .includes(
                  search.toLowerCase(),
                ),
          ),
      );

    }, [
      search,
      tempTerms,
    ]);

  // SELECT ALL

  const allSelected =

    filteredTerms.length > 0 &&

    filteredTerms.every(
      (
        item,
      ) => item.selected,
    );

  const handleSelectAll =
    (
      checked,
    ) => {

      setTempTerms(
        (
          prev,
        ) =>

          prev.map(
            (
              item,
            ) => ({

              ...item,

              selected:
                checked,
            }),
          ),
      );
    };

  // SINGLE SELECT

  const handleSelect =
    (
      termId,
      checked,
    ) => {

      setTempTerms(
        (
          prev,
        ) =>

          prev.map(
            (
              item,
            ) =>

              String(
                item.termId,
              ) ===
              String(
                termId,
              )

                ? {

                    ...item,

                    selected:
                      checked,
                  }

                : item,
          ),
      );
    };

  // DESCRIPTION CHANGE

  const handleDescriptionChange =
    (
      termId,
      value,
    ) => {

      setTempTerms(
        (
          prev,
        ) =>

          prev.map(
            (
              item,
            ) =>

              String(
                item.termId,
              ) ===
              String(
                termId,
              )

                ? {

                    ...item,

                    description:
                      value,
                  }

                : item,
          ),
      );
    };

  // SUBMIT

  const handleSubmit =
    () => {

      const selected =
        tempTerms.filter(
          (
            item,
          ) => item.selected,
        );

      const formatted =
        selected.map(
          (
            item,
          ) => ({

            termId:
              item.termId,

            header:
              item.header,

            subHeader:
              item.subHeader,

            description:
              item.description,
          }),
        );

      form.setValue(
        "terms",
        formatted,
      );

      onClose?.();
    };

  return (

    <Dialog
      open={open}
      onOpenChange={(
        value,
      ) => {

        if (!value) {

          onClose?.();
        }
      }}
    >

      <DialogContent
        className="
          min-w-[95vw]
          max-w-[95vw]

          lg:min-w-[1200px]
          lg:max-w-[1200px]

          p-0
          gap-0
        "
      >

        {/* HEADER */}

        <DialogHeader
          className="
            px-6
            py-4

            border-b

            bg-slate-50
          "
        >

          <DialogTitle
            className="
              text-lg
              font-semibold
            "
          >

            Select Terms & Conditions

          </DialogTitle>

        </DialogHeader>

        {/* SEARCH */}

        <div
          className="
            p-4
            border-b
          "
        >

          <div
            className="
              relative
              w-full
              max-w-[350px]
            "
          >

            <Search
              className="
                absolute
                left-3
                top-1/2
                -translate-y-1/2

                w-4
                h-4

                text-gray-400
              "
            />

            <Input

              value={
                search
              }

              onChange={(
                e,
              ) =>
                setSearch(
                  e.target
                    .value,
                )
              }

              placeholder="Search Terms"

              className="
                pl-9
              "
            />

          </div>

        </div>

        {/* TABLE */}

        <div
          className="
            overflow-auto

            max-h-[65vh]
          "
        >

          <table
            className="
              w-full
              border-collapse
            "
          >

            <thead
              className="
                sticky
                top-0
                z-10

                bg-gray-100
              "
            >

              <tr>

                <th className="border p-2 min-w-[70px]">

                  <div
                    className="
                      flex
                      justify-center
                    "
                  >

                    <Checkbox

                      checked={
                        allSelected
                      }

                      onCheckedChange={
                        handleSelectAll
                      }
                    />

                  </div>

                </th>

                <th className="border p-2 min-w-[220px] text-sm">
                  Header
                </th>

                <th className="border p-2 min-w-[220px] text-sm">
                  Sub Header
                </th>

                <th className="border p-2 min-w-[400px] text-sm">
                  Description
                </th>

              </tr>

            </thead>

            <tbody>

              {loading && (

                <tr>

                  <td
                    colSpan={4}
                    className="
                      h-[200px]
                      text-center
                    "
                  >

                    <div
                      className="
                        flex
                        justify-center
                      "
                    >

                      <Loader2
                        className="
                          w-6
                          h-6
                          animate-spin
                        "
                      />

                    </div>

                  </td>

                </tr>
              )}

              {!loading &&
                !filteredTerms.length && (

                <tr>

                  <td
                    colSpan={4}
                    className="
                      h-[140px]
                      text-center
                      text-gray-500
                    "
                  >

                    No Terms Found

                  </td>

                </tr>
              )}

              {!loading &&
                filteredTerms.map(
                  (
                    item,
                  ) => (

                    <tr
                      key={
                        item.termId
                      }
                    >

                      {/* SELECT */}

                      <td className="border p-2">

                        <div
                          className="
                            flex
                            justify-center
                          "
                        >

                          <Checkbox

                            checked={
                              item.selected
                            }

                            onCheckedChange={(
                              checked,
                            ) =>
                              handleSelect(

                                item.termId,

                                checked,
                              )
                            }
                          />

                        </div>

                      </td>

                      {/* HEADER */}

                      <td className="border p-2 text-sm">

                        {item.header}

                      </td>

                      {/* SUB HEADER */}

                      <td className="border p-2 text-sm">

                        {item.subHeader}

                      </td>

                      {/* DESCRIPTION */}

                      <td className="border p-2 align-top">

                        <ExpandableTextField

                          value={
                            item.description
                          }

                          onChange={(
                            value,
                          ) =>
                            handleDescriptionChange(

                              item.termId,

                              value,
                            )
                          }

                          disabled={
                            !item.selected
                          }

                          title="Term Description"

                          placeholder="Enter Description"

                          minHeight="min-h-[42px]"

                          modalHeight="min-h-[220px]"
                        />

                      </td>

                    </tr>
                  ),
                )}

            </tbody>

          </table>

        </div>

        {/* FOOTER */}

        <div
          className="
            flex
            justify-end
            gap-3

            border-t

            px-6
            py-4
          "
        >

          <Button

            type="button"

            variant="outline"

            onClick={
              onClose
            }
          >

            Cancel

          </Button>

          <Button

            type="button"

            onClick={
              handleSubmit
            }
          >

            <Check
              className="
                w-4
                h-4
                mr-1
              "
            />

            Add Selected Terms

          </Button>

        </div>

      </DialogContent>

    </Dialog>
  );
}