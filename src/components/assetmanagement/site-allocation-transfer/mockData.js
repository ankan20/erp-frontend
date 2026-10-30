import { AM_ASSETS, AM_EMPLOYEES, AM_LOCATIONS } from "../shared/mockAssets";

export const ALLOCATION_TYPES = [
  { value: "allocation",  label: "New Allocation" },
  { value: "transfer",    label: "Transfer" },
  { value: "return",      label: "Return to Base" },
];

export const TRANSFER_REASONS = [
  "Project Assignment",
  "Site Requirement",
  "Maintenance Transfer",
  "Redeployment",
  "Employee Departure",
  "Routine Rotation",
  "Emergency Requirement",
];

// ─── Mock allocation/transfer records ────────────────────────────────────────
export const MOCK_ALLOCATIONS = [
  {
    id: 1, docNo: "SAT-2024-001",
    txnDate: "2024-01-20", type: "allocation",
    assetId: "AM-MCH-0001", assetName: "Excavator JCB 3DX",
    fromLocation: "Warehouse",  toLocation: "Site A - Mumbai",
    fromCustodian: "",          toCustodian: "Rajesh Kumar",
    department: "Engineering",
    reason: "Project Assignment",
    requestedBy: "Priya Sharma", approvedBy: "Deepak Singh",
    dispatchDate: "2024-01-22", receiptDate: "2024-01-23",
    remarks: "Allocated for Foundation Work - Phase 1",
    status: "completed",
    activities: [
      { action: "Created",    by: "Priya Sharma", at: "2024-01-20T09:00:00", note: "Allocation request raised" },
      { action: "Approved",   by: "Deepak Singh", at: "2024-01-21T11:00:00", note: "Approved for dispatch" },
      { action: "Dispatched", by: "Rajesh Kumar", at: "2024-01-22T08:00:00", note: "Asset dispatched from Warehouse" },
      { action: "Received",   by: "Rajesh Kumar", at: "2024-01-23T10:30:00", note: "Asset received and commissioned at Site A" },
    ],
  },
  {
    id: 2, docNo: "SAT-2024-002",
    txnDate: "2024-01-22", type: "allocation",
    assetId: "AM-MCH-0002", assetName: "Concrete Mixer 10/7",
    fromLocation: "Warehouse",  toLocation: "Site A - Mumbai",
    fromCustodian: "",          toCustodian: "Deepak Singh",
    department: "Operations",
    reason: "Site Requirement",
    requestedBy: "Rajesh Kumar", approvedBy: "Deepak Singh",
    dispatchDate: "2024-01-24", receiptDate: "2024-01-25",
    remarks: "2 units allocated — AM-MCH-0002-A to Site A, AM-MCH-0002-B to Site B",
    status: "completed",
    activities: [
      { action: "Created",   by: "Rajesh Kumar", at: "2024-01-22T10:00:00", note: "Allocation for 2 mixers" },
      { action: "Approved",  by: "Deepak Singh", at: "2024-01-23T09:00:00", note: "" },
      { action: "Dispatched",by: "Meera Joshi",  at: "2024-01-24T07:30:00", note: "" },
      { action: "Received",  by: "Deepak Singh", at: "2024-01-25T12:00:00", note: "Both mixers received in good condition" },
    ],
  },
  {
    id: 3, docNo: "SAT-2024-008",
    txnDate: "2024-06-01", type: "transfer",
    assetId: "AM-VEH-0001", assetName: "Tata Ace Mini Truck",
    fromLocation: "Site A - Mumbai", toLocation: "Site B - Pune",
    fromCustodian: "Rajesh Kumar",   toCustodian: "Anita Nair",
    department: "Operations",
    reason: "Redeployment",
    requestedBy: "Anita Nair", approvedBy: "Deepak Singh",
    dispatchDate: "2024-06-03", receiptDate: "2024-06-04",
    remarks: "AM-VEH-0001-B transferred to Site B for logistic support",
    status: "completed",
    activities: [
      { action: "Created",   by: "Anita Nair",  at: "2024-06-01T10:00:00", note: "Transfer request for vehicle to Site B" },
      { action: "Approved",  by: "Deepak Singh",at: "2024-06-02T09:00:00", note: "" },
      { action: "Dispatched",by: "Rajesh Kumar",at: "2024-06-03T07:00:00", note: "" },
      { action: "Received",  by: "Anita Nair",  at: "2024-06-04T11:00:00", note: "Vehicle received and operational" },
    ],
  },
  {
    id: 4, docNo: "SAT-2024-014",
    txnDate: "2024-08-10", type: "transfer",
    assetId: "AM-ELE-0001", assetName: "Generator 62.5 KVA",
    fromLocation: "Site A - Mumbai", toLocation: "Site B - Pune",
    fromCustodian: "Rajesh Kumar",   toCustodian: "Deepak Singh",
    department: "Operations",
    reason: "Emergency Requirement",
    requestedBy: "Deepak Singh", approvedBy: "",
    dispatchDate: "", receiptDate: "",
    remarks: "Urgent — generator needed at Site B for power backup",
    status: "pending",
    activities: [
      { action: "Created",  by: "Deepak Singh", at: "2024-08-10T08:00:00", note: "Emergency transfer request" },
    ],
  },
  {
    id: 5, docNo: "SAT-2024-017",
    txnDate: "2024-09-05", type: "allocation",
    assetId: "AM-IT-0001", assetName: "Laptop Dell Inspiron 15",
    fromLocation: "Head Office", toLocation: "Site A - Mumbai",
    fromCustodian: "Amit Patel",  toCustodian: "Vikram Desai",
    department: "Engineering",
    reason: "Project Assignment",
    requestedBy: "Vikram Desai", approvedBy: "Priya Sharma",
    dispatchDate: "2024-09-06", receiptDate: "",
    remarks: "AM-IT-0001-C dispatched to Site A",
    status: "in_transit",
    activities: [
      { action: "Created",   by: "Vikram Desai",at: "2024-09-05T09:00:00", note: "Request for laptop at site" },
      { action: "Approved",  by: "Priya Sharma",at: "2024-09-05T14:00:00", note: "" },
      { action: "Dispatched",by: "Amit Patel",  at: "2024-09-06T09:00:00", note: "Dispatched via courier" },
    ],
  },
];

let _nextId = MOCK_ALLOCATIONS.length + 1;
export function createAllocationRecord(data) {
  const rec = {
    id: _nextId,
    docNo: `SAT-${new Date().getFullYear()}-${String(_nextId).padStart(3, "0")}`,
    ...data,
    status: "pending",
    activities: [{ action: "Created", by: data.requestedBy || "—", at: new Date().toISOString(), note: data.remarks || "" }],
  };
  _nextId++;
  return rec;
}
