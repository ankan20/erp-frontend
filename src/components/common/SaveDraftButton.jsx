"use client";

import { Loader2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export default function SaveDraftButton({
  onClick,
  loading = false,
  disabled = false,
  children = "Save as Draft",
  className = "",
  requireConfirmation = false,
  confirmationTitle = "Save Draft?",
  confirmationMessage = "This draft will be saved.",
}) {
  const isDisabled = disabled || loading;

  const buttonUI = (
    <button
      type="button"
      disabled={isDisabled}
      data-shortcut="draft"
      title="Shortcut: Ctrl+S"
      className={`
        min-w-[120px]
        h-[34px]
        px-4
        rounded-sm
        border
        border-[#b38f2a]
        bg-[#f4d47c]
        hover:brightness-95
        disabled:opacity-70
        disabled:cursor-not-allowed
        text-md
        font-medium
        text-[#3d3200]
        inline-flex
        items-center
        justify-center
        gap-2
        transition-all
        duration-150
        cursor-pointer
        ${className}
      `}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Saving...
        </>
      ) : (
        children
      )}
    </button>
  );

  // NORMAL BUTTON
  if (!requireConfirmation) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={isDisabled}
        data-shortcut="draft"
        title="Shortcut: Ctrl+S"
        className={`
          min-w-[120px]
          h-[34px]
          px-4
          rounded-sm
          border
          border-[#b38f2a]
          bg-[#f4d47c]
          hover:brightness-95
          disabled:opacity-70
          disabled:cursor-not-allowed
          text-md
          font-medium
          text-[#3d3200]
          inline-flex
          items-center
          justify-center
          gap-2
          transition-all
          duration-150
          cursor-pointer
          ${className}
        `}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving...
          </>
        ) : (
          children
        )}
      </button>
    );
  }

  // CONFIRMATION BUTTON
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {buttonUI}
      </AlertDialogTrigger>

      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {confirmationTitle}
          </AlertDialogTitle>

          <AlertDialogDescription>
            {confirmationMessage}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>
            Cancel
          </AlertDialogCancel>

          <AlertDialogAction onClick={onClick}>
            Continue
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}