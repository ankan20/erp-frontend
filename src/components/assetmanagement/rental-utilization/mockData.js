export const RENTAL_DIRECTION = [
  { value: "outgoing", label: "Asset Rented Out (to Client)" },
  { value: "incoming", label: "Asset Taken on Rent (from Vendor)" },
];

export const RENTAL_BASIS = [
  { value: "daily",   label: "Daily" },
  { value: "weekly",  label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "fixed",   label: "Fixed Period" },
];

export const MOCK_RENTALS = [
  {
    id: 1, docNo: "RNT-2024-001",
    direction: "outgoing",
    assetId: "AM-MCH-0001", assetName: "Excavator JCB 3DX",
    party: "Sunrise Constructions Pvt Ltd",
    partyContact: "9876543210",
    startDate: "2024-04-01", endDate: "2024-06-30",
    actualReturnDate: "2024-07-02",
    rentalBasis: "monthly", rentalRate: 75000,
    deposit: 150000,
    totalDays: 91, totalAmount: 225000,
    operatorIncluded: true, fuelIncluded: false,
    location: "Bandra, Mumbai",
    agreementNo: "AGR-2024-MCH-001",
    remarks: "Rented to Sunrise for their residential project",
    status: "returned",
    utilizationLog: [
      { month: "Apr 2024", hoursWorked: 196, fuelConsumed: 980, remarks: "Good utilization" },
      { month: "May 2024", hoursWorked: 210, fuelConsumed: 1050, remarks: "" },
      { month: "Jun 2024", hoursWorked: 175, fuelConsumed: 875, remarks: "Less utilization last week" },
    ],
    activities: [
      { action: "Agreement Created", by: "Priya Sharma", at: "2024-03-25T10:00:00", note: "Rental agreement signed with Sunrise Constructions" },
      { action: "Asset Deployed",    by: "Rajesh Kumar", at: "2024-04-01T08:00:00", note: "Asset dispatched to Bandra site" },
      { action: "Extended",          by: "Priya Sharma", at: "2024-06-28T11:00:00", note: "Extended by 2 days per client request" },
      { action: "Returned",          by: "Rajesh Kumar", at: "2024-07-02T16:00:00", note: "Asset returned in good condition" },
    ],
  },
  {
    id: 2, docNo: "RNT-2024-002",
    direction: "incoming",
    assetId: "", assetName: "Tower Crane 25T",
    party: "National Equipment Rentals",
    partyContact: "9123456789",
    startDate: "2024-05-01", endDate: "2024-10-31",
    actualReturnDate: "",
    rentalBasis: "monthly", rentalRate: 120000,
    deposit: 240000,
    totalDays: 184, totalAmount: 720000,
    operatorIncluded: true, fuelIncluded: false,
    location: "Site C - Nagpur",
    agreementNo: "AGR-2024-EXT-002",
    remarks: "Tower crane rented from National for high-rise project at Site C",
    status: "active",
    utilizationLog: [
      { month: "May 2024",  hoursWorked: 200, fuelConsumed: 0, remarks: "Commissioning done" },
      { month: "Jun 2024",  hoursWorked: 220, fuelConsumed: 0, remarks: "" },
      { month: "Jul 2024",  hoursWorked: 215, fuelConsumed: 0, remarks: "" },
      { month: "Aug 2024",  hoursWorked: 190, fuelConsumed: 0, remarks: "Slight downtime due to weather" },
      { month: "Sep 2024",  hoursWorked: 218, fuelConsumed: 0, remarks: "" },
    ],
    activities: [
      { action: "Agreement Created", by: "Meera Joshi",  at: "2024-04-25T09:00:00", note: "Contract signed with National Equipment Rentals" },
      { action: "Asset Mobilized",   by: "Deepak Singh", at: "2024-05-01T07:00:00", note: "Tower crane erected at Site C" },
    ],
  },
  {
    id: 3, docNo: "RNT-2024-003",
    direction: "outgoing",
    assetId: "AM-MCH-0002", assetName: "Concrete Mixer 10/7",
    party: "Delta Developers",
    partyContact: "9988776655",
    startDate: "2024-07-15", endDate: "2024-08-14",
    actualReturnDate: "",
    rentalBasis: "monthly", rentalRate: 8000,
    deposit: 16000,
    totalDays: 30, totalAmount: 8000,
    operatorIncluded: false, fuelIncluded: false,
    location: "Andheri, Mumbai",
    agreementNo: "AGR-2024-MCH-003",
    remarks: "Sub-unit AM-MCH-0002-A rented to Delta Developers",
    status: "overdue",
    utilizationLog: [],
    activities: [
      { action: "Agreement Created", by: "Priya Sharma", at: "2024-07-12T11:00:00", note: "" },
      { action: "Asset Deployed",    by: "Rajesh Kumar", at: "2024-07-15T09:00:00", note: "AM-MCH-0002-A deployed to Andheri" },
    ],
  },
];

let _nextId = MOCK_RENTALS.length + 1;
export function createRentalRecord(data) {
  const rec = {
    id: _nextId,
    docNo: `RNT-${new Date().getFullYear()}-${String(_nextId).padStart(3, "0")}`,
    ...data,
    status: "active",
    utilizationLog: [],
    activities: [{ action: "Agreement Created", by: data.createdBy || "—", at: new Date().toISOString(), note: data.remarks || "" }],
  };
  _nextId++;
  return rec;
}
