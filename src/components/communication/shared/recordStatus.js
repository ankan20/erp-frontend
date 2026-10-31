// Look of a record's approval status, as returned by the backend in
// `recordStatus` on approval pings. `opened` = the receiver already clicked it.
//   pending → still waiting on the receiver   approved → passed their stage
//   rejected / returned (sent back) / removed (record deleted)
export const RECORD_STATUS = {
  approved: { label: "✓ Approved", link: "text-green-700 line-through decoration-green-600", tag: "bg-green-100 text-green-700" },
  rejected: { label: "Rejected",   link: "text-red-600 line-through decoration-red-500",     tag: "bg-red-100 text-red-600" },
  returned: { label: "Sent back",  link: "text-orange-600",                                  tag: "bg-orange-100 text-orange-700" },
  removed:  { label: "Removed",    link: "text-gray-400 line-through",                       tag: "bg-gray-100 text-gray-500" },
  opened:   { label: "Opened",     link: "text-violet-700",                                  tag: "bg-violet-100 text-violet-700" },
  pending:  { label: "Pending",    link: "text-[#003b8e]",                                   tag: "bg-amber-100 text-amber-700" },
};

// pending + already clicked shows as "opened"
export function recordStatusStyle(status, opened = false) {
  if (!status) return null;
  if (status === "pending" && opened) return RECORD_STATUS.opened;
  return RECORD_STATUS[status] || null;
}
