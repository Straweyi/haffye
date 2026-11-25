"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, Coffee, Home, MapPin, Receipt, ShoppingBag, Store, User } from "lucide-react";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { useCustomer } from "@/components/providers/customer-provider";
import { useLiveVendors } from "@/hooks/use-live-vendors";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/customer", label: "Home", icon: Home, exact: true },
  { href: "/customer/map", label: "Map", icon: MapPin },
  { href: "/customer/vendors", label: "Vendors", icon: Store },
  { href: "/customer/menu", label: "Menu", icon: Coffee },
  { href: "/customer/orders", label: "Orders", icon: Receipt },
  { href: "/customer/rewards", label: "Rewards", icon: Award },
  { href: "/customer/profile", label: "Profile", icon: User },
];

const MOBILE_NAV = [
  { href: "/customer", label: "Home", icon: Home, exact: true },
  { href: "/customer/map", label: "Map", icon: MapPin },
  { href: "/customer/menu", label: "Menu", icon: Coffee },
  { href: "/customer/orders", label: "Orders", icon: Receipt },
  { href: "/customer/profile", label: "Profile", icon: User },
];

export function CustomerShell({
  userId,
  children,
}: {
  userId: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { selectedVendorId, cartCount } = useCustomer();
  const { vendors } = useLiveVendors();

  const selectedVendor = vendors.find((v) => v.id === selectedVendorId) ?? null;

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-dvh bg-warm pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-coffee/10 bg-warm/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/customer" className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-espresso text-caramel">
              <Coffee className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold tracking-[0.18em] text-espresso">HAFFYE</span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) => (
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
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/customer/vendors"
              className="flex max-w-[165px] items-center gap-1.5 truncate rounded-full border border-coffee/20 bg-cream px-3 py-1.5 text-xs font-medium text-espresso hover:border-caramel"
              title="Selected HAFFYE cart"
            >
              <Store className="h-3.5 w-3.5 shrink-0 text-caramel" />
              <span className="truncate">
                {selectedVendor ? selectedVendor.code : "Pick Cart"}
              </span>
            </Link>

            <NotificationBell userId={userId} orderBasePath="/customer/orders" />

            <Link
              href="/customer/cart"
              aria-label="Shopping cart"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-espresso text-cream shadow-soft hover:bg-coffee"
            >
              <ShoppingBag className="h-4 w-4" />
              {cartCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-caramel px-1 text-[11px] font-bold text-espresso">
                  {cartCount}
                </span>
              )}
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5">{children}</main>

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
                  "flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium",
                  active ? "text-espresso" : "text-coffee/70",
                )}
              >
                <Icon className={cn("h-5 w-5", active && "text-caramel")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
