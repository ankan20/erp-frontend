import { goToHomePage } from "@/helper/goToHomePage";
import { goToBackPage } from "@/helper/goToBackPage";
import { useNavigationHistory } from "@/context/NavigationHistoryContext";
import Image from "next/image";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { usePathname } from "next/navigation";
import { CopyPlus } from "lucide-react";
import { getCopyTarget, getCopyFromBase } from "@/lib/copyRecord";
import CopyFromButton from "@/components/common/CopyFromButton";

const tip = (btn, label) => (
  <Tooltip>
    <TooltipTrigger asChild>{btn}</TooltipTrigger>
    <TooltipContent side="top" variant="icon">{label}</TooltipContent>
  </Tooltip>
);

// NOTE: onBack is intentionally removed from the signature.
// Back navigation is now handled internally via goToBackPage — ERP-style.
// All pages that previously passed onBack: () => router.back() can safely
// remove that prop — it will be silently ignored if passed.
export const usePageActions = ({
  router,
  onPrint,
  onDownload,
  onApprove,
  onTimeLine,
  isPendingApproval = false,
}) => {
  const { stack } = useNavigationHistory();
  const pathname = usePathname();
  // Detail pages of modules that support it get a "Copy" button:
  // opens a new entry pre-filled from this one.
  const copyTarget = getCopyTarget(pathname);
  // Create pages get "Copy from…": fill the new entry from an earlier one.
  const copyFromBase = getCopyFromBase(pathname);

  const baseBtnClass =
    "transition flex items-center justify-center w-[32px] h-[32px]";

  const enabledClass = "cursor-pointer hover:scale-105";
  const disabledClass =
    "opacity-40 grayscale cursor-not-allowed pointer-events-none";

  const iconWrapperClass =
    "w-[32px] h-[32px] flex items-center justify-center";

  const getButtonClass = (isEnabled) =>
    `${baseBtnClass} ${isEnabled ? enabledClass : disabledClass}`;

  const divider = (key) => (
    <div
      key={key}
      className="w-0.5 h-7 bg-[#8F8F8F] mx-0.5 shrink-0"
    />
  );

  const actions = [
    tip(
      <button
        type="button"
        key="timeline"
        data-shortcut="history"
        className={`${getButtonClass(!!onTimeLine)} ${iconWrapperClass}`}
        onClick={onTimeLine}
        disabled={!onTimeLine}
      >
        <Image src="/assets/icons/timeline.png" alt="timeline" width={28} height={28} />
      </button>,
      onTimeLine ? "View History (Alt+H)" : "History not available"
    ),

    tip(
      <button
        type="button"
        key="approve"
        data-shortcut="approval"
        className={`${getButtonClass(!!onApprove)} ${iconWrapperClass} relative ${isPendingApproval && !!onApprove ? "ring-2 ring-green-500/70 ring-offset-1 rounded-md" : ""}`}
        onClick={onApprove}
        disabled={!onApprove}
      >
        {isPendingApproval && !!onApprove && (
          <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5 z-20 pointer-events-none">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
        )}
        <Image src="/assets/icons/approval-action.png" alt="approve" width={28} height={28} />
      </button>,
      onApprove ? (isPendingApproval ? "Approve / Action — Your approval is needed! (Alt+A approve · Alt+B reback · Alt+X reject)" : "Approve / Action (Alt+A)") : "Approval not available"
    ),

    divider("divider-1"),

    tip(
      <button
        type="button"
        key="home"
        data-shortcut="home"
        className={`${getButtonClass(true)} ${iconWrapperClass}`}
        onClick={() => goToHomePage(router)}
      >
        <Image src="/assets/icons/home1.png" alt="home" width={28} height={28} />
      </button>,
      "Go to List (Alt+L)"
    ),

    tip(
      <button
        type="button"
        key="back"
        data-shortcut="back"
        className={`${getButtonClass(true)} ${iconWrapperClass}`}
        onClick={() => goToBackPage(router, stack)}
      >
        <Image src="/assets/icons/left-arrow1.png" alt="back" width={28} height={28} />
      </button>,
      "Go Back (Alt+←)"
    ),

    divider("divider-2"),

    tip(
      <button
        type="button"
        key="download"
        data-shortcut="download"
        className={`${getButtonClass(!!onDownload)} ${iconWrapperClass}`}
        onClick={onDownload}
        disabled={!onDownload}
      >
        <Image src="/assets/icons/file-download.png" alt="download" width={28} height={28} />
      </button>,
      onDownload ? "Download (Ctrl+Shift+S)" : "Download not available"
    ),

    tip(
      <button
        type="button"
        key="print"
        data-shortcut="print"
        className={`${getButtonClass(!!onPrint)} ${iconWrapperClass}`}
        onClick={onPrint}
        disabled={!onPrint}
      >
        <Image src="/assets/icons/printer.png" alt="print" width={28} height={28} />
      </button>,
      onPrint ? "Print (Ctrl+P)" : "Print not available"
    ),
  ];

  if (copyFromBase) {
    actions.push(
      divider("divider-copy-from"),
      <CopyFromButton
        key="copy-from"
        base={copyFromBase}
        className={`${getButtonClass(true)} ${iconWrapperClass}`}
      />
    );
  }

  if (copyTarget) {
    actions.push(
      divider("divider-copy"),
      tip(
        <button
          type="button"
          key="copy"
          data-shortcut="copy"
          className={`${getButtonClass(true)} ${iconWrapperClass}`}
          onClick={() => router.push(copyTarget.href)}
        >
          <CopyPlus size={24} strokeWidth={2.2} className="text-[#2563EB]" />
        </button>,
        "Copy — new entry with these details (Alt+C)"
      )
    );
  }

  return actions;
};

// Backwards-compatible alias — remove once all callers are updated
export const getPageActions = usePageActions;
