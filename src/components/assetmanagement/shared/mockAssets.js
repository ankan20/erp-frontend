// Central asset registry — all AM submodules reference this.
// Keep in sync with asset-register/mockData.js MOCK_ASSETS (same IDs).

export const AM_ASSETS = [
  {
    id: 1, assetId: "AM-MCH-0001", assetName: "Excavator JCB 3DX",
    category: "Plant & Machinery", trackingType: "individual",
    serialNo: "JCB3DX2024001", make: "JCB", modelNo: "3DX Super",
    unit: "No", purchaseValue: 2500000, purchaseDate: "16/01/2024",
    location: "Site A - Mumbai", custodian: "Rajesh Kumar",
    status: "active",   // active | in_maintenance | transferred | disposed | issued
    depreciationMethod: "WDV", depreciationRate: 15, usefulLife: 10,
    gstAmount: 450000, totalCost: 2950000, batchItems: [],
  },
  {
    id: 2, assetId: "AM-MCH-0002", assetName: "Concrete Mixer 10/7",
    category: "Plant & Machinery", trackingType: "batch",
    serialNo: "", make: "Ajax", modelNo: "10/7 Tilting",
    unit: "No", purchaseValue: 85000, purchaseDate: "16/01/2024",
    location: "Workshop", custodian: "Deepak Singh",
    status: "active",
    depreciationMethod: "SLM", depreciationRate: 10, usefulLife: 8,
    gstAmount: 15300, totalCost: 100300,
    batchItems: [
      { subId: "AM-MCH-0002-A", serialNo: "AJAX001", location: "Site A - Mumbai", status: "active" },
      { subId: "AM-MCH-0002-B", serialNo: "AJAX002", location: "Site B - Pune",   status: "active" },
    ],
  },
  {
    id: 3, assetId: "AM-FRN-0001", assetName: "Executive Office Chair",
    category: "Furniture & Fixture", trackingType: "batch",
    serialNo: "", make: "Godrej", modelNo: "ErgoMax Pro",
    unit: "No", purchaseValue: 8500, purchaseDate: "23/02/2024",
    location: "Head Office", custodian: "Sunita Verma",
    status: "active",
    depreciationMethod: "SLM", depreciationRate: 10, usefulLife: 10,
    gstAmount: 1530, totalCost: 10030,
    batchItems: Array.from({ length: 10 }, (_, i) => ({
      subId: `AM-FRN-0001-${String.fromCharCode(65 + i)}`,
      serialNo: `GOD-CHR-${String(i + 1).padStart(3, "0")}`,
      location: "Head Office", status: "active",
    })),
  },
  {
    id: 4, assetId: "AM-IT-0001", assetName: "Laptop Dell Inspiron 15",
    category: "IT Equipment", trackingType: "batch",
    serialNo: "", make: "Dell", modelNo: "Inspiron 15 3520",
    unit: "No", purchaseValue: 65000, purchaseDate: "09/03/2024",
    location: "Head Office", custodian: "Amit Patel",
    status: "active",
    depreciationMethod: "WDV", depreciationRate: 40, usefulLife: 3,
    gstAmount: 11700, totalCost: 76700,
    batchItems: [
      { subId: "AM-IT-0001-A", serialNo: "DELL-SN-20240301", location: "Head Office",    status: "active" },
      { subId: "AM-IT-0001-B", serialNo: "DELL-SN-20240302", location: "Head Office",    status: "active" },
      { subId: "AM-IT-0001-C", serialNo: "DELL-SN-20240303", location: "Site A - Mumbai",status: "active" },
      { subId: "AM-IT-0001-D", serialNo: "DELL-SN-20240304", location: "Site B - Pune",  status: "active" },
      { subId: "AM-IT-0001-E", serialNo: "DELL-SN-20240305", location: "Head Office",    status: "in_maintenance" },
    ],
  },
  {
    id: 5, assetId: "AM-VEH-0001", assetName: "Tata Ace Mini Truck",
    category: "Vehicle", trackingType: "batch",
    serialNo: "", make: "Tata Motors", modelNo: "Ace HT CNG",
    unit: "No", purchaseValue: 850000, purchaseDate: "20/04/2024",
    location: "Head Office", custodian: "Deepak Singh",
    status: "active",
    depreciationMethod: "WDV", depreciationRate: 15, usefulLife: 8,
    gstAmount: 238000, totalCost: 1088000,
    batchItems: [
      { subId: "AM-VEH-0001-A", serialNo: "MH12AB1234", location: "Site A - Mumbai", status: "active" },
      { subId: "AM-VEH-0001-B", serialNo: "MH12AB5678", location: "Site B - Pune",   status: "transferred" },
    ],
  },
  {
    id: 6, assetId: "AM-ELE-0001", assetName: "Generator 62.5 KVA",
    category: "Electrical Equipment", trackingType: "individual",
    serialNo: "GEN-KVA-2024001", make: "Cummins", modelNo: "C62.5D6",
    unit: "No", purchaseValue: 450000, purchaseDate: "10/05/2024",
    location: "Site B - Pune", custodian: "Deepak Singh",
    status: "in_maintenance",
    depreciationMethod: "SLM", depreciationRate: 10, usefulLife: 10,
    gstAmount: 81000, totalCost: 531000, batchItems: [],
  },
  {
    id: 7, assetId: "AM-TLS-0001", assetName: "Scaffolding Set (Heavy)",
    category: "Tools & Equipment", trackingType: "batch",
    serialNo: "", make: "Layher", modelNo: "AllRound",
    unit: "Set", purchaseValue: 125000, purchaseDate: "01/06/2024",
    location: "Workshop", custodian: "Rajesh Kumar",
    status: "active",
    depreciationMethod: "SLM", depreciationRate: 15, usefulLife: 7,
    gstAmount: 22500, totalCost: 147500,
    batchItems: [
      { subId: "AM-TLS-0001-A", serialNo: "SCF-SET-001", location: "Site A - Mumbai", status: "active" },
      { subId: "AM-TLS-0001-B", serialNo: "SCF-SET-002", location: "Workshop",        status: "active" },
      { subId: "AM-TLS-0001-C", serialNo: "SCF-SET-003", location: "Workshop",        status: "active" },
    ],
  },
];

