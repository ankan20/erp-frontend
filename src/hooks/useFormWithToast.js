"use client";

import { useForm } from "react-hook-form";
import { toast } from "sonner";

// Keywords that indicate a field is a date field
const DATE_KEYWORDS = /date|Date/;

export function useFormWithToast(options) {
  const form = useForm(options);

  const handleSubmit = (onValid, onInvalid) =>
    form.handleSubmit(onValid, (errors) => {
      const dateErrors = [];
      const specificErrors = [];
      const missingFields = [];

      for (const [field, err] of Object.entries(errors)) {
        const msg = err?.message || "";
        if (DATE_KEYWORDS.test(field)) {
          // Show each date error as its own toast so the message is readable
          dateErrors.push(msg);
        } else if (!msg || msg === "Required") {
          // Truly blank required field — group by field name
          missingFields.push(field);
        } else {
          // Has a specific validation message (format error, etc.) — show as-is
          specificErrors.push(msg);
        }
      }

      dateErrors.forEach((msg) => toast.error(msg, { duration: 5000 }));
      specificErrors.forEach((msg) => toast.error(msg, { duration: 5000 }));
      if (missingFields.length) {
        toast.error(`Please fill required fields: ${missingFields.join(", ")}`);
      }

      onInvalid?.(errors);
    });

  return { ...form, handleSubmit };
}
