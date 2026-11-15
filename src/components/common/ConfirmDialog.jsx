"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * Drop-in replacement for window.confirm().
 *
 * Usage:
 *   const [confirm, setConfirm] = useState(null);   // null | { title, description, onConfirm }
 *
 *   // trigger:
 *   setConfirm({ title: "Delete?", description: "Cannot be undone.", onConfirm: doDelete });
 *
 *   // render (once, anywhere in the component's JSX):
 *   <ConfirmDialog state={confirm} onClose={() => setConfirm(null)} />
 *
 * Props:
 *   state        – null (closed) or { title, description, onConfirm, confirmLabel?, variant? }
 *   onClose      – called on Cancel or after Confirm resolves
 *   confirmLabel – button label (default "Continue")
 *   variant      – "destructive" turns the confirm button red (default "default")
 */
export default function ConfirmDialog({ state, onClose }) {
  const isOpen = !!state;

  const handleConfirm = async () => {
    await state?.onConfirm?.();
    onClose?.();
  };

  const variant    = state?.variant    ?? "default";
  const label      = state?.confirmLabel ?? "Continue";
  const isDestructive = variant === "destructive";

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose?.(); }}>
      <AlertDialogContent className="max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-[14px]">
            {state?.title ?? "Are you sure?"}
          </AlertDialogTitle>
          {state?.description && (
            <AlertDialogDescription className="text-[12px]">
              {state.description}
            </AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="text-[12px] h-8" onClick={onClose}>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className={[
              "text-[12px] h-8",
              isDestructive
                ? "bg-red-600 hover:bg-red-700 focus:ring-red-500"
                : "bg-blue-600 hover:bg-blue-700",
            ].join(" ")}
            onClick={handleConfirm}
          >
            {label}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
