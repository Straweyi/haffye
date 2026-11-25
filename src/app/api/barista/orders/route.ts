import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { getBaristaOrders, getMyVendor } from "@/lib/queries/barista";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "barista") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const vendor = await getMyVendor(session.id);
  if (!vendor) {
    return NextResponse.json({ vendor: null, orders: [] }, { headers: { "Cache-Control": "no-store" } });
  }

  const orders = await getBaristaOrders(vendor.id);
  return NextResponse.json(
    { vendor, orders },
    { headers: { "Cache-Control": "no-store, max-age=0" } },
  );
}
