import { NextResponse } from "next/server";
import { getSessionProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

function csvCell(v: unknown): string {
  const s =
    v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "no data\n";
  const cols = Object.keys(rows[0]);
  return [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n") + "\n";
}

export async function GET(request: Request) {
  const session = await getSessionProfile();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (session.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const type = url.searchParams.get("type") ?? "orders";
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  const fromIso = from && /^\d{4}-\d{2}-\d{2}$/.test(from) ? `${from}T00:00:00+07:00` : null;
  const toIso = to && /^\d{4}-\d{2}-\d{2}$/.test(to) ? `${to}T23:59:59+07:00` : null;

  const supabase = await createClient();
  let rows: Record<string, unknown>[] = [];

  const range = <T extends { gte: (c: string, v: string) => T; lte: (c: string, v: string) => T }>(
    q: T,
  ): T => {
    let r = q;
    if (fromIso) r = r.gte("created_at", fromIso);
    if (toIso) r = r.lte("created_at", toIso);
    return r;
  };

  if (type === "orders") {
    const { data } = await range(
      supabase
        .from("orders")
        .select("order_number,status,subtotal,discount,total,created_at,vendors(code),profiles(full_name)")
        .order("created_at", { ascending: false })
        .limit(20000),
    );
    rows = (data ?? []).map((o: any) => ({
      order_number: o.order_number,
      status: o.status,
      vendor: (Array.isArray(o.vendors) ? o.vendors[0]?.code : o.vendors?.code) ?? "",
      customer: (Array.isArray(o.profiles) ? o.profiles[0]?.full_name : o.profiles?.full_name) ?? "",
      subtotal: o.subtotal,
      discount: o.discount,
      total: o.total,
      created_at: o.created_at,
    }));
  } else if (type === "payments") {
    const { data } = await range(
      supabase
        .from("payments")
        .select("provider,provider_order_id,status,payment_type,gross_amount,paid_at,created_at")
        .order("created_at", { ascending: false })
        .limit(20000),
    );
    rows = data ?? [];
  } else if (type === "inventory") {
    const { data } = await range(
      supabase
        .from("inventory_movements")
        .select("type,quantity,note,created_at,inventories(vendors(code),ingredients(name,unit))")
        .order("created_at", { ascending: false })
        .limit(20000),
    );
    rows = (data ?? []).map((m: any) => {
      const inv = Array.isArray(m.inventories) ? m.inventories[0] : m.inventories;
      const v = Array.isArray(inv?.vendors) ? inv.vendors[0] : inv?.vendors;
      const i = Array.isArray(inv?.ingredients) ? inv.ingredients[0] : inv?.ingredients;
      return {
        vendor: v?.code ?? "",
        ingredient: i?.name ?? "",
        unit: i?.unit ?? "",
        type: m.type,
        quantity: m.quantity,
        note: m.note,
        created_at: m.created_at,
      };
    });
  } else if (type === "audit") {
    const { data } = await range(
      supabase
        .from("audit_logs")
        .select("action,entity,entity_id,metadata,created_at")
        .order("created_at", { ascending: false })
        .limit(20000),
    );
    rows = data ?? [];
  } else {
    return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="haffye-${type}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

