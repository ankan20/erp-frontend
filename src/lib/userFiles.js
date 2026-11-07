import API_BASE_URL from "@/config/api.config";

// URL of a user's profile picture / signature served through the API
// (GET /auth/user-file/<id>/<kind>, needs the login token — use <AuthImage>).
// `storedUrl` is the value saved on the user; it is added as a version so a
// new upload is never served from cache. Returns "" when nothing is uploaded.
export const userFileUrl = (userId, kind, storedUrl) => {
  if (!userId || !storedUrl) return "";
  return `${API_BASE_URL}/auth/user-file/${userId}/${kind}?v=${encodeURIComponent(storedUrl)}`;
};
