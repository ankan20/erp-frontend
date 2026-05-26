"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import { Maximize2 } from "lucide-react";

import { getInputClass } from "@/lib/formStyles";

export default function ExpandableTextField({

  value = "",

  onChange,

  disabled = false,

  error,

  placeholder = "Enter text",

  title = "Text",

  minHeight = "min-h-[42px]",

  modalHeight = "min-h-[180px]",
}) {

  const [open, setOpen] =
    useState(false);

  const [localValue, setLocalValue] =
    useState("");

  const currentValue =
    value || "";

  const handleSave =
    () => {

      const trimmed =
        localValue.trim();

      onChange?.(
        trimmed,
      );

      setOpen(false);
    };

  const showExpand =
    currentValue.length > 40;

  return (

    <>

      {/* FIELD */}

      <div
        className={`
          relative

          ${getInputClass(
            error,
            disabled,
          )}

          ${minHeight}

          px-3
          py-2

          flex
          items-start

          break-words

          whitespace-pre-wrap
        `}
      >

        {currentValue ? (

          <p
            className="
              text-sm
              leading-6
              pr-7
            "
          >

            {showExpand
              ? `${currentValue.slice(
                  0,
                  40,
                )}...`
              : currentValue}

          </p>

        ) : (

          <p
            className="
              text-sm
              text-gray-400
            "
          >

            {placeholder}

          </p>
        )}

        {/* EXPAND BUTTON */}

        <button
          type="button"

          onClick={() => {

            setLocalValue(
              currentValue,
            );

            setOpen(true);
          }}

          className="
            absolute
            top-2
            right-2

            text-gray-500

            hover:text-black

            transition-colors
          "
        >

          <Maximize2
            className="
              w-4
              h-4
            "
          />

        </button>

      </div>

      {/* MODAL */}

      <Dialog
        open={open}
        onOpenChange={(
          value,
        ) => {

          if (!value) {

            setLocalValue(
              currentValue,
            );
          }

          setOpen(
            value,
          );
        }}
      >

        <DialogContent
          className="
            sm:max-w-[650px]
          "
        >

          <DialogHeader>

            <DialogTitle>

              {title}

            </DialogTitle>

          </DialogHeader>

          {/* TEXTAREA */}

          <textarea

            value={
              open
                ? localValue
                : currentValue
            }

            disabled={
              disabled
            }

            onChange={(
              e,
            ) =>
              setLocalValue(
                e.target
                  .value,
              )
            }

            placeholder={
              placeholder
            }

            className={`
              w-full

              ${modalHeight}

              border
              rounded-md

              p-3

              text-sm

              resize-none

              outline-none

              focus:ring-2
              focus:ring-slate-300

              ${
                disabled
                  ? "bg-[#dff4df]"
                  : "bg-white"
              }
            `}
          />

          {/* FOOTER */}

          <div
            className="
              flex
              justify-end
              gap-2
              pt-2
            "
          >

            <Button
              type="button"
              variant="outline"
              onClick={() => {

                setLocalValue(
                  currentValue,
                );

                setOpen(
                  false,
                );
              }}
            >

              Close

            </Button>

            {!disabled && (

              <Button
                type="button"
                onClick={
                  handleSave
                }
              >

                Save

              </Button>
            )}

          </div>

        </DialogContent>

      </Dialog>

    </>
  );
}