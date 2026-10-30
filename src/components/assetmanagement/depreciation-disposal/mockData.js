import { AM_ASSETS } from "../shared/mockAssets";

// ─── Depreciation schedule calculator ────────────────────────────────────────
export function calcDepreciationSchedule(asset) {
  const { purchaseValue, depreciationMethod, depreciationRate, usefulLife, purchaseDate } = asset;
  if (!purchaseValue || !depreciationMethod || depreciationMethod === "NONE") return [];
  const rate = parseFloat(depreciationRate) / 100;
  const years = parseInt(usefulLife) || 5;
  const startYear = new Date(purchaseDate?.replace(/(\d{2})\/(\d{2})\/(\d{4})/, "$3-$2-$1") || "2024-01-01").getFullYear();

  const rows = [];
  let bookValue = parseFloat(purchaseValue);

  for (let y = 0; y < years; y++) {
    let dep = 0;
    if (depreciationMethod === "SLM") {
      dep = parseFloat(purchaseValue) * rate;
    } else if (depreciationMethod === "WDV") {
      dep = bookValue * rate;
    }
    dep = Math.min(dep, bookValue);
    const closingValue = Math.max(0, bookValue - dep);
    rows.push({
      year: startYear + y,
      openingValue: Math.round(bookValue),
      depreciation: Math.round(dep),
      accDepreciation: Math.round(parseFloat(purchaseValue) - closingValue),
      closingValue: Math.round(closingValue),
    });
    bookValue = closingValue;
    if (bookValue <= 0) break;
  }
  return rows;
}

// ─── Build depreciation summary for all assets ───────────────────────────────
export function getDepreciationSummary() {
  return AM_ASSETS.map((a) => {
    const schedule = calcDepreciationSchedule(a);
    const currentYear = new Date().getFullYear();
    const currentRow = schedule.find((r) => r.year === currentYear) || schedule[schedule.length - 1];
    return {
      id: a.id, assetId: a.assetId, assetName: a.assetName,
      category: a.category,
      purchaseDate: a.purchaseDate,
      purchaseValue: a.purchaseValue,
      depreciationMethod: a.depreciationMethod,
      depreciationRate: a.depreciationRate,
      currentYearDep: currentRow?.depreciation || 0,
      accDepreciation: currentRow?.accDepreciation || 0,
      netBookValue: currentRow?.closingValue || a.purchaseValue,
      usefulLife: a.usefulLife,
      status: a.status,
      schedule,
    };
  });
}

// ─── Disposal records ─────────────────────────────────────────────────────────
export const DISPOSAL_TYPES = [
  { value: "sale",       label: "Sale / Auction" },
  { value: "scrap",      label: "Scrap / Dismantle" },
  { value: "write_off",  label: "Write Off" },
  { value: "donation",   label: "Donation" },
  { value: "exchange",   label: "Exchange / Trade-In" },
];

export const MOCK_DISPOSALS = [
  {
    id: 1, docNo: "DIS-2024-001",
    assetId: "AM-FRN-0001", assetName: "Executive Office Chair",
    category: "Furniture & Fixture",
    disposalType: "scrap",
    requestDate: "2024-07-01",
    approvalDate: "2024-07-05",
    disposalDate: "2024-07-10",
    purchaseValue: 8500,
    bookValue: 6800,
    saleProceeds: 500,
    loss: 6300,
    buyerName: "",
    reason: "3 chairs damaged beyond repair after 6 months — deemed uneconomical to repair",
    requestedBy: "Sunita Verma",
    approvedBy: "Priya Sharma",
    status: "disposed",
    activities: [
      { action: "Requested",  by: "Sunita Verma", at: "2024-07-01T10:00:00", note: "3 chairs damaged beyond repair" },
      { action: "Approved",   by: "Priya Sharma", at: "2024-07-05T11:00:00", note: "Approved for scrap disposal" },
      { action: "Disposed",   by: "Sunita Verma", at: "2024-07-10T14:00:00", note: "Scrapped; scrap value ₹500 received" },
    ],
  },
  {
    id: 2, docNo: "DIS-2024-002",
    assetId: "AM-IT-0001", assetName: "Laptop Dell Inspiron 15",
    category: "IT Equipment",
    disposalType: "sale",
    requestDate: "2024-09-01",
    approvalDate: "",
    disposalDate: "",
    purchaseValue: 65000,
    bookValue: 39000,
    saleProceeds: 0,
    loss: 0,
    buyerName: "",
    reason: "AM-IT-0001-D end-of-life — 3 years usage, fully depreciated in WDV terms. Selling to employee at scrap value",
    requestedBy: "Amit Patel",
    approvedBy: "",
    status: "under_review",
    activities: [
      { action: "Requested", by: "Amit Patel", at: "2024-09-01T09:00:00", note: "AM-IT-0001-D 3 years old — disposal requested" },
    ],
  },
];

let _nextId = MOCK_DISPOSALS.length + 1;
export function createDisposalRecord(data) {
  const rec = {
    id: _nextId,
    docNo: `DIS-${new Date().getFullYear()}-${String(_nextId).padStart(3, "0")}`,
    ...data,
    status: "under_review",
    activities: [{ action: "Requested", by: data.requestedBy || "—", at: new Date().toISOString(), note: data.reason || "" }],
  };
  _nextId++;
  return rec;
}
