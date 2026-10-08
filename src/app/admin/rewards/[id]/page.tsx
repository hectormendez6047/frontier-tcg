import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { getViewer, hasRole } from "@/lib/auth";
import { money } from "@/lib/format";
import { MemberActions } from "../RewardsForms";

export const metadata = { title: "Rewards member" };

export default async function Member({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [st, viewer, { data: m }, { data: tx }] = await Promise.all([
    getSettings(), getViewer(),
    supabase.from("rewards_members").select("*").eq("id", id).maybeSingle(),
    supabase.from("rewards_transactions").select("id, kind, amount, points, note, created_at").eq("member_id", id).order("created_at", { ascending: false }).limit(100),
  ]);
  if (!m) notFound();
  const th = Number(st.rewardThreshold) || 100;
  return (
    <>
      <Link className="btn sm" href="/admin/rewards" style={{ marginBottom: 16 }}>← All members</Link>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <h3 style={{ fontSize: 28, margin: "0 0 4px" }}>{m.name}</h3>
            <div className="muted" style={{ fontSize: 14 }}>{[m.phone, m.email].filter(Boolean).join(" · ") || "No contact info"}</div>
            <div className="muted mono" style={{ fontSize: 12, marginTop: 6 }}>Member since {String(m.created_at).slice(0, 10)} · {m.lifetime_earned} earned · {m.lifetime_redeemed} redeemed</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div className="mono muted" style={{ fontSize: 11.5, letterSpacing: ".12em", textTransform: "uppercase" }}>Points balance</div>
            <div className="mono num" style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.1 }}>{Number(m.points).toLocaleString()}</div>
            <div className="muted" style={{ fontSize: 13.5 }}>
              {m.points >= th ? <span style={{ color: "var(--ok)" }}>{Math.floor(m.points / th)} × {money(st.rewardAmount)} reward ready</span> : `${th - m.points} more points for ${money(st.rewardAmount)} off`}
            </div>
          </div>
        </div>
      </div>
      <MemberActions memberId={m.id} name={m.name} points={m.points} threshold={th} rewardAmount={Number(st.rewardAmount)}
        pointsPerDollar={Number(st.pointsPerDollar)} canDelete={!!viewer && hasRole(viewer.role, "admin")} />
      <div className="panel" style={{ marginTop: 20 }}>
        <h3>History</h3>
        {tx?.length ? (
          <ul className="log" style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {(tx as { id: string; kind: string; amount: number | null; points: number; note: string | null; created_at: string }[]).map((t) => (
              <li key={t.id}>
                <time>{new Date(t.created_at).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</time>
                <span style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <span>{t.kind === "purchase" ? `Purchase of ${money(t.amount)}` : t.kind === "redeem" ? `Redeemed ${money(t.amount)} off` : t.note || "Adjustment"}</span>
                  <b className="mono" style={{ color: t.points >= 0 ? "var(--ok)" : "var(--warn)" }}>{t.points >= 0 ? "+" : ""}{t.points}</b>
                </span>
              </li>
            ))}
          </ul>
        ) : <p className="muted" style={{ margin: 0 }}>No activity yet.</p>}
      </div>
    </>
  );
}
