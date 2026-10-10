import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { METHOD_LABEL, STATUS_LABEL, STATUS_TONE, fmtDate } from "@/components/OrderView";
import { squareConfigured, squareEnv } from "@/lib/square";
import { hasAdminKey } from "@/lib/supabase/admin";
import { emailConfigured } from "@/lib/email";

export const metadata = { title: "Orders" };

const TABS: [string, string][] = [["ship", "To ship"], ["pickup", "Pickup"], ["shipped", "Shipped"], ["done", "Completed"], ["refunded", "Refunded"], ["all", "All"]];

export default async function OrdersAdmin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string }> }) {
  const { tab = "ship", q = "" } = await searchParams;
  const supabase = await createClient();
  let query = supabase.from("orders").select("id, number, status, full_name, email, total, created_at, fulfillment, tracking_number")
    .not("status", "in", "(pending,payment_failed)").order("created_at", { ascending: tab === "ship" || tab === "pickup" }).limit(200);
  if (tab === "ship") query = query.in("status", ["paid", "processing"]).in("fulfillment", ["ship", "envelope"]);
  else if (tab === "pickup") query = query.in("status", ["paid", "processing", "ready_for_pickup"]).eq("fulfillment", "pickup");
  else if (tab === "shipped") query = query.eq("status", "shipped");
  else if (tab === "done") query = query.in("status", ["delivered", "completed"]);
  else if (tab === "refunded") query = query.in("status", ["refunded", "cancelled"]);
  const term = q.trim().replace(/[%,()#]/g, " ").trim();
  if (term) query = /^\d+$/.test(term) ? query.eq("number", Number(term)) : query.or(`full_name.ilike.%${term}%,email.ilike.%${term}%`);
  const [{ data }, { data: sales }] = await Promise.all([query, supabase.rpc("admin_sales")]);
  const orders = (data ?? []) as { id: string; number: number; status: string; full_name: string; email: string; total: number; created_at: string; fulfillment: string; tracking_number: string | null }[];
  const s = (sales ?? {}) as Record<string, number>;
  const ready = squareConfigured() && hasAdminKey();
  return (
    <>
      {!ready && <div className="notice" style={{ marginBottom: 16 }}><b>Checkout isn&apos;t connected yet.</b> Add the Square keys and SUPABASE_SERVICE_ROLE_KEY in Vercel to take orders.</div>}
      {ready && squareEnv() === "sandbox" && <div className="notice" style={{ marginBottom: 16 }}><b>Square test mode.</b> Orders here are tests; no real money moves. Switch to production keys before launch.</div>}
      {ready && !emailConfigured() && <div className="notice" style={{ marginBottom: 16 }}>Order emails are off until RESEND_API_KEY is added in Vercel. Orders still work.</div>}
      <div className="kpis">
        <div className="kpi"><div className="k">To ship</div><div className="v" style={{ color: s.to_ship ? "var(--warn)" : undefined }}>{s.to_ship ?? 0}</div></div>
        <div className="kpi"><div className="k">Pickups waiting</div><div className="v">{s.to_pickup ?? 0}</div></div>
        <div className="kpi"><div className="k">Sales today</div><div className="v">{money(s.today)}</div><div className="s">{s.orders_today ?? 0} orders</div></div>
        <div className="kpi"><div className="k">This month</div><div className="v">{money(s.month)}</div></div>
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 14, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
        {TABS.map(([k, l]) => (
          <Link key={k} href={`/admin/orders?tab=${k}`} style={{ padding: "10px 12px", textDecoration: "none", font: "600 14px/1 var(--display)", letterSpacing: ".09em", textTransform: "uppercase",
            color: tab === k ? "var(--fg)" : "var(--muted)", borderBottom: `2px solid ${tab === k ? "var(--gold)" : "transparent"}`, marginBottom: -1 }}>{l}</Link>
        ))}
      </div>
      <form className="tbar" action="/admin/orders">
        <input type="hidden" name="tab" value={tab} />
        <label className="sr" htmlFor="oq">Search orders</label>
        <input type="search" id="oq" name="q" defaultValue={q} placeholder="Order number, name or email" />
        <button className="btn sm" type="submit" style={{ height: 38 }}>Search</button>
      </form>
      {orders.length ? (
        <div className="tscroll"><table className="at" style={{ minWidth: 720 }}>
          <thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Delivery</th><th>Status</th><th style={{ textAlign: "right" }}>Total</th><th></th></tr></thead>
          <tbody>{orders.map((o) => (
            <tr key={o.id}>
              <td className="mono"><Link href={`/admin/orders/${o.id}`} style={{ textDecoration: "none", fontWeight: 600 }}>#{o.number}</Link></td>
              <td>{o.full_name}<div className="muted" style={{ fontSize: 12.5 }}>{o.email}</div></td>
              <td className="mono" style={{ fontSize: 13 }}>{fmtDate(o.created_at)}</td>
              <td style={{ fontSize: 14 }}>{METHOD_LABEL[o.fulfillment]}</td>
              <td><span className={`stock ${STATUS_TONE(o.status)}`}>{STATUS_LABEL[o.status] ?? o.status}</span></td>
              <td className="mono num" style={{ textAlign: "right" }}>{money(o.total)}</td>
              <td><Link className="btn sm" href={`/admin/orders/${o.id}`}>Open</Link></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty"><h3>{tab === "ship" ? "Nothing to ship" : tab === "pickup" ? "No pickups waiting" : "No orders here"}</h3><p>{term ? "Try a different search." : "Paid orders show up here as soon as they come in."}</p></div>}
    </>
  );
}
