import { AM_EMPLOYEES, AM_ASSETS, isOverdue } from "../shared/mockAssets";

export const CONDITION_OPTIONS = [
  { value: "good",      label: "Good" },
  { value: "fair",      label: "Fair" },
  { value: "damaged",   label: "Damaged" },
  { value: "lost",      label: "Lost" },
];

export const MOCK_ISSUES = [
  {
    id: 1, docNo: "AIR-2024-001",
    assetId: "AM-IT-0001", assetName: "Laptop Dell Inspiron 15",
    category: "IT Equipment", isBatch: false, batchQty: 1,
    issuedTo: "Rahul Kumar", department: "Engineering",
    issueDate: "2024-09-01", expectedReturn: "2024-09-08",
    actualReturn: "2024-09-07", conditionAtIssue: "good",
    conditionAtReturn: "good", returnedQty: 1,
    purpose: "Client site visit — needs laptop for presentation",
    issuedBy: "Priya Sharma", receivedBy: "Priya Sharma",
    status: "returned",
    activities: [
      { action: "Issued",   by: "Priya Sharma", at: "2024-09-01T09:00:00", note: "Issued in good condition" },
      { action: "Returned", by: "Priya Sharma", at: "2024-09-07T17:00:00", note: "Returned in good condition, early return" },
    ],
  },
  {
    id: 2, docNo: "AIR-2024-002",
    assetId: "AM-MCH-0001", assetName: "JCB Excavator 3CX",
    category: "Machinery", isBatch: false, batchQty: 1,
    issuedTo: "Site Engineer - Block B", department: "Civil",
    issueDate: "2024-09-10", expectedReturn: "2024-09-20",
    actualReturn: "", conditionAtIssue: "good",
    conditionAtReturn: "", returnedQty: 0,
    purpose: "Foundation excavation Block B",
    issuedBy: "Amit Patel", receivedBy: "",
    status: "issued",
    activities: [
      { action: "Issued", by: "Amit Patel", at: "2024-09-10T07:00:00", note: "Issued for Block B excavation" },
    ],
  },
  {
    id: 3, docNo: "AIR-2024-003",
    assetId: "AM-FRN-0001", assetName: "Executive Office Chair",
    category: "Furniture & Fixture", isBatch: true, batchQty: 5,
    issuedTo: "Conference Room B Setup", department: "Admin",
    issueDate: "2024-08-01", expectedReturn: "2024-08-05",
    actualReturn: "2024-08-07", conditionAtIssue: "good",
    conditionAtReturn: "fair", returnedQty: 4,
    purpose: "Board meeting setup — 5 chairs needed",
    issuedBy: "Sunita Verma", receivedBy: "Sunita Verma",
    status: "partial_returned",
    activities: [
      { action: "Issued",          by: "Sunita Verma", at: "2024-08-01T08:00:00", note: "5 chairs issued for board meeting" },
      { action: "Partial Return",  by: "Sunita Verma", at: "2024-08-07T16:00:00", note: "4 returned — 1 chair missing/lost" },
    ],
  },
  {
    id: 4, docNo: "AIR-2024-004",
    assetId: "AM-VH-0001", assetName: "Tata Tipper Truck 2518",
    category: "Vehicle", isBatch: false, batchQty: 1,
    issuedTo: "Ravi Singh", department: "Logistics",
    issueDate: "2024-07-15", expectedReturn: "2024-07-20",
    actualReturn: "", conditionAtIssue: "good",
    conditionAtReturn: "", returnedQty: 0,
    purpose: "Material delivery — Site C",
    issuedBy: "Amit Patel", receivedBy: "",
    status: "overdue",
    activities: [
      { action: "Issued",  by: "Amit Patel",  at: "2024-07-15T06:00:00", note: "Issued for Site C delivery" },
      { action: "Overdue", by: "System",       at: "2024-07-21T00:00:00", note: "Not returned by expected date" },
    ],
  },
];

let _nextId = MOCK_ISSUES.length + 1;
export function createIssueRecord(data) {
  const rec = {
    id: _nextId,
    docNo: `AIR-${new Date().getFullYear()}-${String(_nextId).padStart(3, "0")}`,
    ...data,
    status: "issued",
    activities: [{ action: "Issued", by: data.issuedBy || "—", at: new Date().toISOString(), note: `Issued in ${data.conditionAtIssue} condition` }],
  };
  _nextId++;
  return rec;
}
