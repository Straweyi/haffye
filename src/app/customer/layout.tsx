import type { ReactNode } from "react";
import { requireRole } from "@/lib/auth";
import { getCustomerContext } from "@/lib/queries/customer";
import { CustomerProvider } from "@/components/providers/customer-provider";
import { CustomerShell } from "@/components/customer/customer-shell";

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const session = await requireRole("customer");
  const preferences = await getCustomerContext(session.id);

  return (
    <CustomerProvider initialPreferences={preferences}>
      <CustomerShell userId={session.id}>{children}</CustomerShell>
    </CustomerProvider>
  );
}
