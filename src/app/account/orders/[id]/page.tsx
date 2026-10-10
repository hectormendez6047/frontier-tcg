import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderView, type OrderItemRow, type OrderRow } from "@/components/OrderView";

export const metadata = { title: "Order", robots: { index: false } };

export default async function AccountOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Only the customer's own orders (staff use the admin order page).
  const { data: o } = await supabase.from("orders").select("*").eq("id", id).eq("user_id", user!.id).maybeSingle();
  if (!o) notFound();
  const { data: items } = await supabase.from("order_items").select("*").eq("order_id", id);
  return (<><Link className="btn sm" href="/account/orders" style={{ marginBottom: 14 }}>← All orders</Link><OrderView o={o as OrderRow} items={(items ?? []) as OrderItemRow[]} /></>);
}
