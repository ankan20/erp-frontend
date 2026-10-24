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

  subHeader = "Add a detailed description.",

  minHeight = "min-h-[42px]",

  modalHeight = "min-h-[180px]",

  className = "",
}) {
  const [open, setOpen] = useState(false);

  const [localValue, setLocalValue] = useState("");

  const currentValue = value || "";

  const handleOpen = () => {
    setLocalValue(currentValue);
    setOpen(true);
  };

  const handleClose = () => {
    setLocalValue(currentValue);
    setOpen(false);
  };

  const handleSave = () => {
    const trimmed = localValue.trim();

    onChange?.(trimmed);

    setOpen(false);
  };

  const showExpand = currentValue.length > 40;

  return (
    <>
      {/* FIELD */}

      <div
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => e.key === "Enter" && handleOpen()}
        className={`expandable-field ${className}
          relative

          ${getInputClass(error, disabled)}

          ${minHeight}

          px-3
          py-2

          flex
          items-center

          cursor-pointer
        `}
      >
        {currentValue ? (
          <p
            className={`
              text-sm
              leading-4
              pr-7
              overflow-hidden
  text-ellipsis
  whitespace-nowrap
  block
  w-full
  ${disabled ? "text-[#6f7b6f]" : "text-black"}
            `}
          >
            {currentValue}
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

        <span className="absolute top-1/2 right-2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Maximize2 className="w-3.5 h-3.5" />
        </span>
      </div>

      {/* MODAL */}

      <Dialog
        open={open}
        onOpenChange={(val) => {
          if (!val) handleClose();
          else setOpen(true);
        }}
      >
        <DialogContent
          className="
            sm:max-w-[650px]
          "
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {/* SUB HEADER — only renders if prop provided */}
            {subHeader && (
              <p className="text-[13px] text-[#666] mt-1">{subHeader}</p>
            )}
          </DialogHeader>

          {/* TEXTAREA */}

          <textarea
            value={open ? localValue : currentValue}
            disabled={disabled}
            onChange={(e) => setLocalValue(e.target.value)}
            placeholder={placeholder}
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
              ${disabled ? "bg-[#dff4df] text-[#6f7b6f]" : "bg-white text-black"}
            `}
          />

          {/* FOOTER */}
          <div className="flex justify-between items-center pt-2">
            {/* CHAR COUNT */}
            <span className="text-[12px] text-[#888]">
              Character Count : {localValue.trim().length}
            </span>

            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Close
              </Button>

              {!disabled && (
                <Button type="button" onClick={handleSave}>
                  Save
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
