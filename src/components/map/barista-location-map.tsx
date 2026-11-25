import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const BaristaLocationMap = dynamic(() => import("./barista-location-map-client"), {
  ssr: false,
  loading: () => <Skeleton className="h-[320px] w-full rounded-2xl" />,
});
