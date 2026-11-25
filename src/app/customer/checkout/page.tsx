import { requireRole } from "@/lib/auth";
import { getOperationalVendors } from "@/lib/queries/customer";
import { getUsableVouchers } from "@/lib/queries/orders";
import { isPaymentConfigured } from "@/lib/payments";
import { CheckoutView } from "@/components/customer/checkout-view";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const session = await requireRole("customer");
  const [vendors, vouchers] = await Promise.all([getOperationalVendors(), getUsableVouchers(session.id)]);
  return <CheckoutView initialVendors={vendors} vouchers={vouchers} paymentReady={isPaymentConfigured()} />;
}
