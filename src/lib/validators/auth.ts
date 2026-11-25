import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const registerSchema = loginSchema.extend({
  full_name: z.string().trim().min(2, "Enter your name").max(80),
  phone: z
    .string().trim()
    .regex(/^(\+62|62|0)8[0-9]{7,12}$/, "Enter a valid Indonesian phone number")
    .optional().or(z.literal("")),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