// ─── Shared lookups ────────────────────────────────────────────────────────────
export const AM_LOCATIONS = [
  "Head Office", "Site A - Mumbai", "Site B - Pune", "Site C - Nagpur", "Workshop", "Warehouse",
];

export const AM_EMPLOYEES = [
  { id: "E001", name: "Rajesh Kumar",   dept: "Engineering"    },
  { id: "E002", name: "Priya Sharma",   dept: "Administration" },
  { id: "E003", name: "Amit Patel",     dept: "Finance"        },
  { id: "E004", name: "Sunita Verma",   dept: "Administration" },
  { id: "E005", name: "Deepak Singh",   dept: "Operations"     },
  { id: "E006", name: "Anita Nair",     dept: "HR"             },
  { id: "E007", name: "Vikram Desai",   dept: "Engineering"    },
  { id: "E008", name: "Meera Joshi",    dept: "Procurement"    },
];

export const AM_VENDORS = [
  { id: "V001", name: "ABC Plant & Machinery Ltd",   gstin: "27AABCA1234K1Z1" },
  { id: "V002", name: "Rapid Repair Services",        gstin: "27AABCR5678K1Z2" },
  { id: "V003", name: "TechServe Solutions",          gstin: "27AABCT9012K1Z3" },
  { id: "V004", name: "National Equipment Rentals",   gstin: "27AABCN3456K1Z4" },
  { id: "V005", name: "QuickFix Technicians",         gstin: "27AABCQ7890K1Z5" },
];

export const AM_DEPARTMENTS = ["Engineering", "Administration", "Finance", "Operations", "HR", "Procurement", "IT"];

// Returns assets available for a given operation (excludes disposed, and optionally in_maintenance/issued)
export function getAvailableAssets(excludeStatuses = ["disposed"]) {
  return AM_ASSETS.filter((a) => !excludeStatuses.includes(a.status));
}

export function getAssetById(id) {
  return AM_ASSETS.find((a) => String(a.id) === String(id) || a.assetId === id);
}

export function fmtCurrency(v) {
  return v != null ? `₹ ${Number(v).toLocaleString("en-IN")}` : "—";
}

export function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function isOverdue(expectedDate) {
  if (!expectedDate) return false;
  return new Date(expectedDate) < new Date();
}
