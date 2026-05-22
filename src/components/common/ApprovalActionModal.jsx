"use client";

import { useState } from "react";

import { useForm } from "react-hook-form";

import { z } from "zod";

import { zodResolver } from "@hookform/resolvers/zod";

import { toast } from "sonner";

import { CheckCircle2, RotateCcw, XCircle, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import { apiRequest } from "@/lib/apiClient";

import { getInputClass } from "@/lib/formStyles";

import { APPROVAL_ACTIONS } from "@/config/approvalActions.config";

const schema = z.object({
  comments: z.string().min(1, "Comments are required"),
});

export default function ApprovalActionModal({
  open,
  onClose,
  actions = [],
  payload = {},
  onSuccess,
}) {
  const [selectedAction, setSelectedAction] = useState(null);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(schema),

    defaultValues: {
      comments: "",
    },
  });

  const resetModalState = () => {
    reset();

    setSelectedAction(null);

    setConfirmOpen(false);
  };

  const handleActionClick = (action) => {
    setSelectedAction(action);

    setConfirmOpen(false);
  };

  const handleClose = () => {
    if (isSubmitting) return;

    resetModalState();

    onClose?.();
  };

  const onSubmit = async (values) => {
    if (!selectedAction) return;

    try {
      const res = await apiRequest({
        url: `${selectedAction.api}/${payload.id}`,

        method: selectedAction.method || "POST",

        data: {
          ...Object.fromEntries(
            Object.entries(payload).filter(([key]) => key !== "id"),
          ),

          comments: values.comments,
        },
      });

      toast.success(res?.message || "Action completed");

      resetModalState();

      onClose?.();

      onSuccess?.(res);
    } catch (err) {
      toast.error(err?.message || "Action failed");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="
          sm:max-w-[560px]
          p-0
          overflow-hidden
        "
      >
        {/* HEADER */}

        <DialogHeader
          className="
            px-5
            py-4
            border-b
          "
        >
          <DialogTitle
            className="
              text-[20px]
              font-semibold
            "
          >
            Approval Actions
          </DialogTitle>
        </DialogHeader>

        {/* BODY */}

        <div className="p-5">
          {/* ACTION BUTTONS */}

          <div
            className="
              flex
              flex-wrap
              gap-3
            "
          >
            {actions.map((action) => {
              const isSelected = selectedAction?.type === action.type;

              const isApprove = action.type === "approve";

              const isReback = action.type === "reback";

              const isReject = action.type === "reject";

              return (
                <button
                  key={action.type}
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleActionClick(action)}
                  className={`
                      h-[40px]
                      px-4
                      rounded-md
                      border
                      text-sm
                      font-medium
                      transition-colors
                      flex
                      items-center
                      gap-2
                      disabled:opacity-60
                      cursor-pointer
                      ${
                        isSelected
                          ? isApprove
                            ? "bg-green-100 border-green-600 text-green-700"
                            : isReback
                              ? "bg-yellow-100 border-yellow-600 text-yellow-700"
                              : "bg-red-100 border-red-600 text-red-700"
                          : "bg-gray-50 border-gray-300 hover:bg-gray-100"
                      }
                    `}
                >
                  {isApprove && (
                    <CheckCircle2
                      className="
                          w-4 h-4
                        "
                    />
                  )}

                  {isReback && (
                    <RotateCcw
                      className="
                          w-4 h-4
                        "
                    />
                  )}

                  {isReject && (
                    <XCircle
                      className="
                          w-4 h-4
                        "
                    />
                  )}

                  <span>{APPROVAL_ACTIONS[action.type].label}</span>
                </button>
              );
            })}
          </div>

          {/* COMMENTS */}

          <div className="mt-6">
            <label
              className="
                text-sm
                font-medium
              "
            >
              Comments
            </label>

            <textarea
              {...register("comments")}
              disabled={isSubmitting}
              placeholder="Enter comments"
              className={`
                ${getInputClass(errors.comments, isSubmitting)}

                mt-2
                w-full

                h-[120px]

                p-3

                resize-none
              `}
            />

            {errors.comments && (
              <p
                className="
                  text-xs
                  text-red-500
                  mt-1
                "
              >
                {errors.comments?.message}
              </p>
            )}
          </div>

          {/* CONFIRM BOX */}

          {confirmOpen && selectedAction && (
            <div
              className={`
      mt-6

      rounded-lg
      border

      p-4

      ${
        selectedAction.type === "approve"
          ? "border-green-200 bg-green-50"
          : selectedAction.type === "reback"
            ? "border-yellow-200 bg-yellow-50"
            : "border-red-200 bg-red-50"
      }
    `}
            >
              <div
                className="
        flex
        items-start
        gap-3
      "
              >
                <div
                  className={`
          mt-[2px]

          ${
            selectedAction.type === "approve"
              ? "text-green-700"
              : selectedAction.type === "reback"
                ? "text-yellow-700"
                : "text-red-700"
          }
        `}
                >
                  {selectedAction.type === "approve" && (
                    <CheckCircle2
                      className="
              w-5 h-5
            "
                    />
                  )}

                  {selectedAction.type === "reback" && (
                    <RotateCcw
                      className="
              w-5 h-5
            "
                    />
                  )}

                  {selectedAction.type === "reject" && (
                    <XCircle
                      className="
              w-5 h-5
            "
                    />
                  )}
                </div>

                <div>
                  <h3
                    className={`
            text-sm
            font-semibold

            ${
              selectedAction.type === "approve"
                ? "text-green-800"
                : selectedAction.type === "reback"
                  ? "text-yellow-800"
                  : "text-red-800"
            }
          `}
                  >
                    {APPROVAL_ACTIONS[selectedAction.type].confirmationTitle}
                  </h3>

                  <p
                    className={`
            text-sm
            mt-1
            leading-6

            ${
              selectedAction.type === "approve"
                ? "text-green-700"
                : selectedAction.type === "reback"
                  ? "text-yellow-700"
                  : "text-red-700"
            }
          `}
                  >
                    {APPROVAL_ACTIONS[selectedAction.type].confirmationMessage}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* FOOTER */}

        <DialogFooter
          className="
            border-t

            px-5
            py-5
          "
        >
          <div
            className="
              w-full

              flex
              items-center
              justify-end

              gap-3
            "
          >
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() =>
                confirmOpen ? setConfirmOpen(false) : handleClose()
              }
              className="
                h-[38px]
                px-4
                rounded-md
                border
                text-sm
                hover:bg-gray-50
                disabled:opacity-60
                cursor-pointer
              "
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={isSubmitting || !selectedAction}
              onClick={() => {
                if (!confirmOpen) {
                  setConfirmOpen(true);

                  return;
                }

                handleSubmit(onSubmit)();
              }}
              className="
                h-[38px]
                min-w-[110px]
                rounded-md
                bg-[#0c3472]
                hover:bg-[#092552]
                text-white
                text-sm
                font-medium
                flex
                items-center
                justify-center
                gap-2
                disabled:opacity-60
                cursor-pointer
              "
            >
              {isSubmitting && (
                <Loader2
                  className="
                    w-4 h-4
                    animate-spin
                  "
                />
              )}
              Confirm
            </button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
