"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRole } from "@/lib/auth";
import { refundPayment, toCents } from "@/lib/square";
import { sendReadyForPickup, sendRefund, sendShipped, type EmailOrder } from "@/lib/email";
import { notifyRestocks } from "@/lib/restock";

type Result = { ok: true; emailed?: boolean } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });
const uuid = z.string().uuid();

async function emailOrder(id: string): Promise<EmailOrder | null> {
  const admin = createAdminClient();
  const [{ data: o }, { data: items }] = await Promise.all([
    admin.from("orders").select("*").eq("id", id).maybeSingle(),
    admin.from("order_items").select("name, details, quantity, line_total").eq("order_id", id),
  ]);
  return o ? ({ ...o, items: items ?? [] } as EmailOrder) : null;
}

export async function setOrderStatus(id: string, status: string, opts: { note?: string; carrier?: string; tracking?: string; notify?: boolean } = {}): Promise<Result> {
  const { error: roleErr } = await checkRole("staff");
  if (roleErr) return fail(roleErr);
  if (!uuid.safeParse(id).success) return fail("Unknown order.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("order_set_status", {
    p_order: id, p_status: status, p_note: opts.note?.slice(0, 500) ?? null,
    p_carrier: opts.carrier?.slice(0, 40) ?? null, p_tracking: opts.tracking?.replace(/\s+/g, " ").trim().slice(0, 60) ?? null,
  });
  if (error) {
    const m = error.message;
    return fail(/never paid|refunded|Use Refund|Unknown status|not found/i.test(m) ? m.split("\n")[0] : "Couldn't update the order. Please try again.");
  }
  let emailed = false;
  if (opts.notify && (status === "shipped" || status === "ready_for_pickup")) {
    const eo = await emailOrder(id);
    if (eo) emailed = status === "shipped" ? await sendShipped(eo) : await sendReadyForPickup(eo);
  }
  revalidatePath("/admin/orders", "layout");
  return { ok: true, emailed };
}

export async function addOrderNote(id: string, note: string): Promise<Result> {
  const { error: roleErr } = await checkRole("staff");
  if (roleErr) return fail(roleErr);
  if (!uuid.safeParse(id).success || !note.trim()) return fail("Write a note first.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("order_add_note", { p_order: id, p_note: note });
  if (error) return fail("Couldn't save the note.");
  revalidatePath(`/admin/orders/${id}`);
  return { ok: true };
}

export async function refundOrder(id: string, amount: number, restock: boolean, reason: string): Promise<Result> {
  const { viewer, error: roleErr } = await checkRole("admin");
  if (roleErr) return fail("Only owners and admins can refund orders.");
  if (!uuid.safeParse(id).success) return fail("Unknown order.");
  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("id, number, total, refunded_amount, payment_id, status").eq("id", id).maybeSingle();
  if (!o || !o.payment_id) return fail("This order has no payment to refund.");
  const left = Math.round((Number(o.total) - Number(o.refunded_amount)) * 100) / 100;
  const amt = Math.round(Number(amount) * 100) / 100;
  if (!(amt > 0)) return fail("Enter an amount to refund.");
  if (amt > left) return fail(`You can refund up to $${left.toFixed(2)} on this order.`);
  const r = await refundPayment({
    paymentId: o.payment_id, amountCents: toCents(amt),
    idempotencyKey: `rf-${o.id.slice(0, 18)}-${toCents(o.refunded_amount)}-${toCents(amt)}`,
    reason: reason || `Refund for order #${o.number}`,
  });
  if (!r.ok) return fail(`Square didn't accept the refund: ${r.message}`);
  const { error } = await admin.rpc("order_mark_refunded", { p_order: id, p_amount: amt, p_restock: restock, p_actor: viewer!.id });
  if (error) return fail("The refund went through in Square, but the order couldn't be updated here. Note it on the order.");
  const eo = await emailOrder(id);
  const emailed = eo ? await sendRefund(eo, amt) : false;
  if (restock) await notifyRestocks();
  revalidatePath("/admin/orders", "layout");
  revalidatePath("/", "layout");
  return { ok: true, emailed };
}
