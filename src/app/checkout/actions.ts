"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import { createPayment, refundPayment, squareConfigured, toCents } from "@/lib/square";
import { sendNewOrderAlert, sendOrderConfirmation, type EmailOrder } from "@/lib/email";
import { getSettings } from "@/lib/data";
import { hasRole, getViewer } from "@/lib/auth";

type Fail = { ok: false; error: string };
const fail = (error: string): Fail => ({ ok: false, error });

const CheckoutInput = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(200),
  name: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z.string().trim().max(30).optional().default(""),
  fulfillment: z.enum(["ship", "envelope", "pickup"]),
  address: z.object({
    line1: z.string().trim().max(200).default(""), line2: z.string().trim().max(200).default(""),
    city: z.string().trim().max(100).default(""), state: z.string().trim().max(40).default(""),
    zip: z.string().trim().max(12).default(""),
  }),
  items: z.array(z.object({ id: z.string().uuid(), qty: z.number().int().min(1).max(999) })).min(1, "Your cart is empty.").max(200),
  note: z.string().trim().max(500).optional().default(""),
});

/** Step 1: hold the items and work out the exact total on the server. */
export async function startCheckout(raw: z.input<typeof CheckoutInput>): Promise<{ ok: true; orderId: string; number: number; total: number; token: string } | Fail> {
  if (!squareConfigured() || !hasAdminKey()) return fail("Online payments aren't set up yet. Please check back soon.");
  const parsed = CheckoutInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Please check your details.");
  const v = parsed.data;
  if (v.fulfillment !== "pickup") {
    if (!v.address.line1 || !v.address.city || !v.address.state) return fail("Please enter your full shipping address.");
    if (!/^\d{5}(-\d{4})?$/.test(v.address.zip)) return fail("Enter a 5-digit ZIP code.");
  }

  const [settings, viewer] = await Promise.all([getSettings(), getViewer()]);
  if (settings.siteMode !== "live" && !(viewer && hasRole(viewer.role, "staff"))) return fail("Online ordering isn't open yet.");

  // Merge duplicate lines.
  const merged = new Map<string, number>();
  v.items.forEach((i) => merged.set(i.id, (merged.get(i.id) ?? 0) + i.qty));

  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_order", {
    p_user: viewer?.id ?? null, p_email: v.email, p_name: v.name, p_phone: v.phone, p_fulfillment: v.fulfillment,
    p_address: v.fulfillment === "pickup" ? {} : v.address,
    p_items: [...merged.entries()].map(([id, qty]) => ({ id, qty })), p_note: v.note,
  });
  if (error) {
    const msg = error.message || "";
    // Messages raised by the database are written for customers; anything else gets a generic message.
    return fail(/sold out|no longer available|cart is empty|isn't available|Envelope|shipping address|maintenance|Too many|quantity/i.test(msg)
      ? msg : "We couldn't start checkout. Please try again.");
  }
  const r = data as { id: string; number: number; total: number; token: string };
  return { ok: true, orderId: r.id, number: r.number, total: Number(r.total), token: r.token };
}

/** Step 2: charge the card with Square, then confirm the order. */
export async function payOrder(orderId: string, token: string, sourceId: string, verificationToken?: string):
  Promise<{ ok: true; orderId: string; token: string } | Fail> {
  if (!z.string().uuid().safeParse(orderId).success || !z.string().uuid().safeParse(token).success) return fail("Checkout expired. Please try again.");
  if (typeof sourceId !== "string" || sourceId.length < 10 || sourceId.length > 500) return fail("Card details are missing. Please try again.");
  const admin = createAdminClient();
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).eq("access_token", token).maybeSingle();
  if (!order) return fail("Checkout expired. Please try again.");
  if (order.status === "paid") return { ok: true, orderId, token };
  if (order.status !== "pending") return fail("This checkout expired. Your card was not charged. Please try again.");

  const pay = await createPayment({
    sourceId, verificationToken, idempotencyKey: order.id, amountCents: toCents(order.total), email: order.email,
    reference: `FT-${order.number}`, note: `Frontier TCG online order #${order.number}`,
    shipping: order.fulfillment === "pickup" ? null : { name: order.full_name, line1: order.ship_line1, line2: order.ship_line2, city: order.ship_city, state: order.ship_state, zip: order.ship_zip },
  });
  if (!pay.ok) {
    await admin.rpc("release_order", { p_order: order.id, p_reason: `Payment failed: ${pay.code}` });
    return fail(pay.message);
  }
  const p = pay.data.payment;
  const paidCents = p.amount_money?.amount;
  const { error: finErr } = await admin.rpc("finalize_order", {
    p_order: order.id, p_payment_id: p.id, p_receipt: p.receipt_url ?? null,
    p_brand: p.card_details?.card?.card_brand ?? null, p_last4: p.card_details?.card?.last_4 ?? null,
    p_amount: paidCents / 100,
  });
  if (finErr) {
    // Couldn't record the order: give the money back so nobody pays for an order we can't fill.
    await refundPayment({ paymentId: p.id, amountCents: paidCents, idempotencyKey: `undo-${order.id}`.slice(0, 45), reason: "Order could not be completed" });
    await admin.rpc("release_order", { p_order: order.id, p_reason: "Order could not be recorded; payment refunded" });
    return fail("Something went wrong finishing your order, so we refunded your card right away. Please try again.");
  }

  // Emails are best-effort: the order is already saved.
  try {
    const { data: items } = await admin.from("order_items").select("name, details, quantity, line_total").eq("order_id", order.id);
    const eo = { ...order, items: items ?? [] } as EmailOrder;
    const settings = await getSettings();
    await Promise.all([
      sendOrderConfirmation(eo),
      settings.orderEmail ? sendNewOrderAlert(settings.orderEmail, eo) : Promise.resolve(false),
    ]);
  } catch { /* ignore */ }
  return { ok: true, orderId: order.id, token: order.access_token };
}

/** Customer backed out or the card form failed before charging: give the held stock back. */
export async function cancelCheckout(orderId: string, token: string) {
  if (!z.string().uuid().safeParse(orderId).success || !z.string().uuid().safeParse(token).success) return;
  const admin = createAdminClient();
  const { data } = await admin.from("orders").select("id, status").eq("id", orderId).eq("access_token", token).maybeSingle();
  if (data?.status === "pending") await admin.rpc("release_order", { p_order: orderId, p_reason: "Checkout cancelled" });
}

/** Saved name, email and default address for signed-in customers. */
export async function checkoutPrefill() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const [{ data: profile }, { data: addr }] = await Promise.all([
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle(),
    supabase.from("addresses").select("*").order("is_default", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    email: user.email ?? "", name: addr?.full_name || profile?.full_name || "", phone: addr?.phone || profile?.phone || "",
    address: addr ? { line1: addr.line1, line2: addr.line2 ?? "", city: addr.city, state: addr.state, zip: addr.zip } : null,
  };
}
