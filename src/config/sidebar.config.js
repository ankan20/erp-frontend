import {
  Settings,
  Database,
  Package,
  Briefcase,
  Boxes,
  Wallet,
  Users,
  ListTodo,
} from "lucide-react";
//dummy changes
export const sidebarConfig = [
  {
    title: "Settings",
    key: "settings",
    icon: Settings,
    basePath: "/settings",
    hideInPermissions: true,
    children: [
      {
        title: "Company Details",
        path: "/settings/company-details",
        activePaths: ["/settings/company-details"],
        permissionKey: "company_details",
      },
      {
        title: "User ID & Password",
        path: "/settings/user-id-password",
        activePaths: ["/settings/user-id-password"],
        permissionKey: "user_id_password",
      },
      {
        title: "Project Code",
        path: "/settings/project-code",
        activePaths: ["/settings/project-code"],
        permissionKey: "project_code",
      },
      {
        title: "Roles & User Assignment",
        path: "/settings/role-designation",
        activePaths: ["/settings/role-designation"],
        permissionKey: "roles_and_user_assignment",
      },
      // {
      //   title: "Approval Path Line & User",
      //   path: "/settings/approval-path",
      //   permissionKey: "approval_path_line_user",
      // },
    ],
  },

  {
    title: "Master",
    key: "master",
    icon: Database,
    hideInPermissions: true,
    basePath: "/master",
    children: [
      {
        title: "Vendor Code",
        path: "/master/ledger-code",
        activePaths: ["/master/ledger-code"],
        permissionKey: "ledger_code",
      },
      {
        title: "Item Code",
        path: "/master/item-code",
        activePaths: ["/master/item-code"],
        permissionKey: "item_code",
      },
      {
        title: "Asset Code",
        path: "/master/asset-code",
        activePaths: ["/master/asset-code"],
        permissionKey: "asset_code",
      },
      { title: "Unit", path: "/master/unit", activePaths: ["/master/unit"], permissionKey: "unit" },
      {
        title: "Cost Center (CC)",
        path: "/master/cc-code",
        activePaths: ["/master/cc-code"],
        permissionKey: "cost_center_code",
      },
      {
        title: "Category & Group",
        path: "/master/category-group",
        activePaths: ["/master/category-group"],
        permissionKey: "category_group",
      },
      {
        title: "Terms & Conditions",
        path: "/master/terms-condition",
        activePaths: ["/master/terms-condition"],
        permissionKey: "terms_condition",
      },
      {
        title: "Bank & Cash Master",
        path: "/master/bank-cash",
        activePaths: ["/master/bank-cash"],
        permissionKey: "bank_cash",
      },
      {
        title: "Contact Dairy",
        key: "master_contact_dairy",
        children: [
          {
            title: "Materials",
            path: "/master/contact-dairy/materials",
            activePaths: ["/master/contact-dairy/materials"],
            permissionKey: "master_contact_dairy_materials",
          },
          {
            title: "Work Force",
            path: "/master/contact-dairy/work-force",
            activePaths: ["/master/contact-dairy/work-force"],
            permissionKey: "master_contact_dairy_work_force",
          },
          {
            title: "Plant & Machinery",
            path: "/master/contact-dairy/plant-machinery",
            activePaths: ["/master/contact-dairy/plant-machinery"],
            permissionKey: "master_contact_dairy_plant_machinery",
          },
        ],
      },
    ],
  },

  {
    title: "Resources Management",
    key: "hr",
    icon: Package,
    basePath: "/resource-management",
    children: [
      {
        title: "Procurement",
        children: [
          {
            title: "Indent",
            path: "/resource-management/procurement/indent",
            activePaths: ["/resource-management/procurement/indent"],
            permissionKey: "indent",
          },
          {
            title: "Enquiry",
            path: "/resource-management/procurement/enquiry",
            activePaths: ["/resource-management/procurement/enquiry"],
            permissionKey: "enquiry",
          },
          {
            title: "Order",
            showChildrenInPermission: false,
            children: [
              {
                title: "Material Order",
                path: "/resource-management/procurement/order/material-order",
                activePaths: ["/resource-management/procurement/order/material-order"],
                permissionKey: "order",
              },
              {
                title: "Service Order",
                path: "/resource-management/procurement/order/service-order",
                activePaths: ["/resource-management/procurement/order/service-order"],
                permissionKey: "order",
              },
            ],
          },
        ],
      },
      {
        title: "Materials",
        children: [
          {
            title: "Goods Received Note (GRN)",
            path: "/resource-management/material/grn",//need path change
            activePaths: ["/resource-management/material/grn"],
            permissionKey: "goods_received_note",
          },
          {
            title: "Goods Issue Note (GIN)",
            path: "/resource-management/material/gin",
            activePaths: ["/resource-management/material/gin"],
            permissionKey: "goods_issue_note",
          },
          {
            title: "Inventory",
            path: "/resource-management/material/stock-report",
            activePaths: ["/resource-management/material/stock-report"],
            permissionKey: "stock_report",
          },
        ],
      },
      {
        title: "Services",
        children: [
          {
            title: "Manpower",
            children: [
              {
                title: "DLR",
                path: "/resource-management/services/manpower/dlr",
                activePaths: ["/resource-management/services/manpower/dlr"],
                permissionKey: "dlr",
              },
              {
                title: "Labour ID",
                path: "/resource-management/services/manpower/labour-id",
                activePaths: ["/resource-management/services/manpower/labour-id"],
                permissionKey: "labour_id",
              },
            ],
          },
          {
            title: "Plant & Machinery",
            children: [
              {
                title: "P&M Inventory",
                path: "/resource-management/services/plant-machinery/pm-inventory",
                activePaths: ["/resource-management/services/plant-machinery/pm-inventory"],
                permissionKey: "pm_inventory",
              },
              {
                title: "Log Sheet",
                path: "/resource-management/services/plant-machinery/log-sheet", //chanded required latter in file u
                activePaths: ["/resource-management/services/plant-machinery/log-sheet"],
                permissionKey: "log_sheet",
              },
              {
                title: "Batching Plant",
                path: "/resource-management/services/plant-machinery/batching-plant",
                activePaths: ["/resource-management/services/plant-machinery/batching-plant"],
                permissionKey: "batching_plant",
              },
            ],
          },
          {
            title: "Service Received Note (SRN)",
            path: "/resource-management/services/srn",
            activePaths: ["/resource-management/services/srn"],
            permissionKey: "service_received_note",
          },
        ],
      },
      {
        title: "Sub Contractor Billing",
        children: [
          {
            title: "Bill Receive Register",
            path: "/resource-management/sub-contractor-billing/bill-receive-register",
            permissionKey: "bill_receive_register",
            // Also highlight when on the BRR-linked e-reconcile bill pages
            activePaths: [
              "/resource-management/sub-contractor-billing/bill-receive-register",
              "/resource-management/sub-contractor-billing/e-reconcile-bill",
            ],
          },
          // {
          //   title: "e-Reconcile Bill (GRN)",
          //   path: "/resource-management/sub-contractor-billing/e-reconcile-bill/grn",
          //   permissionKey: "billing_by_grn",
          // },
          // {
          //   title: "e-Reconcile Bill (SRN)",
          //   path: "/resource-management/sub-contractor-billing/e-reconcile-bill/srn",
          //   permissionKey: "billing_by_srn",
          // },
          {
            title: "Payment Request",
            path: "/resource-management/sub-contractor-billing/payment-request",
            activePaths: ["/resource-management/sub-contractor-billing/payment-request"],
            permissionKey: "payment_request",
          },
        ],
      },
      {
        title: "Contact Dairy",
        children: [
          {
            title: "Materials",
            path: "/resource-management/contact-dairy/materials",
            activePaths: ["/resource-management/contact-dairy/materials"],
            permissionKey: "contact_dairy_materials",
          },
          {
            title: "Work Force",
            path: "/resource-management/contact-dairy/work-force",
            activePaths: ["/resource-management/contact-dairy/work-force"],
            permissionKey: "contact_dairy_work_force",
          },
          {
            title: "Plant & Machinery",
            path: "/resource-management/contact-dairy/plant-machinery",
            activePaths: ["/resource-management/contact-dairy/plant-machinery"],
            permissionKey: "contact_dairy_plant_machinery",
          },
        ],
      },
    ],
  },

  {
    title: "Project Management",
    key: "pm",
    icon: Briefcase,
    basePath: "/project-management",
    children: [
      {
        title: "Contracts",
        children: [
          {
            title: "Sale Order",
            path: "/project-management/contacts/sale-order",
            activePaths: ["/project-management/contacts/sale-order"],
            permissionKey: "sale_order",
          },
          {
            title: "Budget Master",
            path: "/project-management/contacts/budget",
            activePaths: ["/project-management/contacts/budget"],
            permissionKey: "budget_master",
          },
          {
            title: "Extra Work",
            path: "/project-management/contacts/extra-work",
            activePaths: ["/project-management/contacts/extra-work"],
            permissionKey: "extra_work",
          },
        ],
      },

      {
        title: "Planning",
        children: [
          {
            title: "L1 Schedule",
            path: "/project-management/planning/l1-schedule",
            activePaths: ["/project-management/planning/l1-schedule"],
            permissionKey: "l1_schedule",
          },
          {
            title: "Monthly Planning",
            path: "/project-management/planning/monthly",
            activePaths: ["/project-management/planning/monthly"],
            permissionKey: "monthly_planning",
          },
          {
            title: "Micro Planning",
            path: "/project-management/planning/micro",
            activePaths: ["/project-management/planning/micro"],
            permissionKey: "micro_planning",
          },
          {
            title: "Promise Schedule",
            path: "/project-management/planning/promise-schedule",
            activePaths: ["/project-management/planning/promise-schedule"],
            permissionKey: "promise_schedule",
          },
        ],
      },

      {
        title: "Progress",
        children: [
          {
            title: "Daily Progress Report",
            path: "/project-management/planning/dpr",
            activePaths: ["/project-management/planning/dpr"],
            permissionKey: "daily_progress_report",
          },
          {
            title: "Job Achievement",
            path: "/project-management/progress/job-achievement",
            activePaths: ["/project-management/progress/job-achievement"],
            permissionKey: "job_achievement",
          },
        ],
      },

      {
        title: "Register",
        children: [
          {
            title: "Drawing Register",
            path: "/project-management/register/drawing",
            activePaths: ["/project-management/register/drawing"],
            permissionKey: "drawing_register",
          },
          {
            title: "BBS Register",
            path: "/project-management/register/bbs",
            activePaths: ["/project-management/register/bbs"],
            permissionKey: "bbs_register",
          },
          {
            title: "Concrete Register",
            path: "/project-management/register/concrete",
            activePaths: ["/project-management/register/concrete"],
            permissionKey: "concrete_register",
          },
          {
            title: "Hindrance Register",
            path: "/project-management/register/hindrance",
            activePaths: ["/project-management/register/hindrance"],
            permissionKey: "hindrance_register",
          },
        ],
      },

      {
        title: "Customer Billing",
        children: [
          {
            title: "Sale Bill - Claim",
            path: "/project-management/customer-billing/sale-bill-claim",
            activePaths: ["/project-management/customer-billing/sale-bill-claim"],
            permissionKey: "sale_claim_bill",
          },
          {
            title: " Sale Bill - Certified",
            path: "/project-management/customer-billing/sale-bill-certified",
            activePaths: ["/project-management/customer-billing/sale-bill-certified"],
            permissionKey: "sale_certified_bill",
          },
          {
            title: "Uncertified Statement",
            path: "/project-management/customer-billing/uncertified-statement",
            activePaths: ["/project-management/customer-billing/uncertified-statement"],
            permissionKey: "uncertified_statement",
          },
        ],
      },
    ],
  },

  {
    title: "Asset Management",
    key: "am",
    icon: Boxes,
    basePath: "/asset-management",
    children: [
      {
        title: "Asset Register",
        path: "/asset-management/asset-register",
        activePaths: ["/asset-management/asset-register"],
        permissionKey: "am_asset_register",
      },
      {
        title: "Site Allocation & Transfer",
        path: "/asset-management/site-allocation",
        activePaths: ["/asset-management/site-allocation"],
        permissionKey: "am_site_allocation",
      },
      {
        title: "Maintenance & Repair",
        path: "/asset-management/maintenance-repair",
        activePaths: ["/asset-management/maintenance-repair"],
        permissionKey: "am_maintenance_repair",
      },
      {
        title: "Rental & Utilization",
        path: "/asset-management/rental-utilization",
        activePaths: ["/asset-management/rental-utilization"],
        permissionKey: "am_rental_utilization",
      },
      {
        title: "Depreciation & Disposal",
        path: "/asset-management/depreciation-disposal",
        activePaths: ["/asset-management/depreciation-disposal"],
        permissionKey: "am_depreciation_disposal",
      },
      {
        title: "Daily Issue & Return",
        path: "/asset-management/daily-issue-return",
        activePaths: ["/asset-management/daily-issue-return"],
        permissionKey: "am_daily_issue_return",
      },
    ],
  },

  {
    title: "Logistics",
    key: "logistics",
    icon: Package,
    basePath: "/logistics",
    children: [
      {
        title: "Transit Request",
        path: "/logistics/transit-request",
        activePaths: ["/logistics/transit-request"],
        permissionKey: "transit_request",
      },
      {
        title: "Delivery Challan",
        path: "/logistics/delivery-challan",
        activePaths: ["/logistics/delivery-challan"],
        permissionKey: "delivery_challan",
      },
      {
        title: "Logistics Bill Register",
        path: "/logistics/bill-register",
        activePaths: ["/logistics/bill-register"],
        permissionKey: "logistics_bill_register",
      },
    ],
  },

  {
    title: "Finance Management",
    key: "fm",
    icon: Wallet,
    basePath: "/finance-management",
    children: [
      {
        title: "Accounts",
        children: [
          {
            title: "Sale",
            path: "/finance-management/account/sale",
            activePaths: ["/finance-management/account/sale"],
            permissionKey: "sale",
          },
          {
            title: "Purchases",
            path: "/finance-management/account/purchases",
            activePaths: ["/finance-management/account/purchases"],
            permissionKey: "purchases",
          },
          {
            title: "Receipt",
            path: "/finance-management/account/receipt",
            activePaths: ["/finance-management/account/receipt"],
            permissionKey: "receipt",
          },
          {
            title: "Payment",
            path: "/finance-management/account/payment",
            activePaths: ["/finance-management/account/payment"],
            permissionKey: "payment",
          },
          {
            title: "Contra",
            path: "/finance-management/account/contra",
            activePaths: ["/finance-management/account/contra"],
            permissionKey: "contra",
          },
          {
            title: "Debit Note",
            path: "/finance-management/account/debit-note",
            activePaths: ["/finance-management/account/debit-note"],
            permissionKey: "debit_note",
          },
          {
            title: "Credit Note",
            path: "/finance-management/account/credit-note",
            activePaths: ["/finance-management/account/credit-note"],
            permissionKey: "credit_note",
          },
          {
            title: "Journal",
            path: "/finance-management/account/journal",
            activePaths: ["/finance-management/account/journal"],
            permissionKey: "journal",
          },
          {
            title: "Petty Cash",
            path: "/finance-management/account/petty-cash",
            activePaths: ["/finance-management/account/petty-cash"],
            permissionKey: "petty_cash",
          },
          {
            title: "Ledger View",
            path: "/finance-management/account/ledger",
            activePaths: ["/finance-management/account/ledger"],
            permissionKey: "ledger_view",
          },
        ],
      },

      {
        title: "Finance",
        children: [
          {
            title: "Profit & Loss",
            path: "/finance-management/report/pnl",
            activePaths: ["/finance-management/report/pnl"],
            permissionKey: "profit_loss",
          },
          {
            title: "Balance Sheet",
            path: "/finance-management/report/balance-sheet",
            activePaths: ["/finance-management/report/balance-sheet"],
            permissionKey: "balance_sheet",
          },
          {
            title: "Cash Flow",
            path: "/finance-management/report/cash-flow",
            activePaths: ["/finance-management/report/cash-flow"],
            permissionKey: "cash_flow",
          },
          {
            title: "GST Reconciliation",
            path: "/finance-management/report/gst",
            activePaths: ["/finance-management/report/gst"],
            permissionKey: "gst_reconciliation",
          },
          {
            title: "Vendor Liability",
            path: "/finance-management/report/vendor-liability",
            activePaths: ["/finance-management/report/vendor-liability"],
            permissionKey: "vendor_liability",
          },
        ],
      },
    ],
  },

  {
    title: "HRMS",
    key: "hr",
    icon: Users,
    basePath: "/hr-management",
    children: [
      {
        title: "Employee Management",
        children: [
          {
            title: "Recruitment",
            path: "/hr-management/employee/recruitment",
            activePaths: ["/hr-management/employee/recruitment"],
            permissionKey: "recruitment",
          },
          {
            title: "Offer Letter",
            path: "/hr-management/employee/offer-letter",
            activePaths: ["/hr-management/employee/offer-letter"],
            permissionKey: "offer_letter",
          },
          {
            title: "Appointment Letter",
            path: "/hr-management/employee/appointment-letter",
            activePaths: ["/hr-management/employee/appointment-letter"],
            permissionKey: "appointment_letter",
          },
          {
            title: "Onboarding",
            path: "/hr-management/employee/onboarding",
            activePaths: ["/hr-management/employee/onboarding"],
            permissionKey: "onboarding",
          },
          {
            title: "Employee Master",
            path: "/hr-management/employee",
            activePaths: ["/hr-management/employee"],
            permissionKey: "employee_management",
          },
          {
            title: "Employee F&F",
            path: "/hr-management/employee/fnf",
            activePaths: ["/hr-management/employee/fnf"],
            permissionKey: "employee_fnf",
          },
        ],
      },
      {
        title: "Administration",
        children: [
          {
            title: "Attendance",
            path: "/hr-management/admin/attendance",
            activePaths: ["/hr-management/admin/attendance"],
            permissionKey: "hr_attendance",
          },
          {
            title: "Leave",
            path: "/hr-management/admin/leave",
            activePaths: ["/hr-management/admin/leave"],
            permissionKey: "leave",
          },
          {
            title: "Payroll",
            path: "/hr-management/admin/payroll",
            activePaths: ["/hr-management/admin/payroll"],
            permissionKey: "payroll",
          },
          {
            title: "Statutory Compliance",
            path: "/hr-management/admin/statutory-compliance",
            activePaths: ["/hr-management/admin/statutory-compliance"],
            permissionKey: "statutory_compliance",
          },
        ],
      },
      {
        title: "IT & Office Asset",
        path: "/hr-management/it-office-asset",
        activePaths: ["/hr-management/it-office-asset"],
        permissionKey: "it_office_asset",
      },
      {
        title: "Travel & Expense",
        path: "/hr-management/travel-expense",
        activePaths: ["/hr-management/travel-expense"],
        permissionKey: "travel_expense",
      },
      {
        title: "Organization Structure",
        path: "/hr-management/org-structure",
        activePaths: ["/hr-management/org-structure"],
        permissionKey: "org_structure",
      },
      {
        title: "Reports & Analytics",
        children: [
          {
            title: "Performance Appraisal",
            path: "/hr-management/reports/performance-appraisal",
            activePaths: ["/hr-management/reports/performance-appraisal"],
            permissionKey: "performance_appraisal",
          },
          {
            title: "Financial KRA",
            path: "/hr-management/reports/fy-kra",
            activePaths: ["/hr-management/reports/fy-kra"],
            permissionKey: "fy_kra",
          },
        ],
      },
      {
        title: "Circular",
        path: "/hr-management/circular",
        activePaths: ["/hr-management/circular"],
        permissionKey: "circular",
      },
      {
        title: "Notice",
        path: "/hr-management/notice",
        activePaths: ["/hr-management/notice"],
        permissionKey: "notice",
      },
    ],
  },

  {
    title: "MIS",
    key: "tm",
    icon: ListTodo,
    basePath: "/task-management",
    children: [
      {
        title: "Task Tracker",
        path: "/task-management/task-tracker",
        activePaths: ["/task-management/task-tracker"],
        permissionKey: "task_tracker",
      },
      {
        title: "Self To do List",
        path: "/task-management/todo",
        activePaths: ["/task-management/todo"],
        permissionKey: "to_do_list",
      },
      {
        title: "Schedule Compliance",
        path: "/task-management/schedule-compliance",
        activePaths: ["/task-management/schedule-compliance"],
        permissionKey: "schedule_compliance",
      },

    ],
  },
];

// for more levels use like this

// {
//   title: "Order",
//       permissionKey: "order",
//     showChildrenInPermission: true,
//
//     children: [
//   {
//     title: "Material Order",
//     permissionKey: "material_order",
//     showChildrenInPermission: true,
//
//     children: [
//       {
//         title: "Local Material Order",
//         path: "/resource-management/procurement/order/material-order/local",
//         permissionKey: "local_material_order",
//       },
//       {
//         title: "Import Material Order",
//         path: "/resource-management/procurement/order/material-order/import",
//         permissionKey: "import_material_order",
//       },
//     ],
//   },
//   {
//     title: "Service Order",
//     path: "/resource-management/procurement/order/service-order",
//     permissionKey: "service_order",
//   },
// ],
// }
