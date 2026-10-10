"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";

/** "Email me when it's back in stock." */
export async function requestStockAlert(productId: string, email: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const e = email.trim().toLowerCase();
  if (!z.string().uuid().safeParse(productId).success) return { ok: false, error: "Unknown product." };
  if (!z.string().email().max(200).safeParse(e).success) return { ok: false, error: "Enter a valid email address." };
  if (!hasAdminKey()) return { ok: false, error: "Alerts aren't available yet." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const admin = createAdminClient();
  const { count } = await admin.from("stock_alerts").select("id", { count: "exact", head: true }).eq("email", e).is("notified_at", null);
  if ((count ?? 0) >= 100) return { ok: false, error: "You're already waiting on 100 items. We'll email you as they come back." };
  const { error } = await admin.from("stock_alerts").upsert(
    { product_id: productId, email: e, user_id: user?.id ?? null, notified_at: null, created_at: new Date().toISOString() },
    { onConflict: "product_id,email" });
  if (error) return { ok: false, error: "Couldn't save your alert. Please try again." };
  return { ok: true };
}
