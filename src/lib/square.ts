/** Square Payments, called from the server only. Docs: developer.squareup.com/reference/square */

const VERSION = "2026-09-16";

export const squareConfigured = () => !!(process.env.SQUARE_ACCESS_TOKEN && process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID);
export const squareEnv = () => ((process.env.SQUARE_ENVIRONMENT || "sandbox").trim().toLowerCase() === "production" ? "production" : "sandbox");
const host = () => (squareEnv() === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com");

type SquareError = { category?: string; code?: string; detail?: string };

async function call<T>(path: string, body: unknown): Promise<{ ok: true; data: T } | { ok: false; code: string; message: string }> {
  try {
    const res = await fetch(host() + path, {
      method: "POST",
      headers: {
        "Square-Version": VERSION,
        Authorization: `Bearer ${process.env.SQUARE_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.errors?.length) {
      const e: SquareError = json.errors?.[0] ?? {};
      return { ok: false, code: e.code ?? `HTTP_${res.status}`, message: friendlySquare(e) };
    }
    return { ok: true, data: json as T };
  } catch {
    return { ok: false, code: "NETWORK", message: "We couldn't reach the payment service. Your card was not charged. Please try again." };
  }
}

function friendlySquare(e: SquareError): string {
  switch (e.code) {
    case "CARD_DECLINED": case "GENERIC_DECLINE": return "Your card was declined. Please try another card.";
    case "INSUFFICIENT_FUNDS": return "Your card was declined for insufficient funds. Please try another card.";
    case "CVV_FAILURE": case "INVALID_CVV": return "The security code (CVV) didn't match. Please check it and try again.";
    case "ADDRESS_VERIFICATION_FAILURE": case "INVALID_POSTAL_CODE": return "The billing ZIP code didn't match your card. Please check it and try again.";
    case "INVALID_EXPIRATION": case "EXPIRATION_FAILURE": return "The card's expiration date is invalid or has passed.";
    case "CARD_DECLINED_VERIFICATION_REQUIRED": return "Your bank needs extra verification. Please try again and follow your bank's prompt.";
    case "TRANSACTION_LIMIT": return "This payment is over your card's limit. Please try another card.";
    case "UNAUTHORIZED": case "ACCESS_TOKEN_EXPIRED": case "ACCESS_TOKEN_REVOKED":
      return "Online payments are temporarily unavailable. Your card was not charged.";
    default: return "Your payment didn't go through. Your card was not charged. Please try again or use another card.";
  }
}

export type SquarePayment = {
  id: string; status: string; receipt_url?: string;
  amount_money: { amount: number; currency: string };
  card_details?: { card?: { card_brand?: string; last_4?: string } };
};

export async function createPayment(input: {
  sourceId: string; idempotencyKey: string; amountCents: number; email: string; reference: string; note: string;
  verificationToken?: string;
  shipping?: { name: string; line1: string; line2?: string | null; city: string; state: string; zip: string } | null;
}) {
  const [first, ...rest] = (input.shipping?.name ?? "").trim().split(/\s+/);
  return call<{ payment: SquarePayment }>("/v2/payments", {
    source_id: input.sourceId,
    idempotency_key: input.idempotencyKey,
    amount_money: { amount: input.amountCents, currency: "USD" },
    location_id: process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID,
    autocomplete: true,
    buyer_email_address: input.email,
    reference_id: input.reference.slice(0, 40),
    note: input.note.slice(0, 500),
    ...(input.verificationToken ? { verification_token: input.verificationToken } : {}),
    ...(input.shipping ? {
      shipping_address: {
        first_name: first || undefined, last_name: rest.join(" ") || undefined,
        address_line_1: input.shipping.line1, address_line_2: input.shipping.line2 || undefined,
        locality: input.shipping.city, administrative_district_level_1: input.shipping.state,
        postal_code: input.shipping.zip, country: "US",
      },
    } : {}),
  });
}

export async function refundPayment(input: { paymentId: string; amountCents: number; idempotencyKey: string; reason: string }) {
  return call<{ refund: { id: string; status: string } }>("/v2/refunds", {
    idempotency_key: input.idempotencyKey,
    payment_id: input.paymentId,
    amount_money: { amount: input.amountCents, currency: "USD" },
    reason: input.reason.slice(0, 192),
  });
}

export const toCents = (n: number | string) => Math.round(Number(n) * 100);
