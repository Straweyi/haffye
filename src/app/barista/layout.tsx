import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { getMyVendor } from "@/lib/queries/barista";
import { BaristaProvider } from "@/components/providers/barista-provider";
import { BaristaShell } from "@/components/barista/barista-shell";

export default async function BaristaLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("barista");
  const vendor = await getMyVendor(session.id);

  return (
    <BaristaProvider initialVendor={vendor}>
      <BaristaShell userId={session.id}>{children}</BaristaShell>
    </BaristaProvider>
  );
}
