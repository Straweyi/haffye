import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { getVendorsAdmin } from "@/lib/queries/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { vendors } = await getVendorsAdmin();
  return NextResponse.json(
    { vendors },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
