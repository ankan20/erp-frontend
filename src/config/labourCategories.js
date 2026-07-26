export const LABOUR_CATEGORIES = [
  { key: "Mason",                    label: "Mason" },
  { key: "Carpenter",                label: "Carpenter" },
  { key: "Bar_Bender",               label: "Bar Bender" },
  { key: "Electrician",              label: "Electrician" },
  { key: "Plumber",                  label: "Plumber" },
  { key: "Painter",                  label: "Painter" },
  { key: "Scaffolder",               label: "Scaffolder" },
  { key: "Foreman",                  label: "Foreman" },
  { key: "Surveyor",                 label: "Surveyor" },
  { key: "Crane_Operator",           label: "Crane Operator" },
  { key: "Excavator_Operator",       label: "Excavator Operator" },
  { key: "Rigger",                   label: "Rigger" },
  { key: "Heavy_Equipment_Operator", label: "Heavy Equipment Operator" },
  { key: "JCB_Operator",             label: "JCB Operator" },
  { key: "Concrete_Pump_Operator",   label: "Concrete Pump Operator" },
  { key: "Welder",                   label: "Welder" },
  { key: "Fitter",                   label: "Fitter" },
  { key: "Gas_Cutter",               label: "Gas Cutter" },
  { key: "Helper",                   label: "Helper" },
  { key: "Unskill",                  label: "Unskill" },
];

export const CATEGORY_OPTIONS = LABOUR_CATEGORIES.map((c) => ({
  value: c.key,
  label: c.label,
}));
