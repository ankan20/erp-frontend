import { getCookie } from "@/lib/cookies";
import { getLocalStorage } from "./localStorage";

// Open file securely with auth
export const openFileWithAuth = async (url) => {
  try {
    const token = getLocalStorage("token");

    if (!url) {
      console.error("File URL missing");
      return;
    }

    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!res.ok) {
      throw new Error("Unauthorized or failed to fetch file");
    }

    const blob = await res.blob();
    const fileUrl = window.URL.createObjectURL(blob);

    window.open(fileUrl, "_blank");
  } catch (error) {
    console.error("File open error:", error);
    alert("Unable to open file");
  }
};