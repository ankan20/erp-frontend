/**
 * Profit & Loss statement structure.
 *
 * Transcribed from the approved PL_Format sheet. The layout is fixed by the
 * business, so it lives here rather than coming from the API — the API only
 * supplies values, keyed by CC `code`. Any code the API sends that is not in
 * this tree is ignored; any code here the API omits renders blank. That way the
 * statement always reads the same, whatever the backend has data for.
 *
 * `family` sets the colour family of a whole branch — children inherit it — and
 * the row's depth then picks the shade, so a nested group is always a lighter
 * version of its parent (B.2.1 lighter than B.2, lighter than B).
 *   sale    — A and everything under it
 *   expense — B and everything under it
 *   result  — C, the bottom line
 */

// The five value columns, each rendered with its own "% " column beside it
export const PL_COLUMNS = [
  { key: "order",    label: "Order"     },
  { key: "workDone", label: "Work Done" },
  { key: "booked",   label: "Booked"    },
  { key: "stock",    label: "Stock"     },
  { key: "actual",   label: "Actual"    },
];

export const PL_STRUCTURE = [
  {
    ref: "A",
    title: "SALE",
    family: "sale",
    children: [
      { ref: "A.1", code: "CRIN", title: "Certified Invoice sale" },
      { ref: "A.2", code: "CRHL", title: "Certified but Hold" },
      { ref: "A.3", code: "CRAP", title: "Certified Ammendment Pending" },
      { ref: "A.4", code: "UCAP", title: "Work Done Uncertified Ammendment Pending" },
      { ref: "A.5", code: "WIPS", title: "Job Work in Progress" },
      { ref: "A.6", code: "INOC", title: "Head Office Bearing Share" },
    ],
  },
  {
    ref: "B",
    title: "Expenses",
    family: "expense",
    children: [
      {
        ref: "B.1",
        title: "Direct Expenses",
        children: [
          { ref: "B.1.1", code: "DRCW", title: "Composite Work Charges" },
          { ref: "B.1.2", code: "DRMC", title: "Consumable Materials" },
          { ref: "B.1.3", code: "DRFD", title: "Diesel & Others Fuels" },
          { ref: "B.1.4", code: "DRMH", title: "Hardware Materials" },
          { ref: "B.1.5", code: "DRUS", title: "Uniform & Safety Materials" },
          { ref: "B.1.6", code: "DRMR", title: "Machinery Rental/Hire Charges" },
          { ref: "B.1.7", code: "DRLC", title: "PRW Work Charges" },
          { ref: "B.1.8", code: "DRLS", title: "Lumsum Work Charges" },
          { ref: "B.1.9", code: "DRMS", title: "Shuttering Materials" },
        ],
      },
      {
        ref: "B.2",
        title: "Indirect Expenses",
        children: [
          {
            ref: "B.2.1",
            title: "Project Overhead",
            children: [
              { ref: "B.2.1.1",  code: "IRDC", title: "Assets Depreciation Charges" },
              { ref: "B.2.1.2",  code: "IRAD", title: "Assets Rental Charges" },
              { ref: "B.2.1.3",  code: "IRLE", title: "Electricity & Water" },
              { ref: "B.2.1.4",  code: "IRFS", title: "Food at Site Office" },
              { ref: "B.2.1.5",  code: "IRMR", title: "Machinery Repair & Maintenance" },
              { ref: "B.2.1.6",  code: "IRLU", title: "Materials Loading & Unloading" },
              { ref: "B.2.1.7",  code: "IRMT", title: "Materials Transport Charges" },
              { ref: "B.2.1.8",  code: "IRPS", title: "Printing & Stationery" },
              { ref: "B.2.1.9",  code: "IRSD", title: "Scrap & Demolition for Defective work" },
              { ref: "B.2.1.10", code: "IRIM", title: "Site Infra Materials" },
              { ref: "B.2.1.11", code: "IRIL", title: "Site Infra Work Charges" },
              { ref: "B.2.1.12", code: "IRFM", title: "Site Office Maintenance" },
              { ref: "B.2.1.13", code: "IRTT", title: "Hand Tools & Tackles" },
              { ref: "B.2.1.14", code: "IRLH", title: "Worker Hospitality & Hygiene" },
              { ref: "B.2.1.15", code: "IRLM", title: "Worker Mobilization Expenses" },
              { ref: "B.2.1.16", code: "IRLT", title: "Worker Tifin & Foods" },
            ],
          },
          {
            ref: "B.2.2",
            title: "Employee Overhead",
            children: [
              { ref: "B.2.2.1", code: "IOFM", title: "Food Exp. at Guest House" },
              { ref: "B.2.2.2", code: "IOHR", title: "House Rent & Electricity" },
              { ref: "B.2.2.3", code: "IOME", title: "Medical & Hospitalization" },
              { ref: "B.2.2.4", code: "IOMS", title: "Miscellaneous Expenses" },
              { ref: "B.2.2.5", code: "IOMB", title: "Mobile & Internet" },
              { ref: "B.2.2.6", code: "IOSS", title: "Staff Salary & Bonus" },
              { ref: "B.2.2.7", code: "IOVR", title: "Staff Vehicles Running" },
              { ref: "B.2.2.8", code: "IOTV", title: "Tour & Travelling" },
            ],
          },
          {
            ref: "B.2.3",
            title: "Office Overhead",
            children: [
              { ref: "B.2.3.1",  code: "IOCR", title: "Head Office Expenses" },
              { ref: "B.2.3.2",  code: "CRBC", title: "Bank Charges" },
              { ref: "B.2.3.3",  code: "CRBD", title: "Business Development" },
              { ref: "B.2.3.4",  code: "CRCC", title: "Consultancy Charges" },
              { ref: "B.2.3.5",  code: "CRDR", title: "Director Remonaration" },
              { ref: "B.2.3.6",  code: "CRES", title: "Employee Insurance" },
              { ref: "B.2.3.7",  code: "CRIC", title: "Insurance Charges" },
              { ref: "B.2.3.8",  code: "CRIP", title: "Interest Paid" },
              { ref: "B.2.3.9",  code: "CRLC", title: "Legal Charges" },
              { ref: "B.2.3.10", code: "CRPF", title: "Provident Fund" },
              { ref: "B.2.3.11", code: "CRIT", title: "Income Tax Paid" },
            ],
          },
        ],
      },
    ],
  },
];

// Bottom line: Sale (A) − Expenses (B)
export const PL_RESULT_ROW = { ref: "C", title: "Profit & Loss", family: "result" };
