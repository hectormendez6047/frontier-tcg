import Link from "next/link";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Customers" };

type Row = { id: string; email: string; full_name: string | null; phone: string | null; role: string; marketing_opt_in: boolean; created_at: string; last_sign_in_at: string | null; confirmed: boolean; total: number };
const d = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : "—");

export default async function Customers({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  await requireRole("admin");
  const { q = "", page = "1" } = await searchParams;
  const n = Math.max(1, parseInt(page, 10) || 1);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_customers", { p_search: q.slice(0, 80), p_limit: 100, p_offset: (n - 1) * 100 });
  const rows = (data ?? []) as Row[];
  const total = rows[0]?.total ?? 0;
  const optedIn = rows.filter((r) => r.marketing_opt_in).length;
  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="k">Accounts</div><div className="v">{total}</div>{q && <div className="s">matching “{q}”</div>}</div>
        <div className="kpi"><div className="k">Email opt-ins</div><div className="v">{optedIn}</div><div className="s">on this page</div></div>
      </div>
      <form className="tbar" action="/admin/customers">
        <label className="sr" htmlFor="cq">Search customers</label>
        <input type="search" id="cq" name="q" defaultValue={q} placeholder="Search by email or name" />
        <button className="btn sm" type="submit" style={{ height: 38 }}>Search</button>
      </form>
      {rows.length ? (
        <div className="tscroll"><table className="at" style={{ minWidth: 720 }}>
          <thead><tr><th>Customer</th><th>Role</th><th>Joined</th><th>Last sign-in</th><th>Email confirmed</th><th>Marketing emails</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><b style={{ fontWeight: 600 }}>{r.full_name || "—"}</b><div className="muted" style={{ fontSize: 13 }}>{r.email}{r.phone ? ` · ${r.phone}` : ""}</div></td>
              <td><span className="pill" style={r.role !== "customer" ? { color: "var(--gold)" } : undefined}>{r.role}</span></td>
              <td className="mono" style={{ fontSize: 13 }}>{d(r.created_at)}</td>
              <td className="mono" style={{ fontSize: 13 }}>{d(r.last_sign_in_at)}</td>
              <td>{r.confirmed ? "Yes" : <span style={{ color: "var(--warn)" }}>Not yet</span>}</td>
              <td>{r.marketing_opt_in ? "Opted in" : "No"}</td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty"><h3>No customer accounts yet</h3><p>Accounts appear here as soon as people sign up at /signup.</p></div>}
      {total > 100 && (
        <div className="pager"><span>Page {n} of {Math.ceil(total / 100)}</span>
          <span style={{ display: "flex", gap: 8 }}>
            {n > 1 && <Link className="btn sm" href={`/admin/customers?q=${encodeURIComponent(q)}&page=${n - 1}`}>Previous</Link>}
            {n * 100 < total && <Link className="btn sm" href={`/admin/customers?q=${encodeURIComponent(q)}&page=${n + 1}`}>Next</Link>}
          </span></div>
      )}
    </>
  );
}
