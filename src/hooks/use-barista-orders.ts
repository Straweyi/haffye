"use client";

import { useQuery } from "@tanstack/react-query";
import { useBarista } from "@/components/providers/barista-provider";
import type { BaristaOrderSummary } from "@/types/domain";

async function fetchBaristaOrders(): Promise<BaristaOrderSummary[]> {
  const res = await fetch("/api/barista/orders", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load orders");
  const json = (await res.json()) as { orders: BaristaOrderSummary[] };
  return json.orders;
}

export function useBaristaOrders(initialOrders?: BaristaOrderSummary[]) {
  const { vendor, realtimeStatus, nowMs } = useBarista();

  const query = useQuery({
    queryKey: ["barista-orders", vendor?.id ?? "none"],
    queryFn: fetchBaristaOrders,
    initialData: initialOrders,
    enabled: Boolean(vendor?.id),
    refetchInterval: 30_000,
  });

  return {
    orders: query.data ?? [],
    isLoading: query.isLoading,
    realtimeStatus,
    nowMs,
    refetch: query.refetch,
  };
}
