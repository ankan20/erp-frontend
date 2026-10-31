// Reusable chat building blocks — import these from any page:
//   import { ShareDialog, AttachButton } from "@/components/communication/shared";
export { default as AttachButton }      from "./AttachButton";
export { default as AttachmentPreview } from "./AttachmentPreview";
export { default as MessageAttachment } from "./MessageAttachment";
export { default as ShareDialog }       from "./ShareDialog";
export { default as SmartReplies }      from "./SmartReplies";
export { default as RecordLink }        from "./RecordLink";
export { default as RecordStatusTag }   from "./RecordStatusTag";
export { RECORD_STATUS, recordStatusStyle } from "./recordStatus";
export { default as PendingApprovalPicker } from "./PendingApprovalPicker";
export { MEDIA_ACCEPT, MAX_FILE_MB, validateChatFile, formatBytes, mediaKind } from "./chatMedia";
