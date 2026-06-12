// SET COOKIE
export const setCookie = (name, value, options = {}) => {
  const {
    days = 7,
    path = "/",
    secure = false,
    sameSite = "Lax",
  } = options;

  const expires = new Date(Date.now() + days * 86400000).toUTCString();

  document.cookie = `${name}=${encodeURIComponent(
    value
  )}; expires=${expires}; path=${path}; SameSite=${sameSite}${
    secure ? "; Secure" : ""
  }`;
};

// GET COOKIE
export const getCookie = (name) => {
  if (typeof document === "undefined") return null;

  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(name + "="));

  return match ? decodeURIComponent(match.split("=")[1]) : null;
};

// DELETE COOKIE
export const deleteCookie = (name, path = "/") => {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=${path};`;
};

// CLEAR AUTH
export const clearAuthCookies = () => {
  deleteCookie("token");
  deleteCookie("userId");
  deleteCookie("userName");
  deleteCookie("role");
  
};