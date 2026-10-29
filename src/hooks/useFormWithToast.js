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
      const otherFields = [];

      for (const [field, err] of Object.entries(errors)) {
        const msg = err?.message || "";
        if (DATE_KEYWORDS.test(field)) {
          // Show each date error as its own toast so the message is readable
          dateErrors.push(msg);
        } else {
          otherFields.push(field);
        }
      }

      // Toast date errors first — they need a specific message
      dateErrors.forEach((msg) => toast.error(msg, { duration: 5000 }));

      // Toast remaining required-field errors in one message
      if (otherFields.length) {
        toast.error(`Please fill required fields: ${otherFields.join(", ")}`);
      }

      onInvalid?.(errors);
    });

  return { ...form, handleSubmit };
}
