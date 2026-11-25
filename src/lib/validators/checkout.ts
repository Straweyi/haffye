import { z } from "zod";

export const checkoutSchema = z.object({
  vendorId: z.string().uuid(),
  idempotencyKey: z.string().min(8).max(64),
  note: z.string().trim().max(200).optional().or(z.literal("")),
  customerVoucherId: z.string().uuid().nullable().optional(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        variantId: z.string().uuid().nullable(),
        sweetness: z.string().max(40).nullable(),
        ice: z.string().max(40).nullable(),
        addonIds: z.array(z.string().uuid()).max(10),
        quantity: z.number().int().min(1).max(20),
      }),
    )
    .min(1)
    .max(30),
});

export const redeemVoucherSchema = z.object({ voucherId: z.string().uuid() });
export const orderIdSchema = z.object({ orderId: z.string().uuid() });

export type CheckoutInput = z.infer<typeof checkoutSchema>;
