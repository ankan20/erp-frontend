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

export const sidebarConfig = [
  {
    title: "Settings",
    key: "settings",
    icon: Settings,
    basePath: "/settings",
    children: [
      {
        title: "Company Details",
        path: "/settings/company-details",
        permissionKey: "company_details",
      },
      {
        title: "User ID & Password",
        path: "/settings/user-id-password",
        permissionKey: "user_id_password",
      },
      {
        title: "Project Code",
        path: "/settings/project-code",
        permissionKey: "project_code",
      },
      {
        title: "Roles & User Assignment",
        path: "/settings/role-designation",
        permissionKey: "role_designation",
      },
      {
        title: "Approval Path Line & User",
        path: "/settings/approval-path",
        permissionKey: "approval_path",
      },
    ],
  },

  {
    title: "Master",
    key: "master",
    icon: Database,
    basePath: "/master",
    children: [
      {
        title: "Ledger Code",
        path: "/master/ledger-code",
        permissionKey: "ledger_code",
      },
      {
        title: "Item Code",
        path: "/master/item-code",
        permissionKey: "item_code",
      },
      {
        title: "Asset Code",
        path: "/master/asset-code",
        permissionKey: "asset_code",
      },
      { title: "Unit", path: "/master/unit", permissionKey: "unit" },
      {
        title: "Cost Center Code",
        path: "/master/cc-code",
        permissionKey: "cc_code",
      },
      {
        title: "Category & Group",
        path: "/master/category-group",
        permissionKey: "category_group",
      },
      {
        title: "Terms & Conditions",
        path: "/master/terms-condition",
        permissionKey: "terms_condition",
      }
    ],
  },

  {
    title: "Resource Management",
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
            permissionKey: "indent",
          },
          {
            title: "Enquiry",
            path: "/resource-management/procurement/enquiry",
            permissionKey: "enquiry",
          },
          {
            title:"Order",
            showChildrenInPermission: false,
            children :[
              {
            title: "Material Order",
            path: "/resource-management/procurement/order/material-order",
            // permissionKey: "order",
                permissionKey: "order",

                permissionAccessKey: "material_order",
          },
          {
            title: "Service Order",
            path: "/resource-management/procurement/order/service-order",
            // permissionKey: "service_order", //same as it is assign same material and service order
            // // skipPermission:true,
            permissionKey: "order",

            permissionAccessKey: "service_order",
          },
            ]
          },
        ],
      },
      {
        title: "Material Management",
        children: [
          {
            title: "Goods Received Note",
            path: "/resource-management/material/grn",
            permissionKey: "grn",
          },
          {
            title: "Goods Issue Note",
            path: "/resource-management/material/gin",
            permissionKey: "gin",
          },
          {
            title: "Stock Report",
            path: "/resource-management/material/stock-report",
            permissionKey: "stock_report",
          },
        ],
      },
      {
        title: "Manpower Management",
        children: [
          {
            title: "Manpower ID",
            path: "/resource-management/manpower/id",
            permissionKey: "manpower_id",
          },
          {
            title: "Attendance",
            path: "/resource-management/manpower/attendance",
            permissionKey: "attendance",
          },
        ],
      },
      {
        title: "Machinery Management",
        children: [
          {
            title: "Log Sheet",
            path: "/resource-management/machinery/log-sheet",
            permissionKey: "log_sheet",
          },
          {
            title: "Machinery Stock Summary",
            path: "/resource-management/machinery/stock",
            permissionKey: "machinery_stock",
          },
          {
            title: "Monthly Rent Calculation",
            path: "/resource-management/machinery/rent",
            permissionKey: "machinery_rent",
          },
        ],
      },
      {
        title: "Vendor Billing",
        children: [
          {
            title: "Billing by GRN",
            path: "/resource-management/vendor-billing/grn",
            permissionKey: "vendor_billing_grn",
          },
          {
            title: "Billing by SRN",
            path: "/resource-management/vendor-billing/srn",
            permissionKey: "vendor_billing_srn",
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
        title: "Asset Indent",
        path: "/asset-management/indent",
        permissionKey: "asset_indent",
      },
      {
        title: "Allocation",
        path: "/asset-management/allocation",
        permissionKey: "allocation",
      },
      {
        title: "Asset ID Creation",
        path: "/asset-management/asset-id",
        permissionKey: "asset_id",
      },
      {
        title: "Asset Stock Report",
        path: "/asset-management/stock-report",
        permissionKey: "asset_stock_report",
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
        title: "Order & BOQ",
        path: "/project-management/order-boq",
        permissionKey: "order_boq",
      },
      {
        title: "Budget & Costing",
        path: "/project-management/budget",
        permissionKey: "budget_costing",
      },

      {
        title: "Planning",
        children: [
          {
            title: "Monthly Planning",
            path: "/project-management/planning/monthly",
            permissionKey: "monthly_planning",
          },
          {
            title: "Daily Progress Report",
            path: "/project-management/planning/dpr",
            permissionKey: "dpr",
          },
          {
            title: "Reconciliation",
            path: "/project-management/planning/reconciliation",
            permissionKey: "reconciliation",
          },
        ],
      },

      {
        title: "Customer Billing",
        children: [
          {
            title: "Certified Bill",
            path: "/project-management/customer-billing/certified",
            permissionKey: "certified_bill",
          },
          {
            title: "Hold / Amend Pending",
            path: "/project-management/customer-billing/pending",
            permissionKey: "hold_pending",
          },
          {
            title: "Work In Progress",
            path: "/project-management/customer-billing/wip",
            permissionKey: "wip",
          },
        ],
      },

      {
        title: "Register",
        children: [
          {
            title: "Drawing Register",
            path: "/project-management/register/drawing",
            permissionKey: "drawing_register",
          },
          {
            title: "BBS Register",
            path: "/project-management/register/bbs",
            permissionKey: "bbs",
          },
          {
            title: "Concrete Register",
            path: "/project-management/register/concrete",
            permissionKey: "concrete_register",
          },
        ],
      },

      {
        title: "Tool Kit",
        children: [
          {
            title: "BBS",
            path: "/project-management/toolkit/bbs",
            permissionKey: "bbs",
          },
          {
            title: "Measurement",
            path: "/project-management/toolkit/measurement",
            permissionKey: "measurement",
          },
          {
            title: "Abstract",
            path: "/project-management/toolkit/abstract",
            permissionKey: "abstract",
          },
          {
            title: "C. Abstract",
            path: "/project-management/toolkit/c-abstract",
            permissionKey: "c_abstract",
          },
        ],
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
        title: "Account",
        children: [
          {
            title: "Sale",
            path: "/finance-management/account/sale",
            permissionKey: "sale",
          },
          {
            title: "Purchases",
            path: "/finance-management/account/purchases",
            permissionKey: "purchases",
          },
          {
            title: "Receipt",
            path: "/finance-management/account/receipt",
            permissionKey: "receipt",
          },
          {
            title: "Payment",
            path: "/finance-management/account/payment",
            permissionKey: "payment",
          },
          {
            title: "Contra",
            path: "/finance-management/account/contra",
            permissionKey: "contra",
          },
          {
            title: "Debit Note",
            path: "/finance-management/account/debit-note",
            permissionKey: "debit_note",
          },
          {
            title: "Credit Note",
            path: "/finance-management/account/credit-note",
            permissionKey: "credit_note",
          },
          {
            title: "Journal",
            path: "/finance-management/account/journal",
            permissionKey: "journal",
          },
        ],
      },

      {
        title: "Finance Report",
        children: [
          {
            title: "Profit & Loss",
            path: "/finance-management/report/pnl",
            permissionKey: "pnl",
          },
          {
            title: "Balance Sheet",
            path: "/finance-management/report/balance-sheet",
            permissionKey: "balance_sheet",
          },
          {
            title: "Cash Flow",
            path: "/finance-management/report/cash-flow",
            permissionKey: "cash_flow",
          },
          {
            title: "GST Reconciliation",
            path: "/finance-management/report/gst",
            permissionKey: "gst_reconciliation",
          },
          {
            title: "Vendor Liability",
            path: "/finance-management/report/vendor-liability",
            permissionKey: "vendor_liability",
          },
          {
            title: "Ledger View",
            path: "/finance-management/report/ledger",
            permissionKey: "ledger_view",
          },
        ],
      },
    ],
  },

  {
    title: "HR Management",
    key: "hr",
    icon: Users,
    basePath: "/hr-management",
    children: [
      {
        title: "Employee Management",
        path: "/hr-management/employee",
        permissionKey: "employee_management",
      },
      {
        title: "Administration",
        path: "/hr-management/admin",
        permissionKey: "administration",
      },
      {
        title: "Circular",
        path: "/hr-management/circular",
        permissionKey: "circular",
      },
      {
        title: "Notice",
        path: "/hr-management/notice",
        permissionKey: "notice",
      },
    ],
  },

  {
    title: "Task Management",
    key: "tm",
    icon: ListTodo,
    basePath: "/task-management",
    children: [
      {
        title: "New Task",
        path: "/task-management/new",
        permissionKey: "new_task",
      },
      {
        title: "Closing Task",
        path: "/task-management/closing",
        permissionKey: "closing_task",
      },
      {
        title: "To Do List",
        path: "/task-management/todo",
        permissionKey: "todo_list",
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
