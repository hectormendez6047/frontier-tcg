import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getViewer, hasRole } from "@/lib/auth";
import { OrderView, fmtDate, type OrderItemRow, type OrderRow } from "@/components/OrderView";
import { OrderActions } from "./OrderActions";

export const metadata = { title: "Order" };

export default async function AdminOrder({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [viewer, { data: o }, { data: items }, { data: events }] = await Promise.all([
    getViewer(),
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id),
    supabase.from("order_events").select("*").eq("order_id", id).order("created_at"),
  ]);
  if (!o) notFound();
  const order = o as OrderRow;
  const pull = ((items ?? []) as (OrderItemRow & { bin: string | null })[])
    .slice().sort((a, b) => (a.bin ?? "~").localeCompare(b.bin ?? "~", undefined, { numeric: true }) || a.name.localeCompare(b.name));
  return (
    <>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <Link className="btn sm" href="/admin/orders">← Orders</Link>
        <Link className="btn sm" href={`/admin/orders/${id}/slip`}>Packing slip</Link>
      </div>
      <OrderActions order={order} isAdmin={!!viewer && hasRole(viewer.role, "admin")} />
      <div className="panel">
        <h3>Customer</h3>
        <dl className="spec" style={{ margin: 0, border: 0, padding: 0 }}>
          <dt>Name</dt><dd>{order.full_name}</dd>
          <dt>Email</dt><dd style={{ userSelect: "all" }}>{order.email}</dd>
          {order.phone && (<><dt>Phone</dt><dd style={{ userSelect: "all" }}>{order.phone}</dd></>)}
          {order.customer_note && (<><dt>Their note</dt><dd>{order.customer_note}</dd></>)}
          {order.payment_id && (<><dt>Square payment</dt><dd className="mono" style={{ fontSize: 13 }}>{order.payment_id}</dd></>)}
        </dl>
      </div>
      <div className="panel">
        <h3>Pull list</h3>
        <div className="tscroll"><table className="at" style={{ minWidth: 0 }}>
          <thead><tr><th style={{ textAlign: "left" }}>Bin</th><th style={{ textAlign: "left" }}>Qty</th><th style={{ textAlign: "left" }}>Item</th><th style={{ textAlign: "left" }}>SKU</th></tr></thead>
          <tbody>{pull.map((i) => (
            <tr key={i.id}><td className="mono" style={{ color: "var(--gold)", fontWeight: 700 }}>{i.bin ?? "—"}</td><td>{i.quantity}</td><td>{i.name}{i.details ? <span className="muted"> · {i.details}</span> : null}</td><td className="mono" style={{ fontSize: 12 }}>{i.sku}</td></tr>
          ))}</tbody>
        </table></div>
        {pull.some((i) => !i.bin) && <p className="muted" style={{ fontSize: 13, margin: "10px 0 0" }}>Items without a bin don&apos;t have one saved on the product. Add it under Products → Edit → Bin / batch.</p>}
      </div>
      <OrderView o={order} items={(items ?? []) as OrderItemRow[]} />
      <div className="panel" style={{ marginTop: 20 }}>
        <h3>History</h3>
        <ul className="log" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {((events ?? []) as { id: number; status: string | null; note: string | null; actor_email: string | null; created_at: string }[]).map((e) => (
            <li key={e.id}><time>{fmtDate(e.created_at)}</time>
              <span>{e.status ? <b style={{ fontWeight: 600 }}>{e.status.replace(/_/g, " ")}</b> : null}{e.status && e.note ? " · " : ""}{e.note}{e.actor_email ? <span className="muted"> · {e.actor_email}</span> : null}</span></li>
          ))}
        </ul>
      </div>
    </>
  );
}
