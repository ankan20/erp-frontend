export const APPROVAL_ACTIONS = {
  approve: {
    label: "Approve",
    value: "approve",
    confirmationTitle: "Approve Request?",
    confirmationMessage: "This action will approve the request.",
    commentSuggestions: [
      "Verified and approved",
      "Documents are in order",
      "Meets all requirements",
      "Approved as per policy",
    ],
  },

  reback: {
    label: "Reback",
    value: "reback",
    confirmationTitle: "Send Back Request?",
    confirmationMessage: "This action will send the request back.",
    commentSuggestions: [
      "Missing documentation",
      "Requires clarification",
      "Incomplete information",
      "Needs revision before approval",
    ],
  },

  reject: {
    label: "Reject",
    value: "reject",
    confirmationTitle: "Reject Request?",
    confirmationMessage: "This action will reject the request.",
    commentSuggestions: [
      "Does not meet requirements",
      "Duplicate request",
      "Not as per policy",
      "Insufficient justification",
    ],
  },
};