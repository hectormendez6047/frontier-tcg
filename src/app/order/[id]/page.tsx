import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import { OrderView, type OrderItemRow, type OrderRow } from "@/components/OrderView";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Order page reachable from the confirmation email, for guests and signed-in customers alike. */
export default async function OrderPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ t?: string; new?: string }> }) {
  const { id } = await params;
  const { t, new: isNew } = await searchParams;
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(id) || !t || !uuid.test(t) || !hasAdminKey()) notFound();
  const admin = createAdminClient();
  const { data: o } = await admin.from("orders").select("*").eq("id", id).eq("access_token", t).maybeSingle();
  if (!o || o.status === "pending" || o.status === "payment_failed") notFound();
  const { data: items } = await admin.from("order_items").select("*").eq("order_id", id);
  return (
    <div className="wrap">
      <div className="page-head">
        {isNew ? (<>
          <div className="eyebrow">Order confirmed</div>
          <h1>Thank you, {String(o.full_name).split(" ")[0]}!</h1>
          <p>Your order #{o.number} is paid. We sent a receipt to {o.email}. {o.fulfillment === "pickup" ? "We'll email you when it's ready to pick up." : "We'll email your tracking number when it ships."}</p>
        </>) : (<><div className="eyebrow">Your order</div><h1>Order #{o.number}</h1></>)}
      </div>
      <OrderView o={o as OrderRow} items={(items ?? []) as OrderItemRow[]} />
      <p style={{ padding: "8px 0 56px", display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Link className="btn" href="/finder">Keep shopping</Link>
        <Link className="btn" href="/account/orders">My orders</Link>
      </p>
    </div>
  );
}
