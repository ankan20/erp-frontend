import { goToHomePage } from "@/helper/goToHomePage";
import { goToBackPage } from "@/helper/goToBackPage";
import { useNavigationHistory } from "@/context/NavigationHistoryContext";
import Image from "next/image";

// NOTE: onBack is intentionally removed from the signature.
// Back navigation is now handled internally via goToBackPage — ERP-style.
// All pages that previously passed onBack: () => router.back() can safely
// remove that prop — it will be silently ignored if passed.
export const getPageActions = ({
  router,
  onPrint,
  onDownload,
  onApprove,
  onTimeLine,
}) => {
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { stack } = useNavigationHistory();
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
    <button
      key="timeline"
      className={`${getButtonClass(
        !!onTimeLine
      )} ${iconWrapperClass}`}
      onClick={onTimeLine}
      disabled={!onTimeLine}
    >
      <Image
        src="/assets/icons/timeline.png"
        alt="timeline"
        width={28}
        height={28}
      />
    </button>,

    <button
      key="approve"
      className={`${getButtonClass(
        !!onApprove
      )} ${iconWrapperClass}`}
      onClick={onApprove}
      disabled={!onApprove}
    >
      <Image
        src="/assets/icons/approval-action.png"
        alt="approve"
        width={28}
        height={28}
      />
    </button>,

    divider("divider-1"),

    <button
      key="home"
      className={`${getButtonClass(
        true
      )} ${iconWrapperClass}`}
      onClick={() =>
        goToHomePage(router)
      }
    >
      <Image
        src="/assets/icons/home1.png"
        alt="home"
        width={28}
        height={28}
      />
    </button>,

    // Back button always enabled — goToBackPage handles all cases internally
    <button
      key="back"
      className={`${getButtonClass(true)} ${iconWrapperClass}`}
      onClick={() => goToBackPage(router, stack)}
    >
      <Image
        src="/assets/icons/left-arrow1.png"
        alt="back"
        width={28}
        height={28}
      />
    </button>,

    divider("divider-2"),

    <button
      key="download"
      className={`${getButtonClass(
        !!onDownload
      )} ${iconWrapperClass}`}
      onClick={onDownload}
      disabled={!onDownload}
    >
      <Image
        src="/assets/icons/file-download.png"
        alt="download"
        width={28}
        height={28}
      />
    </button>,

    <button
      key="print"
      className={`${getButtonClass(
        !!onPrint
      )} ${iconWrapperClass}`}
      onClick={onPrint}
      disabled={!onPrint}
    >
      <Image
        src="/assets/icons/printer.png"
        alt="print"
        width={28}
        height={28}
      />
    </button>,
  ];

  return actions;
};