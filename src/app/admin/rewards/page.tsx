import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { money } from "@/lib/format";
import { rewardExplainer } from "@/lib/settings";
import { getViewer, hasRole } from "@/lib/auth";
import { AddMemberForm, MemberSearch, ProgramForm } from "./RewardsForms";

export const metadata = { title: "Rewards" };

type Member = { id: string; name: string; phone: string | null; email: string | null; points: number };

export default async function RewardsAdmin({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const supabase = await createClient();
  const [st, viewer] = await Promise.all([getSettings(), getViewer()]);
  const th = Number(st.rewardThreshold) || 100;
  let query = supabase.from("rewards_members").select("id, name, phone, email, points").order("name").limit(200);
  const term = q.trim().slice(0, 60).replace(/[%,()]/g, " ");
  if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`);
  const [{ data }, { data: stats }] = await Promise.all([query, supabase.rpc("admin_stats")]);
  const members = (data ?? []) as Member[];
  const s = (stats ?? {}) as Record<string, number>;
  const ready = members.filter((m) => m.points >= th).length;

  return (
    <>
      <div className="kpis">
        <div className="kpi"><div className="k">Members</div><div className="v">{s.members ?? 0}</div></div>
        <div className="kpi"><div className="k">Points outstanding</div><div className="v">{Number(s.points ?? 0).toLocaleString()}</div><div className="s">worth about {money((Number(s.points) || 0) / th * Number(st.rewardAmount))}</div></div>
        <div className="kpi"><div className="k">Ready to redeem</div><div className="v">{ready}</div><div className="s">at {th}+ points{term ? " (in this search)" : ""}</div></div>
      </div>

      <AddMemberForm />
      <MemberSearch initial={q} />

      {members.length ? (
        <div className="tscroll"><table className="at" style={{ minWidth: 600 }}>
          <thead><tr><th>Member</th><th>Contact</th><th style={{ textAlign: "right" }}>Points</th><th>Next reward</th><th></th></tr></thead>
          <tbody>{members.map((m) => {
            const pct = Math.min(100, Math.round((m.points / th) * 100));
            const avail = Math.floor(m.points / th);
            return (
              <tr key={m.id}>
                <td><Link href={`/admin/rewards/${m.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>{m.name}</Link></td>
                <td className="muted" style={{ fontSize: 13.5 }}>{[m.phone, m.email].filter(Boolean).join(" · ") || "—"}</td>
                <td className="mono num" style={{ textAlign: "right" }}>{m.points.toLocaleString()}</td>
                <td style={{ minWidth: 150 }}>
                  {avail > 0 ? <span className="stock in">{avail} reward{avail > 1 ? "s" : ""} ready</span> : (<>
                    <div style={{ height: 6, background: "var(--line)", borderRadius: 3, overflow: "hidden" }}><div style={{ width: `${pct}%`, height: "100%", background: "var(--gold)" }} /></div>
                    <div className="muted mono" style={{ fontSize: 11.5, marginTop: 4 }}>{th - m.points} pts to go</div>
                  </>)}
                </td>
                <td><Link className="btn sm" href={`/admin/rewards/${m.id}`}>Open</Link></td>
              </tr>
            );
          })}</tbody>
        </table></div>
      ) : (
        <div className="empty"><h3>{term ? "No members match" : "No rewards members yet"}</h3>
          <p>{term ? "Try a different name or phone number." : "Add a customer when they sign up at the register, then record their purchases to earn points."}</p></div>
      )}

      <div className="panel" style={{ marginTop: 24 }}>
        <h3>How Frontier Rewards works</h3>
        <p style={{ margin: "0 0 18px", fontSize: 15.5, color: "#d6d1c6", maxWidth: "64ch" }}>{rewardExplainer(st)}</p>
        {viewer && hasRole(viewer.role, "admin")
          ? <ProgramForm pointsPerDollar={st.pointsPerDollar} rewardThreshold={st.rewardThreshold} rewardAmount={st.rewardAmount} />
          : <p className="muted" style={{ margin: 0, fontSize: 14 }}>Only owners and admins can change these rules.</p>}
      </div>
    </>
  );
}
