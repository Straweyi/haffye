"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, type Role } from "@/lib/roles";
import { loginSchema, registerSchema } from "@/lib/validators/auth";

export type ActionResult = { error?: string; message?: string };

function safeNext(next: unknown): string | null {
  // Only same-origin relative paths (open-redirect protection)
  return typeof next === "string" && /^\/[a-zA-Z0-9\-_/]*$/.test(next) ? next : null;
}

export async function loginAction(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "Invalid email or password" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles").select("role,is_active").eq("id", data.user.id).maybeSingle();
  if (profileError) {
    await supabase.auth.signOut();
    return { error: `Gagal membaca profil: ${profileError.message}` };
  }
  if (!profile) {
    await supabase.auth.signOut();
    return { error: "Profil tidak ditemukan untuk akun ini (RLS atau data profil)." };
  }
  if (!profile.is_active) {
    await supabase.auth.signOut();
    return { error: "This account is disabled" };
  }
  const home = homeForRole(profile.role as Role);
  const target = safeNext(next);
  redirect(target && target.startsWith(home) ? target : home);
}

export async function registerAction(input: unknown): Promise<ActionResult> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name, phone: parsed.data.phone || null },
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/login`,
    },
  });
  if (error) return { error: error.message };
  // Public sign-up always creates a CUSTOMER (DB trigger). Baristas/admins are promoted by an admin.
  if (!data.session) return { message: "Check your email to confirm your account, then log in." };
  redirect("/customer");
}

export async function logoutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
