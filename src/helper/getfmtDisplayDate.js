export const getfmtDisplaydate = (d) => {
  if (!d) return "";

  const dt = new Date(d);

  if (isNaN(dt.getTime())) {
    return d;
  }

  return dt.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};
// 2026-06-06
// 2026-05-28 10:50:30
// Thu, 28 May 2026 00:00:00 GMT
// normal ISO date strings
// returns original value if invalid