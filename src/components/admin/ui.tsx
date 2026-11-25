import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ORDER_STATUS_BADGE_VARIANT, ORDER_STATUS_LABELS } from "@/lib/orders";
import type { OrderStatus } from "@/types/domain";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-espresso">{title}</h1>
        {subtitle && <p className="text-xs text-coffee">{subtitle}</p>}
      </div>
      {actions}
    </div>
  );
}

export function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs font-medium text-coffee">{label}</p>
        <p className="mt-1.5 text-xl font-bold text-espresso">{value}</p>
        {hint && <p className="mt-0.5 text-[11px] text-coffee/80">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function Section({
  title,
  children,
  right,
}: {
  title: string;
  children: ReactNode;
  right?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-espresso">{title}</h2>
          {right}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status as OrderStatus;
  if (ORDER_STATUS_LABELS[s]) {
    return <Badge variant={ORDER_STATUS_BADGE_VARIANT[s]}>{ORDER_STATUS_LABELS[s]}</Badge>;
  }
  const v =
    status === "PAID" || status === "ACTIVE"
      ? "active"
      : status === "BUSY" || status === "PENDING"
        ? "busy"
        : status === "OFFLINE" ||
            status === "PAUSED" ||
            status === "FAILED" ||
            status === "EXPIRED" ||
            status === "CANCELLED"
          ? "offline"
          : "outline";
  return <Badge variant={v}>{status}</Badge>;
}

export function EmptyRow({ text = "No data yet." }: { text?: string }) {
  return <p className="py-4 text-center text-xs text-coffee">{text}</p>;
}

export const tableCls = "w-full min-w-[640px] text-left text-xs";
export const thCls = "py-2 pr-3 text-[11px] font-semibold uppercase tracking-wide text-coffee";
export const tdCls = "py-2.5 pr-3 align-middle text-espresso";

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function BarChart({
  data,
  format = (n) => String(n),
  height = 140,
  barClass = "bg-caramel",
  showEvery = 1,
}: {
  data: { label: string; value: number }[];
  format?: (n: number) => string;
  height?: number;
  barClass?: string;
  showEvery?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyRow text="No data for this period." />;
  return (
    <div>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d) => (
          <div
            key={d.label}
            className="group relative flex h-full flex-1 flex-col justify-end"
            title={`${d.label}: ${format(d.value)}`}
          >
            <div
              className={cn("w-full rounded-t-md transition-all group-hover:opacity-80", barClass)}
              style={{
                height: `${Math.max(2, (d.value / max) * 100)}%`,
                opacity: d.value === 0 ? 0.25 : 1,
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-1">
        {data.map((d, i) => (
          <span key={d.label} className="flex-1 truncate text-center text-[9px] text-coffee">
            {i % showEvery === 0 ? d.label.slice(-5) : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

export function HBarList({
  rows,
  format = (n) => String(n),
}: {
  rows: { label: string; value: number; sub?: string }[];
  format?: (n: number) => string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <EmptyRow />;
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex justify-between gap-2 text-xs">
            <span className="truncate font-semibold text-espresso">{r.label}</span>
            <span className="shrink-0 text-coffee">
              {r.sub ? `${r.sub} · ` : ""}
              {format(r.value)}
            </span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-cream">
            <div className="h-2 rounded-full bg-caramel" style={{ width: `${(r.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

