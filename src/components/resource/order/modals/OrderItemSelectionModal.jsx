"use client";

import { useEffect, useMemo, useState } from "react";

import { Check, Loader2, Search } from "lucide-react";

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

import { apiRequest } from "@/lib/apiClient";

import { API_ENDPOINTS } from "@/config/api.config";

import { getLocalStorage } from "@/lib/localStorage";

import { getInputClass } from "@/lib/formStyles";

import ExpandableTextField from "@/components/common/ExpandableTextField";

export default function OrderItemSelectionModal({
  open,

  onClose,

  form,
}) {
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState("");

  const [items, setItems] = useState([]);

  const [tempRows, setTempRows] = useState([]);

  const projectInfo = getLocalStorage("projectInfo");

  const projectCode = projectInfo?.projectCode;

  // CHANGED: costHead determines assetOnly — Fixed Asset = true, else false
  const costHead = form.watch("costHead");
  const existingItems = form.watch("items") || [];

  // LOAD ITEMS

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!costHead) {
      toast.error("Please select cost head first");
      onClose?.();
      return;
    }

    const fetchItems = async () => {
      try {
        setLoading(true);

        // CHANGED: costHead determines assetOnly; subCategoryCode always MAT_001
        const assetOnly = costHead === "Fixed_Asset";

        const res = await apiRequest({
          url: `${API_ENDPOINTS.RESOURCE.PROCUREMENT.ORDER.GET_INDENT_LIST}?projectCode=${projectCode}&subCategoryCode=MAT_001&assetOnly=${assetOnly}`,
          method: "GET",
        });

        const apiItems = res.data || [];

        // MERGE PREVIOUS SELECTED ITEMS

        const merged = apiItems.map((item) => {
          const existing = existingItems.find(
            (ex) => String(ex.indentItemId) === String(item.indentItemId),
          );

          return {
            ...item,

            selected: !!existing,

            orderQty: existing?.qty || item.orderQty || item.balanceQty,

            note: existing?.note || item.note || "",

            location: existing?.location || item.location || "",

            rate: existing?.rate || "",

            gstPercent: existing?.gstPercent || "",
          };
        });

        setItems(merged);

        setTempRows(merged);
      } catch {
        toast.error("Failed to load items");
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [open, costHead, projectCode, existingItems, onClose]);

  // SEARCH FILTER

  const filteredItems = useMemo(() => {
    if (!search) {
      return tempRows;
    }

    return tempRows.filter((item) =>
      Object.values(item).some((value) =>
        String(value)
          .toLowerCase()

          .includes(search.toLowerCase()),
      ),
    );
  }, [search, tempRows]);

  // SELECT ALL

  const allSelected =
    filteredItems.length > 0 && filteredItems.every((item) => item.selected);

  const handleSelectAll = (checked) => {
    setTempRows((prev) =>
      prev.map((item) => ({
        ...item,

        selected: checked,
      })),
    );
  };

  // SINGLE SELECT

  const handleSelect = (id, checked) => {
    setTempRows((prev) =>
      prev.map((item) =>
        String(item.indentItemId) === String(id)
          ? {
              ...item,

              selected: checked,
            }
          : item,
      ),
    );
  };

  // QTY CHANGE

  const handleQtyChange = (id, value) => {
    setTempRows((prev) =>
      prev.map((item) => {
        if (String(item.indentItemId) !== String(id)) {
          return item;
        }

        return {
          ...item,

          orderQty: value,
        };
      }),
    );
  };

  // SUBMIT

  const handleSubmit = () => {
    const selectedRows = tempRows.filter((item) => item.selected);

    // VALIDATIONS

    for (const item of selectedRows) {
      const qty = Number(item.orderQty);

      const balance = Number(item.balanceQty);

      if (qty < 0.001) {
        toast.error(`${item.itemName} qty must be greater than 0`);

        return;
      }

      if (qty > balance) {
        toast.error(`${item.itemName} qty exceeds balance qty`);

        return;
      }
    }

    // BUILD FINAL ITEMS
    //change
    
    const formatted = selectedRows.map((item) => ({
      indentItemId: item.indentItemId,

      indentNo: item.indentNo,

      itemCode: item.itemCode,

      itemName: item.itemName,

      itemUnit: item.itemUnit || "",

      qty: item.orderQty,

      rate: item.rate || "",

      gstPercent: item.gstPercent || "",

      amount: Number(
        (Number(item.orderQty || 0) * Number(item.rate || 0)).toFixed(3),
      ),

      gstAmount: Number(
        (
          (Number(item.orderQty || 0) *
            Number(item.rate || 0) *
            Number(item.gstPercent || 0)) /
          100
        ).toFixed(3),
      ),

      location: item.location || "",

      note: item.note || "",
    }));

    const existingSavedItems = existingItems.filter(
      (existing) =>
        !formatted.some(
          (newItem) =>
            String(newItem.indentItemId) === String(existing.indentItemId),
        ),
    );

    form.setValue(
      "items",

      [...existingSavedItems, ...formatted],

      {
        shouldValidate: true,
        shouldDirty: true,
      },
    );

    // form.setValue("items", formatted);

    onClose?.();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) {
          onClose?.();
        }
      }}
    >
      <DialogContent
        className="
          min-w-[95vw]
          max-w-[95vw]

          lg:min-w-[1400px]
          lg:max-w-[1400px]

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
            Select Order Items
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
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Items"
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
                {/* SELECT */}

                <th className="border p-2 min-w-[70px]">
                  <div
                    className="
                      flex
                      justify-center
                    "
                  >
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </div>
                </th>

                <th className="border p-2 min-w-[130px] text-sm">Indent No</th>

                <th className="border p-2 min-w-[130px] text-sm">Item Code</th>

                <th className="border p-2 min-w-[220px] text-sm">Item Name</th>

                <th className="border p-2 min-w-[100px] text-sm">Unit</th>

                <th className="border p-2 min-w-[120px] text-sm">Indent Qty</th>

                <th className="border p-2 min-w-[120px] text-sm">Used Qty</th>

                <th className="border p-2 min-w-[120px] text-sm">
                  Balance Qty
                </th>

                <th className="border p-2 min-w-[140px] text-sm">Order Qty</th>

                <th className="border p-2 min-w-[200px] text-sm">Note</th>

                <th className="border p-2 min-w-[200px] text-sm">Location</th>
              </tr>
            </thead>

            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={11}
                    className="
                      h-[200px]
                      text-center
                    "
                  >
                    <div
                      className="
                        flex
                        items-center
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

              {!loading && !filteredItems.length && (
                <tr>
                  <td
                    colSpan={9}
                    className="
                      h-[140px]
                      text-center
                      text-gray-500
                    "
                  >
                    No Items Found
                  </td>
                </tr>
              )}

              {!loading &&
                filteredItems.map((item) => {
                  const qtyError =
                    Number(item.orderQty) < 0.001 ||
                    Number(item.orderQty) > Number(item.balanceQty);

                  return (
                    <tr key={item.indentItemId}>
                      {/* SELECT */}

                      <td className="border p-2">
                        <div
                          className="
                              flex
                              justify-center
                            "
                        >
                          <Checkbox
                            checked={item.selected}
                            onCheckedChange={(checked) =>
                              handleSelect(
                                item.indentItemId,

                                checked,
                              )
                            }
                          />
                        </div>
                      </td>

                      {/* INDENT */}

                      <td className="border p-2 text-sm">{item.indentNo}</td>

                      {/* CODE */}

                      <td className="border p-2 text-sm">{item.itemCode}</td>

                      {/* NAME */}

                      <td className="border p-2">
                        <ExpandableTextField
                          value={item.itemName}
                          disabled
                          title="Item Name"
                          placeholder="Item Name"
                          minHeight="min-h-[38px]"
                          modalHeight="min-h-[180px]"
                        />
                      </td>

                      {/* UNIT */}

                      <td className="border p-2 text-sm">
                        {item.itemUnit || "-"}
                      </td>

                      {/* INDENT QTY */}

                      <td className="border p-2 text-sm">{item.indentQty}</td>

                      {/* USED */}

                      <td className="border p-2 text-sm">{item.usedQty}</td>

                      {/* BAL */}

                      <td className="border p-2 text-sm">{item.balanceQty}</td>

                      {/* ORDER QTY */}

                      <td className="border p-2">
                        <Input
                          type="number"
                          step="0.001"
                          value={item.orderQty}
                          disabled={!item.selected}
                          onChange={(e) =>
                            handleQtyChange(
                              item.indentItemId,

                              e.target.value,
                            )
                          }
                          className={getInputClass(
                            qtyError,

                            !item.selected,
                          )}
                        />
                      </td>

                      {/* NOTE */}

                      <td className="border p-2">
                        <ExpandableTextField
                          value={item.note}
                          disabled
                          title="Note"
                          placeholder="Note"
                          minHeight="min-h-[38px]"
                          modalHeight="min-h-[180px]"
                        />
                      </td>

                      {/* LOCATION */}

                      <td className="border p-2">
                        <ExpandableTextField
                          value={item.location}
                          disabled
                          title="Location"
                          placeholder="Location"
                          minHeight="min-h-[38px]"
                          modalHeight="min-h-[180px]"
                        />
                      </td>
                    </tr>
                  );
                })}
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
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>

          <Button type="button" onClick={handleSubmit}>
            <Check
              className="
                w-4
                h-4
                mr-1
              "
            />
            Add Selected Items
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
