export const MAINTENANCE_TYPES = [
  { value: "preventive",  label: "Preventive Maintenance" },
  { value: "breakdown",   label: "Breakdown Repair" },
  { value: "annual",      label: "Annual Overhaul" },
  { value: "amc",         label: "AMC Service" },
  { value: "inspection",  label: "Routine Inspection" },
];

export const PRIORITY_LEVELS = [
  { value: "low",      label: "Low" },
  { value: "medium",   label: "Medium" },
  { value: "high",     label: "High" },
  { value: "critical", label: "Critical" },
];

export const MOCK_MAINTENANCE = [
  {
    id: 1, docNo: "MR-2024-001",
    assetId: "AM-MCH-0001", assetName: "Excavator JCB 3DX",
    type: "preventive", priority: "medium",
    reportedDate: "2024-03-01", scheduledDate: "2024-03-05",
    startDate: "2024-03-05", completionDate: "2024-03-07",
    reportedBy: "Rajesh Kumar",
    vendorId: "V002", vendorName: "Rapid Repair Services",
    technician: "Suresh Jadhav",
    issue: "Scheduled 250-hour service — engine oil change, filter replacement, hydraulic fluid check",
    workDone: "Engine oil changed, all filters replaced, hydraulic lines checked and sealed, bucket teeth replaced",
    spareParts: [
      { item: "Engine Oil 15W40", qty: 20, unit: "Ltr", cost: 2400 },
      { item: "Oil Filter",       qty: 2,  unit: "No",  cost: 800  },
      { item: "Air Filter",       qty: 1,  unit: "No",  cost: 1200 },
      { item: "Bucket Teeth Set", qty: 1,  unit: "Set", cost: 8500 },
    ],
    labourCost: 5000, partsCost: 12900, totalCost: 17900,
    downtimeHours: 48,
    nextServiceDue: "2024-09-05",
    status: "completed",
    activities: [
      { action: "Reported",   by: "Rajesh Kumar", at: "2024-03-01T09:00:00", note: "Scheduled preventive maintenance due" },
      { action: "Scheduled",  by: "Priya Sharma", at: "2024-03-02T11:00:00", note: "Vendor assigned: Rapid Repair Services" },
      { action: "Started",    by: "Suresh Jadhav",at: "2024-03-05T08:00:00", note: "Work commenced" },
      { action: "Completed",  by: "Suresh Jadhav",at: "2024-03-07T17:00:00", note: "All work done, asset commissioned" },
    ],
  },
  {
    id: 2, docNo: "MR-2024-002",
    assetId: "AM-ELE-0001", assetName: "Generator 62.5 KVA",
    type: "breakdown", priority: "critical",
    reportedDate: "2024-08-05", scheduledDate: "2024-08-06",
    startDate: "2024-08-06", completionDate: "",
    reportedBy: "Deepak Singh",
    vendorId: "V002", vendorName: "Rapid Repair Services",
    technician: "Ramesh Tiwari",
    issue: "Generator not starting — suspected AVR failure. Critical power outage at Site B",
    workDone: "",
    spareParts: [],
    labourCost: 0, partsCost: 0, totalCost: 0,
    downtimeHours: 0,
    nextServiceDue: "",
    status: "in_progress",
    activities: [
      { action: "Reported",   by: "Deepak Singh", at: "2024-08-05T07:30:00", note: "Generator down — AVR fault suspected" },
      { action: "Escalated",  by: "Anita Nair",   at: "2024-08-05T09:00:00", note: "Critical — escalated to management" },
      { action: "Scheduled",  by: "Priya Sharma", at: "2024-08-05T11:00:00", note: "Rapid Repair Services mobilized" },
      { action: "Started",    by: "Ramesh Tiwari",at: "2024-08-06T08:00:00", note: "Diagnostic in progress" },
    ],
  },
  {
    id: 3, docNo: "MR-2024-003",
    assetId: "AM-IT-0001", assetName: "Laptop Dell Inspiron 15",
    type: "breakdown", priority: "low",
    reportedDate: "2024-05-18", scheduledDate: "2024-05-20",
    startDate: "2024-05-20", completionDate: "2024-05-22",
    reportedBy: "Amit Patel",
    vendorId: "V003", vendorName: "TechServe Solutions",
    technician: "Nikhil Bhosale",
    issue: "Unit AM-IT-0001-E — screen flickering, suspected LCD connector fault",
    workDone: "LCD cable replaced, screen tested and confirmed working",
    spareParts: [
      { item: "LCD Flex Cable", qty: 1, unit: "No", cost: 850 },
    ],
    labourCost: 500, partsCost: 850, totalCost: 1350,
    downtimeHours: 96,
    nextServiceDue: "",
    status: "completed",
    activities: [
      { action: "Reported",  by: "Amit Patel",     at: "2024-05-18T10:00:00", note: "Screen flickering on AM-IT-0001-E" },
      { action: "Scheduled", by: "Priya Sharma",   at: "2024-05-19T09:00:00", note: "Sent to TechServe Solutions" },
      { action: "Started",   by: "Nikhil Bhosale", at: "2024-05-20T10:00:00", note: "" },
      { action: "Completed", by: "Nikhil Bhosale", at: "2024-05-22T15:00:00", note: "LCD cable replaced, unit returned" },
    ],
  },
  {
    id: 4, docNo: "MR-2024-004",
    assetId: "AM-MCH-0001", assetName: "Excavator JCB 3DX",
    type: "annual", priority: "medium",
    reportedDate: "2024-07-01", scheduledDate: "2024-07-15",
    startDate: "", completionDate: "",
    reportedBy: "Rajesh Kumar",
    vendorId: "V001", vendorName: "ABC Plant & Machinery Ltd",
    technician: "",
    issue: "Annual overhaul due as per OEM schedule",
    workDone: "",
    spareParts: [],
    labourCost: 0, partsCost: 0, totalCost: 0,
    downtimeHours: 0,
    nextServiceDue: "",
    status: "scheduled",
    activities: [
      { action: "Reported",  by: "Rajesh Kumar", at: "2024-07-01T09:00:00", note: "Annual overhaul due" },
      { action: "Scheduled", by: "Priya Sharma", at: "2024-07-02T11:00:00", note: "Scheduled with OEM: ABC Plant & Machinery" },
    ],
  },
];

let _nextId = MOCK_MAINTENANCE.length + 1;
export function createMaintenanceRecord(data) {
  const rec = {
    id: _nextId,
    docNo: `MR-${new Date().getFullYear()}-${String(_nextId).padStart(3, "0")}`,
    ...data,
    status: "reported",
    workDone: "",
    spareParts: data.spareParts || [],
    labourCost: 0, partsCost: 0, totalCost: 0,
    downtimeHours: 0,
    activities: [{ action: "Reported", by: data.reportedBy || "—", at: new Date().toISOString(), note: data.issue || "" }],
  };
  _nextId++;
  return rec;
}
