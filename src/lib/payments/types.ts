export type NormalizedPaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED";

export interface CreatePaymentInput {
  orderId: string; // provider-facing unique id (we use order_number)
  grossAmount: number; // integer IDR
  items: { id: string; name: string; price: number; quantity: number }[];
  customer: { name: string; email?: string; phone?: string | null };
  expiryMinutes: number;
}

export interface CreatePaymentResult {
  token: string;
  redirectUrl: string;
}

export interface ProviderTransactionStatus {
  providerOrderId: string;
  status: NormalizedPaymentStatus;
  grossAmount: number;
  paymentType: string | null;
  raw: Record<string, unknown>;
}

/** Abstraction layer so another gateway can replace Midtrans without touching business logic. */
export interface PaymentProvider {
  readonly name: string;
  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;
  /** Authoritative status fetched server-to-server. Never trust client/webhook payload alone. */
  getTransactionStatus(providerOrderId: string): Promise<ProviderTransactionStatus>;
  verifyNotificationSignature(payload: Record<string, unknown>): boolean;
}
