import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("id,title,body,data,read_at,created_at")
    .eq("user_id", session.id)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const notifications = data ?? [];
  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return NextResponse.json(
    { notifications, unreadCount },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}

export async function PATCH(request: Request) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { id?: string; markAll?: boolean } = {};
  try {
    body = (await request.json()) as { id?: string; markAll?: boolean };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  if (body.markAll) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: nowIso })
      .eq("user_id", session.id)
      .is("read_at", null);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.id) {
    const { error } = await supabase
      .from("notifications")
      .update({ read_at: nowIso })
      .eq("id", body.id)
      .eq("user_id", session.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Provide id or markAll" }, { status: 400 });
}
