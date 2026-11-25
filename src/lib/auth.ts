import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeForRole, type Role } from "@/lib/roles";

export type SessionProfile = {
  id: string;
  email: string | undefined;
  role: Role;
  full_name: string;
};

export async function getSessionProfile(): Promise<SessionProfile | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles").select("role,full_name,is_active").eq("id", user.id).single();
  if (!profile || !profile.is_active) return null;
  return { id: user.id, email: user.email, role: profile.role as Role, full_name: profile.full_name };
}

/** Server-side authorization for pages, actions, and route handlers. */
export async function requireRole(role: Role): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.role !== role) redirect(homeForRole(session.role));
  return session;
}
