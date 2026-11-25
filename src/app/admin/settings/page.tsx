import { Badge } from "@/components/ui/badge";
import { PageHeader, Section } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default function AdminSettingsPage() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL || "Not configured";
  const midtransProd = process.env.MIDTRANS_IS_PRODUCTION === "true";
  const midtransReady = Boolean(
    process.env.MIDTRANS_SERVER_KEY && process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
  );
  const cronReady = Boolean(process.env.CRON_SECRET);
  const gpsInterval = process.env.NEXT_PUBLIC_GPS_UPDATE_INTERVAL_SECONDS || "8";
  const gpsMaxAcc = process.env.NEXT_PUBLIC_GPS_MAX_ACCURACY_METERS || "100";
  const gpsStale = process.env.NEXT_PUBLIC_LOCATION_STALE_SECONDS || "60";

  return (
    <>
      <PageHeader
        title="Platform Settings"
        subtitle="Read-only runtime configuration overview. Secrets are managed in Vercel / .env and never exposed to the client."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Connected Services">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-coffee/10 pb-2">
              <span className="font-semibold text-espresso">App Base URL</span>
              <span className="text-coffee">{appUrl}</span>
            </div>
            <div className="flex items-center justify-between border-b border-coffee/10 pb-2">
              <span className="font-semibold text-espresso">Supabase Project</span>
              <span className="max-w-[260px] truncate text-coffee">{supabaseHost}</span>
            </div>
            <div className="flex items-center justify-between border-b border-coffee/10 pb-2">
              <span className="font-semibold text-espresso">Midtrans Mode</span>
              <Badge variant={midtransProd ? "busy" : "active"}>
                {midtransProd ? "Production" : "Sandbox"}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="font-semibold text-espresso">Midtrans Keys</span>
              <Badge variant={midtransReady ? "active" : "offline"}>
                {midtransReady ? "Configured" : "Missing"}
              </Badge>
            </div>
          </div>
        </Section>

        <Section title="GPS & Cron Configuration">
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between border-b border-coffee/10 pb-2">
              <span className="font-semibold text-espresso">GPS Update Interval</span>
              <span className="text-coffee">{gpsInterval}s</span>
            </div>
            <div className="flex items-center justify-between border-b border-coffee/10 pb-2">
              <span className="font-semibold text-espresso">GPS Max Accuracy</span>
              <span className="text-coffee">{gpsMaxAcc}m</span>
            </div>
            <div className="flex items-center justify-between border-b border-coffee/10 pb-2">
              <span className="font-semibold text-espresso">Stale Threshold</span>
              <span className="text-coffee">{gpsStale}s</span>
            </div>
            <div className="flex items-center justify-between border-b border-coffee/10 pb-2">
              <span className="font-semibold text-espresso">CRON_SECRET</span>
              <Badge variant={cronReady ? "active" : "offline"}>
                {cronReady ? "Configured" : "Not set"}
              </Badge>
            </div>
            <div className="rounded-xl bg-cream p-3 text-[11px] text-coffee">
              <p className="font-semibold text-espresso">Webhook &amp; Cron Endpoints</p>
              <p className="mt-1">Midtrans Webhook: {appUrl}/api/payments/webhook</p>
              <p>Location Cleanup Cron: /api/cron/cleanup-locations</p>
              <p>Payment Expiry Cron: /api/cron/expire-payments</p>
            </div>
          </div>
        </Section>
      </div>
    </>
  );
}
