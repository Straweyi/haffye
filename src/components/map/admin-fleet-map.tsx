import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

export const AdminFleetMap = dynamic(() => import("./admin-fleet-map-client"), {
  ssr: false,
  loading: () => <Skeleton className="h-[420px] w-full rounded-2xl" />,
});
