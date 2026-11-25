import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { locationUpdateSchema } from "@/lib/validators/barista";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (session.role !== "barista") {
    return NextResponse.json({ error: "Forbidden: barista role required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = locationUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 });
  }

  const maxAccuracy = Number(process.env.NEXT_PUBLIC_GPS_MAX_ACCURACY_METERS) || 100;
  if (parsed.data.accuracy > maxAccuracy) {
    return NextResponse.json(
      {
        error: `GPS accuracy (${Math.round(parsed.data.accuracy)}m) exceeds ${maxAccuracy}m threshold.`,
      },
      { status: 422 },
    );
  }

  const supabase = await createClient();

  // Derive vendor strictly from authenticated barista (never trust client vendor_id)
  const { data: vendor, error: vErr } = await supabase
    .from("vendors")
    .select("id,status,is_active")
    .eq("barista_id", session.id)
    .maybeSingle();

  if (vErr || !vendor) {
    return NextResponse.json({ error: "No vendor unit assigned to your account" }, { status: 404 });
  }
  if (!vendor.is_active || (vendor.status !== "ACTIVE" && vendor.status !== "BUSY")) {
    return NextResponse.json(
      { error: "Activate operational status (ACTIVE or BUSY) before broadcasting GPS" },
      { status: 409 },
    );
  }

  // Serverless rate limit: minimum 3s between persisted location updates
  const { data: existingLoc } = await supabase
    .from("vendor_locations")
    .select("updated_at")
    .eq("vendor_id", vendor.id)
    .maybeSingle();

  if (existingLoc?.updated_at) {
    const elapsedMs = Date.now() - new Date(existingLoc.updated_at).getTime();
    if (elapsedMs < 3000) {
      return NextResponse.json(
        { error: "Location updates are throttled (min 3s interval)" },
        { status: 429 },
      );
    }
  }

  const { data: saved, error: upsertErr } = await supabase
    .from("vendor_locations")
    .upsert(
      {
        vendor_id: vendor.id,
        latitude: parsed.data.latitude,
        longitude: parsed.data.longitude,
        accuracy: parsed.data.accuracy,
        heading: parsed.data.heading ?? null,
        speed: parsed.data.speed ?? null,
      },
      { onConflict: "vendor_id" },
    )
    .select("vendor_id,latitude,longitude,accuracy,heading,speed,updated_at")
    .single();

  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, location: saved });
}
