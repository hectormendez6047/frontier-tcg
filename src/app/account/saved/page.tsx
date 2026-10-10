import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { ProductGrid } from "@/components/ProductCard";
import type { Product } from "@/lib/types";

export const metadata = { title: "Saved items", robots: { index: false } };

export default async function Saved() {
  const supabase = await createClient();
  const [st, { data: favs }] = await Promise.all([getSettings(), supabase.from("favorites").select("product_id").order("created_at", { ascending: false }).limit(500)]);
  const ids: string[] = ((favs ?? []) as { product_id: string }[]).map((f) => f.product_id);
  const { data } = ids.length
    ? await supabase.from("products_public").select("*").in("id", ids)
    : { data: [] as Product[] };
  const order = new Map<string, number>(ids.map((id, i) => [id, i]));
  const products = ((data ?? []) as Product[]).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  if (!products.length) return (
    <div className="empty" style={{ textAlign: "left" }}>
      <h3>Nothing saved yet</h3>
      <p>Tap ♡ Save on any product to keep track of cards you want. We&apos;ll show their price and stock here.</p>
      <p><Link className="btn" href="/finder">Find a card</Link></p>
    </div>
  );
  return <ProductGrid products={products} lowAt={Number(st.lowStock) || 3} />;
}
