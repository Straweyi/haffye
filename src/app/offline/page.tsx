import { WifiOff } from "lucide-react";
import { OfflineRetryButton } from "@/components/pwa/offline-retry-button";

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-cream px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-espresso text-caramel shadow-soft">
        <WifiOff className="h-8 w-8" />
      </span>
      <p className="mt-5 text-xs font-bold uppercase tracking-[0.2em] text-caramel">HAFFYE</p>
      <h1 className="mt-1 text-2xl font-bold text-espresso">You&apos;re Offline</h1>
      <p className="mt-2 max-w-xs text-sm text-coffee">
        Live cart locations, orders, and Midtrans payments require an internet connection. Reconnect
        and try again.
      </p>
      <OfflineRetryButton />
    </main>
  );
}
