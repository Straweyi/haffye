import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import type {
  CreatePaymentInput,
  CreatePaymentResult,
  NormalizedPaymentStatus,
  PaymentProvider,
  ProviderTransactionStatus,
} from "./types";

function config() {
  const serverKey = process.env.MIDTRANS_SERVER_KEY;
  if (!serverKey) throw new Error("MIDTRANS_SERVER_KEY is not configured");
  const prod = process.env.MIDTRANS_IS_PRODUCTION === "true";
  return {
    serverKey,
    snapUrl: prod
      ? "https://app.midtrans.com/snap/v1/transactions"
      : "https://app.sandbox.midtrans.com/snap/v1/transactions",
    apiBase: prod ? "https://api.midtrans.com/v2" : "https://api.sandbox.midtrans.com/v2",
  };
}

function authHeader(serverKey: string) {
  return "Basic " + Buffer.from(serverKey + ":").toString("base64");
}

export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string,
): NormalizedPaymentStatus {
  switch (transactionStatus) {
    case "capture":
      return fraudStatus === "challenge" ? "PENDING" : "PAID";
    case "settlement":
      return "PAID";
    case "pending":
      return "PENDING";
    case "expire":
      return "EXPIRED";
    case "cancel":
      return "CANCELLED";
    case "deny":
    case "failure":
      return "FAILED";
    case "refund":
    case "partial_refund":
    case "chargeback":
      return "REFUNDED";
    default:
      return "PENDING";
  }
}

export function midtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
): string {
  return createHash("sha512").update(orderId + statusCode + grossAmount + serverKey).digest("hex");
}

export const midtransProvider: PaymentProvider = {
  name: "midtrans",

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const { serverKey, snapUrl } = config();
    const res = await fetch(snapUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: authHeader(serverKey),
      },
      body: JSON.stringify({
        transaction_details: { order_id: input.orderId, gross_amount: input.grossAmount },
        item_details: input.items.map((i) => ({
          id: i.id.slice(0, 50),
          name: i.name.slice(0, 50),
          price: i.price,
          quantity: i.quantity,
        })),
        customer_details: {
          first_name: input.customer.name.slice(0, 50) || "Customer",
          email: input.customer.email,
          phone: input.customer.phone ?? undefined,
        },
        expiry: { unit: "minutes", duration: input.expiryMinutes },
      }),
      cache: "no-store",
    });

    const json = (await res.json()) as {
      token?: string;
      redirect_url?: string;
      error_messages?: string[];
    };
    if (!res.ok || !json.token || !json.redirect_url) {
      throw new Error(json.error_messages?.join("; ") || `Midtrans error (${res.status})`);
    }
    return { token: json.token, redirectUrl: json.redirect_url };
  },

  async getTransactionStatus(providerOrderId: string): Promise<ProviderTransactionStatus> {
    const { serverKey, apiBase } = config();
    const res = await fetch(`${apiBase}/${encodeURIComponent(providerOrderId)}/status`, {
      headers: { Accept: "application/json", Authorization: authHeader(serverKey) },
      cache: "no-store",
    });
    const json = (await res.json()) as Record<string, string>;
    // Midtrans returns HTTP 200 with status_code 404 when the transaction does not exist yet.
    if (!res.ok || String(json.status_code) === "404") {
      throw new Error(json.status_message || `Transaction not found (${res.status})`);
    }
    return {
      providerOrderId,
      status: mapMidtransStatus(json.transaction_status, json.fraud_status),
      grossAmount: Math.round(Number(json.gross_amount)),
      paymentType: json.payment_type ?? null,
      raw: json,
    };
  },

  verifyNotificationSignature(payload: Record<string, unknown>): boolean {
    const { serverKey } = config();
    const { order_id, status_code, gross_amount, signature_key } = payload as Record<string, string>;
    if (!order_id || !status_code || !gross_amount || !signature_key) return false;
    const expected = Buffer.from(midtransSignature(order_id, status_code, gross_amount, serverKey));
    const given = Buffer.from(String(signature_key));
    return expected.length === given.length && timingSafeEqual(expected, given);
  },
};
