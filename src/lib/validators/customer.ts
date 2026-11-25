import { z } from "zod";

export const locationPrefsSchema = z.object({
  default_latitude: z.number().min(-90).max(90),
  default_longitude: z.number().min(-180).max(180),
  search_radius_km: z.number().min(0.5).max(50),
});

export const updateProfileSchema = z.object({
  full_name: z.string().trim().min(2, "Name must be at least 2 characters").max(80),
  phone: z
    .string()
    .trim()
    .regex(/^(\+62|62|0)8[0-9]{7,12}$/, "Enter a valid Indonesian phone number")
    .optional()
    .or(z.literal("")),
  search_radius_km: z.coerce.number().min(0.5).max(50),
});

export const createReviewSchema = z.object({
  product_id: z.string().uuid(),
  order_id: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional().or(z.literal("")),
});

export type LocationPrefsInput = z.infer<typeof locationPrefsSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateReviewInput = z.infer<typeof createReviewSchema>;
