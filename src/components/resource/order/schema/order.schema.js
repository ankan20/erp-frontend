import { z } from "zod";

const itemSchema = z.object({

  indentItemId:
    z.any(),

  itemCode:
    z.string(),

  itemName:
    z.string(),

  unit:
    z.string()
      .optional(),

  qty:
    z.coerce
      .number({

        required_error:
          "Qty is required",
      })

      .min(
        0.001,
        "Qty must be greater than 0",
      ),

  rate:
    z.coerce
      .number({

        required_error:
          "Rate is required",
      })

      .min(
        0,
        "Rate must be valid",
      ),

  gstPercent:
    z.coerce
      .number({

        required_error:
          "GST is required",
      })

      .min(
        0,
      ),

  amount:
    z.number()
      .optional(),

  gstAmount:
    z.number()
      .optional(),

  location:
    z.string()
      .optional(),

  note:
    z.string()
      .optional(),
});

const termSchema =
  z.object({

    termId:
      z.any(),

    header:
      z.string(),

    subHeader:
      z.string(),

    description:
      z.string(),
  });

export const orderSchema =
  z.object({

    categoryCode:
      z.string({

        required_error:
          "Category is required",
      })

      .min(
        1,
        "Category is required",
      ),

    subCategoryCode:
      z.string({

        required_error:
          "Sub Category is required",
      })

      .min(
        1,
        "Sub Category is required",
      ),

    vendorId:
      z.any({

        required_error:
          "Party Name is required",
      }),

    orderDate:
      z.string({

        required_error:
          "Order Date is required",
      }),

    validityDate:
      z.string({

        required_error:
          "Order Validity is required",
      }),

    billingAddress:
      z.string({

        required_error:
          "Billing Address is required",
      })

      .min(
        1,
        "Billing Address is required",
      ),

    shippingAddress:
      z.string({

        required_error:
          "Shipping Address is required",
      })

      .min(
        1,
        "Shipping Address is required",
      ),

    orderMessage:
      z.string()
      .optional(),

    gstType:
      z.enum([
        "IGST",
        "CGST_SGST",
      ])
      .optional(),

    items:
      z.array(
        itemSchema,
      )

      .min(
        1,
        "At least one item is required",
      ),

    terms:
      z.array(
        termSchema,
      )

      .optional(),

    orderFile:
      z.any()
      .optional(),
  })

  .superRefine(
    (
      data,
      ctx,
    ) => {

      // FILE VALIDATION

      const file =
        data.orderFile;

      if (
        file &&
        file instanceof File
      ) {

        // ONLY PDF

        if (
          file.type !==
          "application/pdf"
        ) {

          ctx.addIssue({

            code:
              z.ZodIssueCode
                .custom,

            path: [
              "orderFile",
            ],

            message:
              "Only PDF file allowed",
          });
        }

        // MAX 5MB

        if (
          file.size >
          5 * 1024 * 1024
        ) {

          ctx.addIssue({

            code:
              z.ZodIssueCode
                .custom,

            path: [
              "orderFile",
            ],

            message:
              "File size must be below 5MB",
          });
        }
      }

      // GST TYPE VALIDATION

      if (
        !data.gstType
      ) {

        ctx.addIssue({

          code:
            z.ZodIssueCode
              .custom,

          path: [
            "gstType",
          ],

          message:
            "Select GST Type",
        });
      }
    },
  );