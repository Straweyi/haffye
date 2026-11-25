import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getOrderAdmin } from "@/lib/queries/admin";
import { formatDateTime, formatIDR } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { PageHeader, Section, StatusBadge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const order = await getOrderAdmin(id);
  if (!order) notFound();

  const vendor = Array.isArray(order.vendors) ? order.vendors[0] : order.vendors;
  const customer = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
  const items = (order.order_items ?? []) as any[];
  const payments = (order.payments ?? []) as any[];

  return (
    <div className="space-y-5">
      <Link
        href="/admin/orders"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-coffee hover:text-espresso"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Link>

      <PageHeader
        title={order.order_number}
        subtitle={`Placed ${formatDateTime(order.created_at)}`}
        actions={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Order & Customer">
          <div className="space-y-2 text-xs">
            <p>
              <b className="text-espresso">Customer:</b> {customer?.full_name || "Customer"}{" "}
              {customer?.phone ? `(${customer.phone})` : ""}
            </p>
            <p>
              <b className="text-espresso">Assigned Cart:</b> {vendor?.code} · {vendor?.name}
            </p>
            <p>
              <b className="text-espresso">Inventory deducted:</b>{" "}
              <Badge variant={order.inventory_deducted ? "active" : "outline"}>
                {order.inventory_deducted ? "Yes" : "No"}
              </Badge>
            </p>
            {order.note && (
              <p className="rounded-xl bg-cream p-3 text-espresso">
                <b>Note:</b> {order.note}
              </p>
            )}
          </div>
        </Section>

        <Section title="Payments">
          {payments.length === 0 ? (
            <p className="text-xs text-coffee">No payment records.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {payments.map((p) => (
                <div key={p.provider_order_id} className="rounded-xl border border-coffee/10 p-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-espresso">{p.provider_order_id}</span>
                    <StatusBadge status={p.status} />
                  </div>
                  <p className="mt-1 text-coffee">
                    {p.provider} {p.payment_type ? `· ${p.payment_type}` : ""} ·{" "}
                    {formatIDR(Number(p.gross_amount))}
                  </p>
                  <p className="text-[11px] text-coffee">
                    Paid at: {formatDateTime(p.paid_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <Section title="Order Items (Historical Snapshot)">
        <div className="divide-y divide-coffee/10">
          {items.map((it) => {
            const addons = Array.isArray(it.addons)
              ? (it.addons as { name: string }[]).map((a) => `+${a.name}`)
              : [];
            return (
              <div key={it.id} className="flex justify-between gap-3 py-2.5 text-xs">
                <div>
                  <p className="font-bold text-espresso">
                    {it.quantity}× {it.product_name}
                    {it.variant_name ? ` (${it.variant_name})` : ""}
                  </p>
                  <p className="text-coffee">
                    {[it.sweetness, it.ice, ...addons].filter(Boolean).join(" · ") || "Standard"}
                  </p>
                </div>
                <span className="font-bold text-espresso">{formatIDR(Number(it.line_total))}</span>
              </div>
            );
          })}
        </div>
        <div className="space-y-1 border-t border-coffee/15 pt-3 text-xs">
          <div className="flex justify-between text-coffee">
            <span>Subtotal</span>
            <span>{formatIDR(Number(order.subtotal))}</span>
          </div>
          {Number(order.discount) > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Discount</span>
              <span>-{formatIDR(Number(order.discount))}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold text-espresso">
            <span>Total</span>
            <span className="text-caramel">{formatIDR(Number(order.total))}</span>
          </div>
        </div>
      </Section>
    </div>
  );
}
