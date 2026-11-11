"use client";

// Quick list of shortcuts — opened with ? or F1. The full guide with examples
// is the /shortcuts page.

import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SHORTCUT_GROUPS, SHORTCUTS } from "@/config/shortcuts.config";
import Kbd from "./Kbd";

export default function ShortcutHelpDialog({ open, onClose }) {
  const router = useRouter();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[88vh] flex-col gap-3 sm:max-w-3xl" data-sync-ignore>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
        </DialogHeader>

        <div className="grid flex-1 grid-cols-1 gap-x-6 gap-y-4 overflow-y-auto pr-1 md:grid-cols-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.id}>
              <h3 className="mb-1 border-b border-[#d8e1ea] pb-1 text-[12px] font-semibold uppercase tracking-wide text-[#144664]">
                {group.title}
              </h3>
              <ul>
                {SHORTCUTS.filter((s) => s.group === group.id).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 py-[3px] text-[12.5px]">
                    <span className="text-gray-800">{s.label}</span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      {(s.keyLabels || s.keys).map((k, i) => (
                        <span key={k} className="flex items-center gap-1.5">
                          {i > 0 && <span className="text-[11px] text-gray-400">or</span>}
                          <Kbd combo={k} />
                        </span>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-[#d8e1ea] pt-3 text-[12.5px]">
          <span className="text-gray-500">On a Mac, use Cmd in place of Ctrl and Option in place of Alt.</span>
          <button
            type="button"
            onClick={() => {
              onClose();
              router.push("/shortcuts");
            }}
            className="cursor-pointer rounded-sm border border-[#4d8ea3] bg-[#7fc3d4] px-3 py-1 font-medium text-black hover:bg-[#6bb3c6]"
          >
            Open full guide with examples
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
