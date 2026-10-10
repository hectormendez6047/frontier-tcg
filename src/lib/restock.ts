import { createAdminClient, hasAdminKey } from "./supabase/admin";
import { emailConfigured, sendRestock } from "./email";

/** Email everyone waiting on products that are back in stock, then mark their alerts as sent. Safe to call often. */
export async function notifyRestocks(productIds?: string[]) {
  if (!hasAdminKey() || !emailConfigured()) return 0;
  try {
    const admin = createAdminClient();
    let q = admin.from("stock_alerts").select("id, email, product_id").is("notified_at", null).limit(500);
    if (productIds?.length) q = q.in("product_id", productIds.slice(0, 500));
    const { data: alerts } = await q;
    if (!alerts?.length) return 0;
    const ids = [...new Set(alerts.map((a: { product_id: string }) => a.product_id))];
    const { data: prods } = await admin.from("products")
      .select("id, name, slug, price, sale_price, available_quantity, status, set_name, card_number, condition").in("id", ids);
    const ready = new Map((prods ?? []).filter((p: { available_quantity: number; status: string }) => p.available_quantity > 0 && p.status === "active").map((p: { id: string }) => [p.id, p]));
    let n = 0;
    for (const a of alerts as { id: string; email: string; product_id: string }[]) {
      const p = ready.get(a.product_id) as { name: string; slug: string; price: number; sale_price: number | null; set_name: string | null; card_number: string | null; condition: string | null } | undefined;
      if (!p) continue;
      const price = p.sale_price != null && Number(p.sale_price) < Number(p.price) ? Number(p.sale_price) : Number(p.price);
      const ok = await sendRestock(a.email, { name: p.name, slug: p.slug, price, details: [p.set_name, p.card_number && "#" + p.card_number, p.condition].filter(Boolean).join(" · ") });
      if (ok) { await admin.from("stock_alerts").update({ notified_at: new Date().toISOString() }).eq("id", a.id); n++; }
    }
    return n;
  } catch {
    return 0;
  }
}
