"use client";

import { useQuery } from "@tanstack/react-query";
import { useCustomer, type RealtimeStatus } from "@/components/providers/customer-provider";
import type { VendorWithLocation } from "@/types/domain";

export type { RealtimeStatus };

async function fetchOperationalVendors(): Promise<VendorWithLocation[]> {
  const res = await fetch("/api/customer/vendors", { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to load vendors");
  const json = (await res.json()) as { vendors: VendorWithLocation[] };
  return json.vendors;
}

export function useLiveVendors(initialVendors?: VendorWithLocation[]) {
  const { realtimeStatus, nowMs } = useCustomer();

  const query = useQuery({
    queryKey: ["operational-vendors"],
    queryFn: fetchOperationalVendors,
    initialData: initialVendors,
    refetchInterval: 30_000,
  });

  return {
    vendors: query.data ?? [],
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    realtimeStatus,
    nowMs,
    refetch: query.refetch,
  };
}
