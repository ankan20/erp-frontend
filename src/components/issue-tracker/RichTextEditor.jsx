"use client";

// Small rich-text box: bold, italic, underline, strike, heading, lists, quote, link.
// Uncontrolled contentEditable; remount with a new `key` to reset it.
// The backend sanitizes whatever HTML comes out of here.
import { useEffect, useRef } from "react";
import {
  Bold, Italic, Underline, Strikethrough, Heading, List, ListOrdered, Quote, Link2, RemoveFormatting,
} from "lucide-react";

const TOOLS = [
  { icon: Bold, cmd: "bold", title: "Bold (Ctrl+B)" },
  { icon: Italic, cmd: "italic", title: "Italic (Ctrl+I)" },
  { icon: Underline, cmd: "underline", title: "Underline (Ctrl+U)" },
  { icon: Strikethrough, cmd: "strikeThrough", title: "Strike" },
  { icon: Heading, cmd: "formatBlock", arg: "h3", title: "Heading" },
  { icon: List, cmd: "insertUnorderedList", title: "Bullet list" },
  { icon: ListOrdered, cmd: "insertOrderedList", title: "Numbered list" },
  { icon: Quote, cmd: "formatBlock", arg: "blockquote", title: "Quote" },
  { icon: Link2, cmd: "createLink", title: "Link" },
  { icon: RemoveFormatting, cmd: "removeFormat", title: "Clear formatting" },
];

// Same look for the editor and for saved items
export const RICH_CLASS =
  "text-sm break-words [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_a]:text-blue-600 [&_a]:underline [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold " +
  "[&_h3]:font-semibold [&_h4]:font-semibold [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 " +
  "[&_blockquote]:pl-2 [&_blockquote]:text-gray-600 [&_pre]:bg-gray-100 [&_pre]:p-2 [&_code]:bg-gray-100";

export default function RichTextEditor({ initialHtml = "", onChange, placeholder = "Write here…" }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = initialHtml || "";
    // initial value only — the box is uncontrolled afterwards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = (tool) => {
    ref.current?.focus();
    if (tool.cmd === "createLink") {
      const url = window.prompt("Link address (https://…)");
      if (!url) return;
      document.execCommand("createLink", false, /^(https?:|mailto:)/i.test(url) ? url : `https://${url}`);
    } else {
      document.execCommand(tool.cmd, false, tool.arg);
    }
    onChange?.(ref.current?.innerHTML || "");
  };

  return (
    <div className="border border-gray-300 rounded bg-white">
      <div className="flex flex-wrap gap-0.5 border-b border-gray-200 bg-gray-50 px-1 py-1">
        {TOOLS.map((t) => (
          <button
            key={t.title}
            type="button"
            title={t.title}
            onMouseDown={(e) => e.preventDefault()} // keep the text selection
            onClick={() => run(t)}
            className="p-1.5 rounded hover:bg-gray-200 text-gray-700 cursor-pointer"
          >
            <t.icon size={15} />
          </button>
        ))}
      </div>
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        data-placeholder={placeholder}
        onInput={() => onChange?.(ref.current?.innerHTML || "")}
        className={`${RICH_CLASS} min-h-[90px] max-h-[320px] overflow-y-auto px-3 py-2 outline-none
          empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400`}
      />
    </div>
  );
}
