// Edox Drive from inside the ERP. Every call goes to the ERP backend
// (/drive-bridge), which talks to Drive for the signed-in ERP user.
import API_BASE_URL from "@/config/api.config";
import { apiRequest } from "@/lib/apiClient";
import { getLocalStorage } from "@/lib/localStorage";

let statusPromise = null;

// Whether Drive is set up and this ERP account is linked (asked once per page load).
export function driveStatus(fresh = false) {
  if (fresh || !statusPromise) {
    statusPromise = apiRequest({ url: "/drive-bridge/status" })
      .then((r) => r?.data || { enabled: false, linked: false })
      .catch(() => ({ enabled: false, linked: false }));
  }
  return statusPromise;
}

export async function startConnect() {
  const r = await apiRequest({ url: "/drive-bridge/connect/start", method: "POST" });
  return r.data.url;
}

export async function finishConnect(code) {
  const r = await apiRequest({ url: "/drive-bridge/connect/finish", method: "POST", data: { code } });
  driveStatus(true);
  return r.data;
}

export async function browse(params) {
  const r = await apiRequest({ url: "/drive-bridge/browse", params });
  return r.data;
}

const EXT_MIME = {
  pdf: "application/pdf", xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  doc: "application/msword", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif",
  csv: "text/csv", txt: "text/plain", dwg: "image/vnd.dwg", zip: "application/zip",
};

export const extOf = (name) => (name.split(".").pop() || "").toLowerCase();
export const mimeOf = (name) => EXT_MIME[extOf(name)] || "application/octet-stream";

// A Drive file as a normal browser File, so the ERP form uploads it exactly as if
// it had been chosen from the computer.
export async function fetchAsFile(item) {
  const res = await fetch(`${API_BASE_URL}/drive-bridge/file/${item.id}`, {
    headers: { Authorization: `Bearer ${getLocalStorage("token")}` },
  });
  if (!res.ok) {
    let msg = "Couldn't get the file from Edox Drive.";
    try {
      msg = (await res.json()).message || msg;
    } catch { /* not JSON */ }
    throw new Error(msg);
  }
  const blob = await res.blob();
  return new File([blob], item.name, { type: mimeOf(item.name), lastModified: Date.now() });
}

export async function saveToDrive(url, folderId, name) {
  const r = await apiRequest({ url: "/drive-bridge/save", method: "POST", data: { url, folder_id: folderId, name } });
  return r.data.node;
}

// "accept" of a file input (".pdf,.jpg") → does this name match?
export function accepts(accept, name) {
  if (!accept) return true;
  const list = accept.split(",").map((a) => a.trim().toLowerCase()).filter(Boolean);
  if (!list.length) return true;
  const ext = `.${extOf(name)}`;
  const mime = mimeOf(name);
  return list.some((a) => a === ext || a === mime || (a.endsWith("/*") && mime.startsWith(a.slice(0, -1))));
}
