"use client";

// Keyboard shortcuts for the whole ERP.
//
// One key listener for the page. What each key does is listed in
// config/shortcuts.config.js; page codes are in config/tcode.config.js.
// Shortcuts press the same buttons the mouse would (see lib/shortcuts.js), so
// permissions, disabled states and confirmation pop-ups are unchanged.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SHORTCUTS } from "@/config/shortcuts.config";
import {
  parseCombo,
  matchesCombo,
  isTypingTarget,
  topDialog,
  findShortcutTarget,
  waitForElement,
  getShortcutPages,
} from "@/lib/shortcuts";
import CommandPalette from "./CommandPalette";
import ShortcutHelpDialog from "./ShortcutHelpDialog";
import SequenceHint from "./SequenceHint";

const ShortcutContext = createContext({ openPalette: () => {}, openHelp: () => {} });
export const useShortcuts = () => useContext(ShortcutContext);

// shortcuts that the engine listens for (display-only rows are skipped)
const ACTIVE = SHORTCUTS.filter((s) => !s.display).map((s) => ({ ...s, combos: s.keys.map(parseCombo) }));

// a combination that cannot be normal typing: has Ctrl / Alt, or is a function key
const safeWhileTyping = (c) => c.ctrl || c.alt || /^F\d+$/.test(c.key || "");

const SEQUENCE_TIMEOUT = 5000;
const notify = (message) => toast.info(message, { id: "shortcut-info", duration: 2500 });

// Click like the mouse does: focus first (so the field being typed in is
// committed), then click.
function press(el) {
  el.focus({ preventScroll: true });
  setTimeout(() => {
    if (!el.disabled && el.isConnected) el.click();
  }, 0);
}

export default function ShortcutProvider({ children }) {
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  // "G" / "N" then a two-letter page code
  const [sequence, setSequence] = useState(null); // { mode: "go" | "new", typed: "", pages: [] }
  const sequenceRef = useRef(null);
  const sequenceTimer = useRef(null);

  const setSeq = useCallback((value) => {
    sequenceRef.current = value;
    setSequence(value);
    clearTimeout(sequenceTimer.current);
    if (value) {
      // forget a half-typed code after a few seconds
      sequenceTimer.current = setTimeout(() => {
        sequenceRef.current = null;
        setSequence(null);
      }, SEQUENCE_TIMEOUT);
    }
  }, []);

  useEffect(() => () => clearTimeout(sequenceTimer.current), []);

  const openPalette = useCallback(() => {
    setHelpOpen(false);
    setPaletteOpen(true);
  }, []);
  const openHelp = useCallback(() => {
    setPaletteOpen(false);
    setHelpOpen(true);
  }, []);

  // ── "G I N" / "N I N" ──────────────────────────────────────────────────────
  const handleSequenceKey = useCallback(
    (e) => {
      const seq = sequenceRef.current;
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") return setSeq(null);
      if (e.key === "Backspace") {
        return seq.typed ? setSeq({ ...seq, typed: seq.typed.slice(0, -1) }) : setSeq(null);
      }
      const m = /^Key([A-Z])$/.exec(e.code);
      if (!m || e.ctrlKey || e.metaKey || e.altKey) return setSeq(null);

      const typed = seq.typed + m[1];
      if (typed.length < 2) return setSeq({ ...seq, typed });

      setSeq(null);
      const page = seq.pages.find((p) => p.code === typed);
      if (!page) return notify(`No page with code ${typed}`);
      if (seq.mode === "new") {
        if (!page.newPath) return notify(`${page.title} has no new entry screen for you`);
        return router.push(page.newPath);
      }
      router.push(page.path);
    },
    [router, setSeq],
  );

  // ── Alt+A / Alt+B / Alt+X ──────────────────────────────────────────────────
  const runApproval = useCallback(async (type) => {
    const selector = `[data-shortcut="approval-${type}"]`;
    let choice = (topDialog() || document).querySelector(selector);
    if (!choice) {
      // open the approval pop-up first
      const opener = findShortcutTarget(["approval"]);
      if (!opener || opener.disabled) return notify("Approval is not available on this page");
      press(opener.el);
      choice = await waitForElement(selector);
    }
    if (!choice) return notify("This action is not available for this record");
    if (choice.disabled) return notify("This record is not waiting for your approval");
    press(choice);
  }, []);

  // ── run one shortcut ───────────────────────────────────────────────────────
  const run = useCallback(
    (s, e) => {
      const dialog = topDialog();

      // page-level shortcuts do nothing while a pop-up is open
      if (["palette", "go", "new", "tcode", "search", "help"].includes(s.id)) {
        if (dialog) {
          // Ctrl+K inside the open search box should not reach the browser
          if (s.id === "palette" || s.id === "tcode") e.preventDefault();
          return;
        }
        e.preventDefault();
        if (s.id === "palette") return openPalette();
        if (s.id === "help") return openHelp();
        if (s.id === "go" || s.id === "new") {
          return setSeq({ mode: s.id, typed: "", pages: getShortcutPages() });
        }
        const box = document.querySelector(`[data-shortcut-focus="${s.id}"]`);
        if (box && box.getClientRects().length) {
          box.focus();
          box.select?.();
          return;
        }
        // no search box / T-code box on this screen → the command box does both
        return openPalette();
      }

      if (s.approval) {
        e.preventDefault();
        return runApproval(s.approval);
      }

      const found = findShortcutTarget(s.target || [], { nearest: s.nearest });
      if (!found) {
        if (s.passThrough) return; // let the browser do its own thing (Ctrl+P, Alt+←)
        e.preventDefault();
        if (s.id !== "save") notify(`“${s.label}” is not available on this screen`);
        return;
      }
      e.preventDefault();
      if (found.disabled) return notify(`“${s.label}” is not available right now`);
      if (s.nearest) return found.el.click(); // keep the cursor in the field being filled
      press(found.el);
    },
    [openPalette, openHelp, runApproval, setSeq],
  );

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.isComposing || e.key === "Process") return;

      if (sequenceRef.current) {
        // a held modifier on its own does not end the sequence
        if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
        return handleSequenceKey(e);
      }
      if (e.repeat) return;

      const typing = isTypingTarget(e.target);

      // 1 – 9 choose an option in the open pop-up (approval comments)
      if (!typing && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey && /^Digit[1-9]$/.test(e.code)) {
        const option = topDialog()?.querySelector(`[data-shortcut="option-${e.code.slice(5)}"]`);
        if (option && !option.disabled) {
          e.preventDefault();
          press(option);
          return;
        }
      }

      for (const s of ACTIVE) {
        for (const combo of s.combos) {
          if (!matchesCombo(e, combo)) continue;
          if (typing && (s.typing === false || !safeWhileTyping(combo))) continue;
          return run(s, e);
        }
      }
    };
    // capture phase: works even when a component stops the event
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [run, handleSequenceKey]);

  const value = useMemo(() => ({ openPalette, openHelp }), [openPalette, openHelp]);

  return (
    <ShortcutContext.Provider value={value}>
      {children}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onHelp={openHelp} />
      <ShortcutHelpDialog open={helpOpen} onClose={() => setHelpOpen(false)} />
      <SequenceHint sequence={sequence} />
    </ShortcutContext.Provider>
  );
}
