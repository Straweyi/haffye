import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { getOperationalVendors } from "@/lib/queries/customer";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionProfile();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vendors = await getOperationalVendors();
  return NextResponse.json(
    { vendors, fetchedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
