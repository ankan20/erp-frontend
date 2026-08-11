export const DEBIT_NOTE_OPTIONS = [
  { ccCode: "DN-01", ccName: "Material Shortage" },
  { ccCode: "DN-02", ccName: "Material Damage" },
  { ccCode: "DN-03", ccName: "Excess Material Consumption" },
  { ccCode: "DN-04", ccName: "Material Return" },
  { ccCode: "DN-05", ccName: "Price Difference" },
  { ccCode: "DN-06", ccName: "Quantity Difference" },
  { ccCode: "DN-07", ccName: "Labour Recovery" },
  { ccCode: "DN-08", ccName: "Equipment / Machinery Recovery" },
  { ccCode: "DN-09", ccName: "Fuel / Diesel Recovery" },
  { ccCode: "DN-10", ccName: "Tools & Tackles Recovery" },
  { ccCode: "DN-11", ccName: "Accommodation Recovery" },
  { ccCode: "DN-12", ccName: "Transportation Recovery" },
  { ccCode: "DN-13", ccName: "Electricity / Water Recovery" },
  { ccCode: "DN-14", ccName: "Safety Violation Recovery" },
  { ccCode: "DN-15", ccName: "Quality Failure Recovery" },
  { ccCode: "DN-16", ccName: "Rework Cost Recovery" },
  { ccCode: "DN-17", ccName: "Delay / LD Recovery" },
  { ccCode: "DN-18", ccName: "Statutory Deduction" },
  { ccCode: "DN-19", ccName: "Advance Adjustment" },
  { ccCode: "DN-20", ccName: "Mobilization Recovery" },
  { ccCode: "DN-21", ccName: "Site Damage Recovery" },
  { ccCode: "DN-22", ccName: "Theft / Loss Recovery" },
  { ccCode: "DN-23", ccName: "Retention Adjustment" },
  { ccCode: "DN-24", ccName: "Excess Payment Recovery" },
  { ccCode: "DN-25", ccName: "Other Expense Recovery" },
  { ccCode: "DN-26", ccName: "Payment Made on Behalf of Party" },
];

// Quick lookup: ccName → ccCode
export const DN_CODE_BY_NAME = Object.fromEntries(
  DEBIT_NOTE_OPTIONS.map((o) => [o.ccName, o.ccCode]),
);
