// Must match ALLOWED_EXTENSIONS / MAX_FILE_BYTES in the backend's media_service.py
export const MAX_FILE_MB = 25;

const KIND_BY_EXT = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  mp4: "video", webm: "video", mov: "video",
  mp3: "audio", wav: "audio", ogg: "audio", m4a: "audio",
  pdf: "file", doc: "file", docx: "file", xls: "file", xlsx: "file",
  ppt: "file", pptx: "file", txt: "file", csv: "file", zip: "file",
};

export const MEDIA_ACCEPT = Object.keys(KIND_BY_EXT).map(e => `.${e}`).join(",");

const extOf = (name = "") => (name.includes(".") ? name.split(".").pop().toLowerCase() : "");

export const mediaKind = (name) => KIND_BY_EXT[extOf(name)] || null;

// Returns an error message, or null when the file can be sent
export function validateChatFile(file) {
  if (!file) return "No file selected";
  if (!mediaKind(file.name)) return `.${extOf(file.name) || "?"} files can't be sent`;
  if (file.size > MAX_FILE_MB * 1024 * 1024) return `File is larger than ${MAX_FILE_MB} MB`;
  return null;
}

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
