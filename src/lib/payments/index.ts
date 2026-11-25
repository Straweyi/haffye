import "server-only";
import { midtransProvider } from "./midtrans";
import type { PaymentProvider } from "./types";

export function getPaymentProvider(): PaymentProvider {
  return midtransProvider;
}

export function isPaymentConfigured(): boolean {
  return Boolean(process.env.MIDTRANS_SERVER_KEY);
}
