/** @type {import('next').NextConfig} */
const nextConfig = {
  // NEXT_DIST_DIR lets a second, offline dev server (local API) run next to the normal one
  // without sharing the .next lock. Unset = the default ".next".
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
