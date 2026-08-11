export const CREDIT_NOTE_OPTIONS = [
  { ccCode: "CN-01", ccName: "Rate Difference" },
  { ccCode: "CN-02", ccName: "Quantity Difference" },
  { ccCode: "CN-03", ccName: "Overbilling Correction" },
  { ccCode: "CN-04", ccName: "Work Deduction" },
  { ccCode: "CN-05", ccName: "Material Return" },
  { ccCode: "CN-06", ccName: "Material Rate Adjustment" },
  { ccCode: "CN-07", ccName: "Discount / Rebate" },
  { ccCode: "CN-08", ccName: "Defect / Quality Deduction" },
  { ccCode: "CN-09", ccName: "Penalty / LD Adjustment" },
  { ccCode: "CN-10", ccName: "Mobilization Advance Adjustment" },
  { ccCode: "CN-11", ccName: "Retention Adjustment" },
  { ccCode: "CN-12", ccName: "GST / Tax Correction" },
  { ccCode: "CN-13", ccName: "Duplicate Invoice Cancellation" },
  { ccCode: "CN-14", ccName: "Invoice Correction" },
  { ccCode: "CN-15", ccName: "Final Bill Adjustment" },
  { ccCode: "CN-16", ccName: "Claim Settlement" },
  { ccCode: "CN-17", ccName: "Subcontractor Recovery" },
  { ccCode: "CN-18", ccName: "Other Commercial Adjustment" },
  { ccCode: "CN-19", ccName: "Payment Made on Behalf of us" },
];

// Quick lookup: ccName → ccCode
export const CN_CODE_BY_NAME = Object.fromEntries(
  CREDIT_NOTE_OPTIONS.map((o) => [o.ccName, o.ccCode]),
);
