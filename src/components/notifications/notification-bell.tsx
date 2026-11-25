"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, BellRing, CheckCheck } from "lucide-react";
import { formatRelativeTime } from "@/lib/geo";
import { createClient } from "@/lib/supabase/client";

interface NotificationRow {
  id: string;
  title: string;
  body: string;
  data: { order_id?: string };
  read_at: string | null;
  created_at: string;
}

let notifChannelSeq = 0;

export function NotificationBell({
  userId,
  orderBasePath,
}: {
  userId: string;
  orderBasePath: "/customer/orders" | "/barista/orders";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const containerRef = useRef<HTMLDivElement | null>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const json = (await res.json()) as { notifications: NotificationRow[] };
      setItems(json.notifications);
    } catch {
      // ignore transient network errors
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setPermission("Notification" in window ? Notification.permission : "unsupported");
    }
    void loadNotifications();
  }, [loadNotifications]);

  // Close popover when clicking outside
  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // Subscribe to Realtime notifications for this user
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    const channel = supabase
      .channel(`haffye-notif-${userId}-${++notifChannelSeq}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (cancelled) return;
          const row = payload.new as NotificationRow;
          setItems((prev) => [row, ...prev.filter((x) => x.id !== row.id)].slice(0, 25));

          if (
            typeof window !== "undefined" &&
            "Notification" in window &&
            Notification.permission === "granted"
          ) {
            const url = row.data?.order_id ? `${orderBasePath}/${row.data.order_id}` : "/";
            if ("serviceWorker" in navigator) {
              void navigator.serviceWorker.ready
                .then((reg) =>
                  reg.showNotification(row.title, {
                    body: row.body,
                    icon: "/icons/icon-192.png",
                    data: { url },
                  }),
                )
                .catch(() => undefined);
            } else {
              new Notification(row.title, { body: row.body, icon: "/icons/icon-192.png" });
            }
          }
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId, orderBasePath]);

  const unreadCount = items.filter((n) => !n.read_at).length;

  const enableBrowserAlerts = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const res = await Notification.requestPermission();
    setPermission(res);
  };

  const markAllRead = async () => {
    setItems((prev) => prev.map((i) => ({ ...i, read_at: i.read_at ?? new Date().toISOString() })));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
  };

  const handleOpenItem = async (n: NotificationRow) => {
    if (!n.read_at) {
      setItems((prev) =>
        prev.map((i) => (i.id === n.id ? { ...i, read_at: new Date().toISOString() } : i)),
      );
      void fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: n.id }),
      });
    }
    setOpen(false);
    if (n.data?.order_id) {
      router.push(`${orderBasePath}/${n.data.order_id}`);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label="Notifications"
        onClick={() => setOpen((prev) => !prev)}
        className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-coffee/20 bg-cream text-espresso hover:border-caramel"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-caramel px-1 text-[10px] font-bold text-espresso">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-coffee/15 bg-warm p-3 shadow-soft z-50">
          <div className="mb-2 flex items-center justify-between gap-2 border-b border-coffee/10 pb-2">
            <span className="text-xs font-bold text-espresso">Notifications</span>
            <div className="flex items-center gap-2">
              {permission === "default" && (
                <button
                  type="button"
                  onClick={() => void enableBrowserAlerts()}
                  className="inline-flex items-center gap-1 rounded-lg bg-caramel/20 px-2 py-1 text-[10px] font-semibold text-espresso hover:bg-caramel/30"
                >
                  <BellRing className="h-3 w-3" />
                  Enable Alerts
                </button>
              )}
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-caramel hover:underline"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Mark read
                </button>
              )}
            </div>
          </div>

          {items.length === 0 ? (
            <p className="py-6 text-center text-xs text-coffee">No notifications yet.</p>
          ) : (
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => void handleOpenItem(n)}
                    className={`w-full rounded-xl p-2.5 text-left transition hover:bg-cream ${
                      n.read_at ? "opacity-70" : "bg-cream/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-bold text-espresso">{n.title}</p>
                      {!n.read_at && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-caramel" />}
                    </div>
                    {n.body && <p className="mt-0.5 text-[11px] text-coffee">{n.body}</p>}
                    <p className="mt-1 text-[10px] text-coffee/75">
                      {formatRelativeTime(n.created_at)}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
