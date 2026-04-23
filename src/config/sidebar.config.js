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
    key:"settings",
    icon: Settings,
    basePath: "/settings",
    children: [
      { title: "Company Details", path: "/settings/company-details" },
      {
        title: "User ID & Password",
        path: "/settings/user-id-password",
      },
      {
        title: "Project Code",
        path: "/settings/project-code",
      },
      { title: "Roles & Designation", path: "/settings/roles" },
      { title: "Rights & Access", path: "/settings/rights" },
      { title: "Approval Path Line", path: "/settings/approval-path" },
    ],
  },

  {
    title: "Master",
    key:"master",
    icon: Database,
    basePath: "/master",
    children: [
      { title: "Vendor Code", path: "/master/vendor-code" },
      { title: "Item Code", path: "/master/item-code" },
      { title: "Asset Code", path: "/master/asset-code" },
      { title: "Unit", path: "/master/unit" },
      { title: "Cost Center Code", path: "/master/cost-center" },
      { title: "Category", path: "/master/category" },
    ],
  },

  {
    title: "Resource Management",
    key:"hr",
    icon: Package,
    basePath: "/resource-management",
    children: [
      {
        title: "Procurement",
        children: [
          { title: "Indent", path: "/resource-management/procurement/indent" },
          { title: "Enquiry", path: "/resource-management/procurement/enquiry" },
          { title: "Order", path: "/resource-management/procurement/order" },
        ],
      },
      {
        title: "Material Management",
        children: [
          {
            title: "Goods Received Note",
            path: "/resource-management/material/grn",
          },
          {
            title: "Goods Issue Note",
            path: "/resource-management/material/gin",
          },
          {
            title: "Stock Report",
            path: "/resource-management/material/stock-report",
          },
        ],
      },
      {
        title: "Manpower Management",
        children: [
          {
            title: "Manpower ID",
            path: "/resource-management/manpower/id",
          },
          {
            title: "Attendance",
            path: "/resource-management/manpower/attendance",
          },
        ],
      },
      {
        title: "Machinery Management",
        children: [
          {
            title: "Log Sheet",
            path: "/resource-management/machinery/log-sheet",
          },
          {
            title: "Machinery Stock Summary",
            path: "/resource-management/machinery/stock",
          },
          {
            title: "Monthly Rent Calculation",
            path: "/resource-management/machinery/rent",
          },
        ],
      },
      {
        title: "Vendor Billing",
        children: [
          {
            title: "Billing by GRN",
            path: "/resource-management/vendor-billing/grn",
          },
          {
            title: "Billing by SRN",
            path: "/resource-management/vendor-billing/srn",
          },
        ],
      },
    ],
  },

  {
    title: "Asset Management",
    key:"am",
    icon: Boxes,
    basePath: "/asset-management",
    children: [
      { title: "Asset Indent", path: "/asset-management/indent" },
      { title: "Allocation", path: "/asset-management/allocation" },
      { title: "Asset ID Creation", path: "/asset-management/asset-id" },
      { title: "Asset Stock Report", path: "/asset-management/stock-report" },
    ],
  },

  {
    title: "Project Management",
    key:"pm",
    icon: Briefcase,
    basePath: "/project-management",
    children: [
      { title: "Order & BOQ", path: "/project-management/order-boq" },
      { title: "Budget & Costing", path: "/project-management/budget" },

      {
        title: "Planning",
        children: [
          {
            title: "Monthly Planning",
            path: "/project-management/planning/monthly",
          },
          {
            title: "Daily Progress Report",
            path: "/project-management/planning/dpr",
          },
          {
            title: "Reconciliation",
            path: "/project-management/planning/reconciliation",
          },
        ],
      },

      {
        title: "Customer Billing",
        children: [
          {
            title: "Certified Bill",
            path: "/project-management/customer-billing/certified",
          },
          {
            title: "Hold / Amend Pending",
            path: "/project-management/customer-billing/pending",
          },
          {
            title: "Work In Progress",
            path: "/project-management/customer-billing/wip",
          },
        ],
      },

      {
        title: "Register",
        children: [
          {
            title: "Drawing Register",
            path: "/project-management/register/drawing",
          },
          {
            title: "BBS Register",
            path: "/project-management/register/bbs",
          },
          {
            title: "Concrete Register",
            path: "/project-management/register/concrete",
          },
        ],
      },

      {
        title: "Tool Kit",
        children: [
          { title: "BBS", path: "/project-management/toolkit/bbs" },
          {
            title: "Measurement",
            path: "/project-management/toolkit/measurement",
          },
          {
            title: "Abstract",
            path: "/project-management/toolkit/abstract",
          },
          {
            title: "C. Abstract",
            path: "/project-management/toolkit/c-abstract",
          },
        ],
      },
    ],
  },

  {
    title: "Finance Management",
    key:"fm",
    icon: Wallet,
    basePath: "/finance-management",
    children: [
      {
        title: "Account",
        children: [
          { title: "Sale", path: "/finance-management/account/sale" },
          { title: "Purchases", path: "/finance-management/account/purchases" },
          { title: "Receipt", path: "/finance-management/account/receipt" },
          { title: "Payment", path: "/finance-management/account/payment" },
          { title: "Contra", path: "/finance-management/account/contra" },
          { title: "Debit Note", path: "/finance-management/account/debit-note" },
          {
            title: "Credit Note",
            path: "/finance-management/account/credit-note",
          },
          { title: "Journal", path: "/finance-management/account/journal" },
        ],
      },

      {
        title: "Finance Report",
        children: [
          {
            title: "Profit & Loss",
            path: "/finance-management/report/pnl",
          },
          {
            title: "Balance Sheet",
            path: "/finance-management/report/balance-sheet",
          },
          {
            title: "Cash Flow",
            path: "/finance-management/report/cash-flow",
          },
          {
            title: "GST Reconciliation",
            path: "/finance-management/report/gst",
          },
          {
            title: "Vendor Liability",
            path: "/finance-management/report/vendor-liability",
          },
          {
            title: "Ledger View",
            path: "/finance-management/report/ledger",
          },
        ],
      },
    ],
  },

  {
    title: "HR Management",
    key:"hr",
    icon: Users,
    basePath: "/hr-management",
    children: [
      { title: "Employee Management", path: "/hr-management/employee" },
      { title: "Administration", path: "/hr-management/admin" },
      { title: "Circular", path: "/hr-management/circular" },
      { title: "Notice", path: "/hr-management/notice" },
    ],
  },

  {
    title: "Task Management",
    key:"tm",
    icon: ListTodo,
    basePath: "/task-management",
    children: [
      { title: "New Task", path: "/task-management/new" },
      { title: "Closing Task", path: "/task-management/closing" },
      { title: "To Do List", path: "/task-management/todo" },
    ],
  },
];