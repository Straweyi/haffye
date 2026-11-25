import { z } from "zod";

const uuid = z.string().uuid();
const optionalText = z.string().trim().max(500).optional().or(z.literal(""));
const money = z.coerce.number().min(0).max(100_000_000);
const csv = z.string().trim().max(300).optional().or(z.literal(""));

export const createBaristaSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
  full_name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+62|62|0)8[0-9]{7,12}$/, "Enter a valid Indonesian phone number")
    .optional()
    .or(z.literal("")),
  vendorId: uuid.nullable().optional(),
});

export const setActiveSchema = z.object({ profileId: uuid, isActive: z.boolean() });

export const vendorSchema = z.object({
  id: uuid.optional(),
  code: z
    .string()
    .trim()
    .min(3)
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Code: letters, numbers, dash"),
  name: z.string().trim().min(2).max(80),
  vehicle_label: optionalText,
  description: optionalText,
  barista_id: uuid.nullable().optional(),
});

export const vendorActiveSchema = z.object({ id: uuid, isActive: z.boolean() });

export const categorySchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2).max(50),
  sort_order: z.coerce.number().int().min(0).max(999).default(0),
  is_active: z.boolean().default(true),
});

export const productSchema = z.object({
  id: uuid.optional(),
  category_id: uuid.nullable().optional(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).default(""),
  image_url: z.string().trim().url().max(500).optional().or(z.literal("")),
  base_price: money,
  sweetness_options: csv,
  ice_options: csv,
  is_available: z.boolean().default(true),
});

export const variantSchema = z.object({
  product_id: uuid,
  name: z.string().trim().min(1).max(40),
  price_delta: z.coerce.number().min(-1_000_000).max(1_000_000),
  is_default: z.boolean().default(false),
});

export const addonSchema = z.object({
  product_id: uuid,
  name: z.string().trim().min(1).max(40),
  price: money,
});

export const idSchema = z.object({ id: uuid });

export const ingredientSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2).max(60),
  unit: z.string().trim().min(1).max(10),
  low_stock_threshold: z.coerce.number().min(0).max(10_000_000),
});

export const recipeSchema = z.object({
  product_id: uuid,
  ingredient_id: uuid,
  quantity: z.coerce.number().gt(0).max(1_000_000),
});

export const recipeDeleteSchema = z.object({ product_id: uuid, ingredient_id: uuid });

export const allocationSchema = z.object({
  vendor_id: uuid,
  ingredient_id: uuid,
  type: z.enum(["STOCK_IN", "STOCK_OUT", "ADJUSTMENT"]),
  quantity: z.coerce
    .number()
    .refine((v) => v !== 0 && Number.isFinite(v), "Quantity must not be zero"),
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

export const voucherSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(3)
    .max(20)
    .regex(/^[A-Z0-9]+$/, "Letters and numbers only"),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.coerce.number().gt(0).max(100_000_000),
  min_order: money.default(0),
  max_discount: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
  points_cost: z.coerce.number().int().min(0).max(100000).default(0),
  usage_limit: z.coerce.number().int().min(1).max(1_000_000).nullable().optional(),
  valid_until: z.string().trim().optional().or(z.literal("")),
});

export const voucherToggleSchema = z.object({ id: uuid, isActive: z.boolean() });

export const adjustPointsSchema = z.object({
  customerId: uuid,
  points: z.coerce
    .number()
    .int()
    .refine((v) => v !== 0, "Points must not be zero")
    .refine((v) => Math.abs(v) <= 100000),
  reason: z.string().trim().min(3).max(100),
});

