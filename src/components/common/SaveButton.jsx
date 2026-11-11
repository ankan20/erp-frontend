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

export default function SaveButton({
  onClick,
  children = "Save",
  className = "",
  loading = false,
  disabled = true,
  loadingText = "Saving...",
  requireConfirmation = false,
  confirmationTitle = "Are you sure?",
  confirmationMessage = "This action will continue the process.",
  shortcut, // "submit" | "save" | "primary" — keyboard shortcut name (default: worked out from the text)
}) {
  const isDisabled = loading || disabled;

  // Which keyboard shortcut presses this button (see config/shortcuts.config.js):
  //   "Submit…"                   → submit  : Ctrl+Enter
  //   "Save" / "Update" / "Create…" → save    : Ctrl+S or Ctrl+Enter
  //   anything else ("Issue Asset") → primary : Ctrl+Enter only, never Ctrl+S
  const text = typeof children === "string" ? children.trim() : "";
  const shortcutName =
    shortcut ||
    (/submit/i.test(text) ? "submit" : /^(save|update|create)\b/i.test(text) ? "save" : "primary");
  const shortcutTitle = shortcutName === "save" ? "Shortcut: Ctrl+S or Ctrl+Enter" : "Shortcut: Ctrl+Enter";

  const buttonUI = (
    <button
      disabled={isDisabled}
      data-shortcut={shortcutName}
      title={shortcutTitle}
      className={`
        h-8.5
        min-w-30
        px-4
        rounded-md
        border
        border-[#d97a2b]
        bg-[#f4b183]
        text-black
        text-md
        font-medium
        hover:bg-[#eea36e]
        transition
        flex items-center justify-center gap-2
        ${
          isDisabled
            ? "opacity-70 cursor-not-allowed"
            : "cursor-pointer"
        }
        ${className}
      `}
    >
      {loading && (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}

      {loading ? loadingText : children}
    </button>
  );

  // NORMAL BUTTON
  if (!requireConfirmation) {
    return (
      <button
        onClick={onClick}
        disabled={isDisabled}
        data-shortcut={shortcutName}
        title={shortcutTitle}
        className={`
          h-8.5
          min-w-30
          px-4
          rounded-md
          border
          border-[#d97a2b]
          bg-[#f4b183]
          text-black
          text-md
          font-medium
          hover:bg-[#eea36e]
          transition
          flex items-center justify-center gap-2
          ${
            isDisabled
              ? "opacity-70 cursor-not-allowed"
              : "cursor-pointer"
          }
          ${className}
        `}
      >
        {loading && (
          <Loader2 className="h-4 w-4 animate-spin" />
        )}

        {loading ? "Saving..." : children}
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