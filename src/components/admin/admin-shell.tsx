"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Boxes,
  ClipboardList,
  Coffee,
  CreditCard,
  FileText,
  Gift,
  LayoutDashboard,
  Layers,
  MapPinned,
  Settings,
  Store,
  Tag,
  Truck,
  UserCog,
  Users,
} from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/fleet", label: "Live Fleet Map", icon: MapPinned },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList },
  { href: "/admin/payments", label: "Payments", icon: CreditCard },
  { href: "/admin/analytics", label: "Sales Analytics", icon: BarChart3 },
  { href: "/admin/products", label: "Products", icon: Coffee },
  { href: "/admin/categories", label: "Categories", icon: Layers },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes },
  { href: "/admin/vendors", label: "Vendors", icon: Store },
  { href: "/admin/baristas", label: "Baristas", icon: UserCog },
  { href: "/admin/customers", label: "Customers", icon: Users },
  { href: "/admin/promotions", label: "Promotions", icon: Tag },
  { href: "/admin/rewards", label: "Rewards", icon: Gift },
  { href: "/admin/reports", label: "Reports", icon: FileText },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

export function AdminShell({ name, children }: { name: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-dvh bg-warm lg:flex">
      <aside className="hidden w-60 shrink-0 border-r border-coffee/10 bg-cream/50 lg:block">
        <div className="sticky top-0 flex h-dvh flex-col p-4">
          <div className="mb-5 flex items-center gap-2 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-espresso text-caramel">
              <Truck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold tracking-[0.18em] text-espresso">HAFFYE</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-coffee">Admin</p>
            </div>
          </div>
          <nav className="flex-1 space-y-0.5 overflow-y-auto">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium",
                    active(n.href, n.exact) ? "bg-espresso text-cream" : "text-coffee hover:bg-cream",
                  )}
                >
                  <Icon className="h-4 w-4" /> {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="mt-3 border-t border-coffee/10 pt-3">
            <p className="truncate px-2 text-xs text-coffee">{name}</p>
            <form action={logoutAction}>
              <button className="mt-1 w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-coffee hover:bg-cream">
                Log out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-coffee/10 bg-warm/95 backdrop-blur lg:hidden">
          <div className="flex h-14 items-center justify-between px-4">
            <span className="text-sm font-bold tracking-[0.18em] text-espresso">HAFFYE ADMIN</span>
            <form action={logoutAction}>
              <button className="rounded-lg border border-coffee/25 px-2.5 py-1 text-xs text-coffee">
                Log out
              </button>
            </form>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-3 pb-2.5">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold",
                  active(n.href, n.exact) ? "bg-espresso text-cream" : "bg-cream text-coffee",
                )}
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      </div>
    </div>
  );
}

