"use client";

import { FileSearch, Lock } from "lucide-react";
import { DOC_ICON } from "./wbUtils";

// Icon for a flow node (lock for restricted documents).
export default function DocIcon({ node, docType, className }) {
  const Icon = node?.restricted ? Lock : DOC_ICON[node?.docType || docType] || FileSearch;
  return <Icon className={className} />;
}
