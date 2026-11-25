"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  Coffee,
  LayoutDashboard,
  MapPin,
  Package,
  TrendingUp,
  User,
} from "lucide-react";
import { useBarista } from "@/components/providers/barista-provider";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useBaristaOrders } from "@/hooks/use-barista-orders";
import { ACTIVE_ORDER_STATUSES } from "@/lib/orders";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DESKTOP_NAV = [
  { href: "/barista", label: "Dashboard", exact: true },
  { href: "/barista/location", label: "Location" },
  { href: "/barista/orders", label: "Orders" },
  { href: "/barista/products", label: "Products" },
  { href: "/barista/inventory", label: "Inventory" },
  { href: "/barista/revenue", label: "Revenue" },
  { href: "/barista/profile", label: "Profile" },
];

const MOBILE_NAV = [
  { href: "/barista", label: "Home", icon: LayoutDashboard, exact: true },
  { href: "/barista/location", label: "GPS", icon: MapPin },
  { href: "/barista/orders", label: "Orders", icon: ClipboardList },
  { href: "/barista/inventory", label: "Stock", icon: Package },
  { href: "/barista/profile", label: "Profile", icon: User },
];

export function BaristaShell({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { vendor, gpsActive, isOnline } = useBarista();
  const { orders } = useBaristaOrders();

  const activeOrderCount = orders.filter((o) => ACTIVE_ORDER_STATUSES.includes(o.status)).length;

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  const statusVariant =
    vendor?.status === "ACTIVE" ? "active" : vendor?.status === "BUSY" ? "busy" : "offline";

  return (
    <div className="min-h-dvh bg-warm pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-coffee/10 bg-warm/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link href="/barista" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-espresso text-caramel">
              <Coffee className="h-5 w-5" />
            </span>
            <div>
              <span className="block text-sm font-bold tracking-[0.18em] text-espresso">
                HAFFYE
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-coffee">
                Barista Ops
              </span>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {DESKTOP_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-xl px-3 py-2 text-sm font-medium transition",
                  isActive(item.href, item.exact)
                    ? "bg-cream font-semibold text-espresso"
                    : "text-coffee hover:bg-cream/60",
                )}
              >
                {item.label}
                {item.href === "/barista/orders" && activeOrderCount > 0 && (
                  <span className="ml-1.5 rounded-full bg-caramel px-1.5 py-0.5 text-[10px] font-bold text-espresso">
                    {activeOrderCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <NotificationBell userId={userId} orderBasePath="/barista/orders" />
            <Link href="/barista/revenue" className="hidden sm:inline-flex md:hidden">
              <span className="inline-flex h-9 items-center gap-1 rounded-xl border border-coffee/20 px-2.5 text-xs font-semibold text-espresso">
                <TrendingUp className="h-3.5 w-3.5 text-caramel" />
                Revenue
              </span>
            </Link>
            {!isOnline && (
              <Badge variant="offline" className="bg-red-100 text-red-700">
                Offline Net
              </Badge>
            )}
            <Link href="/barista/location" className="flex items-center gap-1.5">
              {gpsActive && (
                <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-emerald-500" title="GPS broadcasting" />
              )}
              <Badge variant={statusVariant}>
                {vendor ? `${vendor.code} · ${vendor.status}` : "Unassigned"}
              </Badge>
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-5">{children}</main>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-coffee/10 bg-warm/95 backdrop-blur md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {MOBILE_NAV.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium",
                  active ? "text-espresso" : "text-coffee/70",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-caramel")} />
                <span>{item.label}</span>
                {item.href === "/barista/orders" && activeOrderCount > 0 && (
                  <span className="absolute right-3 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-caramel px-1 text-[10px] font-bold text-espresso">
                    {activeOrderCount}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
