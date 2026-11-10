"use client";

import { useForm } from "react-hook-form";
import { toast } from "sonner";

const DATE_KEYWORDS = /date|Date/;

// Recursively collect {field, message} from nested RHF error objects / arrays
function flattenErrors(node, path = "") {
  const out = [];
  if (!node || typeof node !== "object") return out;

  if (Array.isArray(node)) {
    node.forEach((item, i) => {
      if (item) out.push(...flattenErrors(item, `${path}[${i}]`));
    });
    return out;
  }

  if (typeof node.message === "string") {
    out.push({ field: path, message: node.message });
    return out;
  }

  for (const [key, val] of Object.entries(node)) {
    out.push(...flattenErrors(val, path ? `${path}.${key}` : key));
  }
  return out;
}

export function useFormWithToast(options) {
  const form = useForm(options);

  const handleSubmit = (onValid, onInvalid) =>
    form.handleSubmit(onValid, (errors) => {
      const dateErrors    = [];
      const specificErrors = [];
      const missingFields  = [];

      for (const { field, message } of flattenErrors(errors)) {
        if (DATE_KEYWORDS.test(field)) {
          dateErrors.push(message);
        } else if (!message || message === "Required") {
          missingFields.push(field);
        } else {
          specificErrors.push(message);
        }
      }

      dateErrors.forEach((msg)    => toast.error(msg, { duration: 5000 }));
      specificErrors.forEach((msg) => toast.error(msg, { duration: 5000 }));
      if (missingFields.length) {
        toast.error(`Please fill required fields: ${missingFields.join(", ")}`);
      }

      onInvalid?.(errors);
    });

  return { ...form, handleSubmit };
}
