import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const LiveVendorMap = dynamic(() => import("./live-vendor-map-client"), {
  ssr: false,
  loading: () => <Skeleton className="h-[440px] w-full rounded-2xl md:h-[520px]" />,
});
