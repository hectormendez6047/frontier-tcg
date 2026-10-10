import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { STATUS_LABEL, STATUS_TONE, fmtDate } from "@/components/OrderView";

export const metadata = { title: "Orders", robots: { index: false } };

export default async function Orders() {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("id, number, status, total, created_at, fulfillment")
    .not("status", "in", "(pending,payment_failed)").order("created_at", { ascending: false }).limit(100);
  const orders = (data ?? []) as { id: string; number: number; status: string; total: number; created_at: string; fulfillment: string }[];
  if (!orders.length) return (
    <div className="empty" style={{ textAlign: "left" }}>
      <h3>No orders yet</h3>
      <p>When you order online while signed in, your orders show up here with their status and tracking.</p>
      <p><Link className="btn" href="/finder">Browse the Card Finder</Link></p>
    </div>
  );
  return (
    <div className="tscroll"><table className="at" style={{ minWidth: 520 }}>
      <thead><tr><th>Order</th><th>Placed</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th><th></th></tr></thead>
      <tbody>{orders.map((o) => (
        <tr key={o.id}>
          <td className="mono">#{o.number}</td>
          <td className="mono" style={{ fontSize: 13 }}>{fmtDate(o.created_at)}</td>
          <td><span className={`stock ${STATUS_TONE(o.status)}`}>{STATUS_LABEL[o.status] ?? o.status}</span></td>
          <td className="mono num" style={{ textAlign: "right" }}>{money(o.total)}</td>
          <td><Link className="btn sm" href={`/account/orders/${o.id}`}>View</Link></td>
        </tr>
      ))}</tbody>
    </table></div>
  );
}
