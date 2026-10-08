import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings, getUpcomingEvents } from "@/lib/data";
import { money } from "@/lib/format";
import type { AdminProduct } from "@/lib/types";

export const metadata = { title: "Dashboard" };

export default async function Dashboard() {
  const supabase = await createClient();
  const settings = await getSettings();
  const lowAt = Number(settings.lowStock) || 3;
  const [{ data: stats }, { data: lowRows }, events] = await Promise.all([
    supabase.rpc("admin_stats"),
    supabase.rpc("admin_search_products", { q: "", p_status: "active", p_low: lowAt, p_limit: 12 }),
    getUpcomingEvents(3),
  ]);
  const s = (stats ?? {}) as Record<string, number>;
  const low = ((lowRows ?? []) as { product: AdminProduct; total: number }[]).map((r) => r.product);
  const lowTotal = lowRows?.[0]?.total ?? 0;
  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="k">Active products</div><div className="v">{s.active ?? 0}</div><div className="s">{s.archived ?? 0} archived</div></div>
        <div className="kpi"><div className="k">Units in stock</div><div className="v">{Number(s.units ?? 0).toLocaleString()}</div></div>
        <div className="kpi"><div className="k">Retail value</div><div className="v">{money(s.retail)}</div><div className="s">{Number(s.cost) ? `${money(s.cost)} at cost` : "Add costs to see margin"}</div></div>
        <div className="kpi"><div className="k">Low / out of stock</div><div className="v" style={{ color: lowTotal ? "var(--warn)" : undefined }}>{lowTotal}</div><div className="s">at or below {lowAt}</div></div>
      </div>

      <div className="panel">
        <h3>Needs restock</h3>
        {low.length ? (
          <div className="tscroll"><table className="at" style={{ minWidth: 420 }}>
            <thead><tr><th>Product</th><th>Available</th><th></th></tr></thead>
            <tbody>{low.map((p) => (
              <tr key={p.id}>
                <td>{p.name}<div className="muted mono" style={{ fontSize: 12 }}>{p.sku}</div></td>
                <td className="num mono" style={{ color: p.available_quantity ? "var(--warn)" : "var(--bad)" }}>{p.available_quantity}</td>
                <td><Link className="btn sm" href={`/admin/products/${p.id}`}>Restock</Link></td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted" style={{ margin: 0 }}>Everything is above the low-stock level.</p>}
        {lowTotal > low.length && <p style={{ margin: "12px 0 0" }}><Link href={`/admin/products?low=1`}>See all {lowTotal} →</Link></p>}
      </div>

      <div className="panel">
        <h3>Orders and sales</h3>
        <p className="muted" style={{ margin: 0 }}>Sales totals, today&apos;s orders and new customers appear here once Square checkout is connected (stage 2).</p>
      </div>

      <div className="panel">
        <h3>Rewards and events</h3>
        <p style={{ margin: "0 0 8px" }}>{s.members ?? 0} rewards members holding {Number(s.points ?? 0).toLocaleString()} points.</p>
        <p className="muted" style={{ margin: 0 }}>{events.length ? `Next event: ${events[0].name} on ${events[0].starts_on}.` : "No upcoming events."}</p>
      </div>

      <div className="panel">
        <h3>Quick actions</h3>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link className="btn gold" href="/admin/products/new">Add product</Link>
          <Link className="btn" href="/admin/import">Import CSV</Link>
          <Link className="btn" href="/admin/rewards">Rewards</Link>
          <Link className="btn" href="/admin/settings">Pickup &amp; shipping</Link>
        </div>
      </div>
    </>
  );
}
