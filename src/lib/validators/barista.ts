import { z } from "zod";

export const vendorStatusSchema = z.enum(["OFFLINE", "ACTIVE", "BUSY", "PAUSED"]);

export const locationUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(10000),
  heading: z.number().min(0).max(360).nullable().optional(),
  speed: z.number().min(0).max(200).nullable().optional(),
});

export const orderTransitionSchema = z.object({
  orderId: z.string().uuid(),
  nextStatus: z.enum([
    "ACCEPTED",
    "PREPARING",
    "READY_FOR_PICKUP",
    "COMPLETED",
    "REJECTED",
  ]),
});

export const toggleProductSchema = z.object({
  productId: z.string().uuid(),
  isAvailable: z.boolean(),
});

export const stockMovementSchema = z.object({
  ingredientId: z.string().uuid(),
  type: z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]),
  quantity: z.coerce.number().refine((v) => v !== 0 && Number.isFinite(v), {
    message: "Quantity must not be zero",
  }),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export const baristaProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+62|62|0)8[0-9]{7,12}$/, "Enter a valid Indonesian phone number")
    .optional()
    .or(z.literal("")),
});
