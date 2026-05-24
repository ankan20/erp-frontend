import {
  CheckCircle2,
  RotateCcw,
  XCircle,
  Upload,
  FileText,
} from "lucide-react";

export const WORKFLOW_ACTIONS = {

  SUBMIT: {

    label:
      "Submitted",

    icon:
      Upload,

    color:
      "bg-blue-500",

    border:
      "border-blue-500",

    text:
      "text-blue-700",

    lightBg:
      "bg-blue-50",

    badge:
      "bg-blue-100 text-blue-700",
  },

  APPROVE: {

    label:
      "Approved",

    icon:
      CheckCircle2,

    color:
      "bg-green-500",

    border:
      "border-green-500",

    text:
      "text-green-700",

    lightBg:
      "bg-green-50",

    badge:
      "bg-green-100 text-green-700",
  },

  REBACK: {

    label:
      "Sent Back",

    icon:
      RotateCcw,

    color:
      "bg-yellow-500",

    border:
      "border-yellow-500",

    text:
      "text-yellow-700",

    lightBg:
      "bg-yellow-50",

    badge:
      "bg-yellow-100 text-yellow-700",
  },

  REJECT: {

    label:
      "Rejected",

    icon:
      XCircle,

    color:
      "bg-red-500",

    border:
      "border-red-500",

    text:
      "text-red-700",

    lightBg:
      "bg-red-50",

    badge:
      "bg-red-100 text-red-700",
  },

  DRAFT: {

    label:
      "Draft Saved",

    icon:
      FileText,

    color:
      "bg-gray-500",

    border:
      "border-gray-500",

    text:
      "text-gray-700",

    lightBg:
      "bg-gray-50",

    badge:
      "bg-gray-100 text-gray-700",
  },
  FINAL_APPROVE: {

  label:
    "Final Approved",

  image:
    "/assets/icons/final_approval.svg",

  icon:
    null,

  color:
    "bg-emerald-600",

  border:
    "border-emerald-600",

  text:
    "text-emerald-700",

  lightBg:
    "bg-emerald-50",

  badge:
    "bg-emerald-100 text-emerald-700",
},
};