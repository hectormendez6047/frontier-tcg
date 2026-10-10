"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { issueReward, saveCatalogItem, voidReward } from "../../actions";
import { money } from "@/lib/format";

export type CatalogItem = {
  id: string; name: string; description: string | null; kind: "amount_off" | "percent_off" | "free_item";
  value: number | null; item: string | null; points_cost: number; max_issued: number | null; issued_count: number;
  expires_days: number | null; active: boolean;
};
type Member = { id: string; name: string; phone: string | null; points: number };
type Issued = { id: string; code: string; status: string; issued_at: string; expires_at: string | null; redeemed_at: string | null; reward_id: string; member_id: string };

export const rewardLabel = (r: Pick<CatalogItem, "kind" | "value" | "item">) =>
  r.kind === "amount_off" ? `${money(r.value)} off` : r.kind === "percent_off" ? `${Number(r.value)}% off` : `Free: ${r.item}`;

const blank = { name: "", description: "", kind: "free_item", value: "", item: "", points_cost: "0", max_issued: "", expires_days: "", active: true };
const date = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : "");

export function CatalogManager({ items, members, recent, isAdmin }: { items: CatalogItem[]; members: Member[]; recent: Issued[]; isAdmin: boolean }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Record<string, unknown> | null>(null);
  const [err, setErr] = useState("");
  const [giving, setGiving] = useState<string>(items.find((i) => i.active)?.id ?? "");
  const [who, setWho] = useState<"some" | "all">("some");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const byId = useMemo(() => Object.fromEntries(items.map((i) => [i.id, i])), [items]);
  const memberName = useMemo(() => Object.fromEntries(members.map((m) => [m.id, m.name])), [members]);
  const reward = byId[giving];
  const left = reward?.max_issued != null ? Math.max(reward.max_issued - reward.issued_count, 0) : null;
  const shown = members.filter((m) => !q || (m.name + " " + (m.phone ?? "")).toLowerCase().includes(q.toLowerCase())).slice(0, 200);
  const set = (k: string, v: unknown) => setEdit((e) => (e ? { ...e, [k]: v } : e));
  const val = (k: string) => (edit?.[k] == null ? "" : String(edit[k]));

  async function give() {
    if (!reward) return setMsg({ t: "Choose a reward to give.", err: true });
    setBusy(true); setMsg(null);
    const r = await issueReward(reward.id, who === "all" ? { all: true } : { memberIds: [...picked] }, note);
    setBusy(false);
    if (!r.ok) return setMsg({ t: r.error, err: true });
    const n = r.data!.count;
    const target = who === "all" ? members.length : picked.size;
    setMsg({ t: n < target ? `Gave “${reward.name}” to ${n} member${n === 1 ? "" : "s"}. ${target - n} didn't get it (limit reached or not enough points).` : `Gave “${reward.name}” to ${n} member${n === 1 ? "" : "s"}. Each one has a code to show at the register.` });
    setPicked(new Set()); setNote(""); router.refresh();
  }

  return (
    <>
      <div className="panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Rewards you can give</h3>
          {isAdmin && !edit && <button className="btn gold sm" type="button" onClick={() => { setErr(""); setEdit({ ...blank }); }}>New reward</button>}
        </div>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 14.5 }}>
          Set up coupons and freebies once, then give them to one member, a few, or everyone. A reward can cost points or be free, and you can cap how many are given out.
        </p>

        {edit && (
          <form className="form" style={{ marginBottom: 18, paddingBottom: 18, borderBottom: "1px solid var(--line)" }} onSubmit={async (e) => {
            e.preventDefault(); setErr("");
            const r = await saveCatalogItem(edit);
            if (!r.ok) return setErr(r.error);
            setEdit(null); router.refresh();
          }}>
            <div className="fld s3"><label htmlFor="rc-name">Name *</label><input id="rc-name" placeholder="Free Pitch Black pack" value={val("name")} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="fld s3"><label htmlFor="rc-kind">Type</label>
              <select id="rc-kind" value={val("kind")} onChange={(e) => set("kind", e.target.value)}>
                <option value="free_item">Free item</option><option value="amount_off">Dollars off</option><option value="percent_off">Percent off</option>
              </select></div>
            {val("kind") === "free_item"
              ? <div className="fld"><label htmlFor="rc-item">What they get *</label><input id="rc-item" placeholder="Pitch Black sleeved booster pack" value={val("item")} onChange={(e) => set("item", e.target.value)} /></div>
              : <div className="fld s2"><label htmlFor="rc-value">{val("kind") === "percent_off" ? "Percent off *" : "Dollars off *"}</label><input id="rc-value" type="number" min={0} step={val("kind") === "percent_off" ? "1" : "0.01"} value={val("value")} onChange={(e) => set("value", e.target.value)} /></div>}
            <div className="fld s2"><label htmlFor="rc-pts">Points cost (0 = free to give)</label><input id="rc-pts" type="number" min={0} step={1} value={val("points_cost")} onChange={(e) => set("points_cost", e.target.value)} /></div>
            <div className="fld s2"><label htmlFor="rc-max">Limit (blank = no limit)</label><input id="rc-max" type="number" min={1} step={1} placeholder="e.g. 25" value={val("max_issued")} onChange={(e) => set("max_issued", e.target.value)} /></div>
            <div className="fld s2"><label htmlFor="rc-exp">Expires after (days)</label><input id="rc-exp" type="number" min={1} step={1} placeholder="Never" value={val("expires_days")} onChange={(e) => set("expires_days", e.target.value)} /></div>
            <div className="fld"><label htmlFor="rc-desc">Note for staff (optional)</label><input id="rc-desc" placeholder="Launch week giveaway, one per member" value={val("description")} onChange={(e) => set("description", e.target.value)} /></div>
            <div className="fld s3" style={{ justifyContent: "flex-end" }}>
              <label className="check" style={{ font: "inherit", textTransform: "none", letterSpacing: 0, color: "var(--fg)", minHeight: 42 }}>
                <input type="checkbox" checked={!!edit.active} onChange={(e) => set("active", e.target.checked)} /> Active (can be given out)
              </label></div>
            {err && <p className="err" role="alert" style={{ gridColumn: "span 6", margin: 0 }}>{err}</p>}
            <div className="fld" style={{ flexDirection: "row", gap: 10 }}>
              <button className="btn gold" type="submit">Save reward</button>
              <button className="btn" type="button" onClick={() => setEdit(null)}>Cancel</button>
            </div>
          </form>
        )}

        {items.length ? (
          <div className="tscroll"><table className="at" style={{ minWidth: 640 }}>
            <thead><tr><th>Reward</th><th>Gives</th><th style={{ textAlign: "right" }}>Points</th><th>Given out</th><th>Status</th><th></th></tr></thead>
            <tbody>{items.map((r) => (
              <tr key={r.id}>
                <td><b style={{ fontWeight: 600 }}>{r.name}</b>{r.description && <div className="muted" style={{ fontSize: 12.5 }}>{r.description}</div>}</td>
                <td>{rewardLabel(r)}{r.expires_days ? <div className="muted" style={{ fontSize: 12.5 }}>Expires {r.expires_days} days after it&apos;s given</div> : null}</td>
                <td className="mono num" style={{ textAlign: "right" }}>{r.points_cost || "Free"}</td>
                <td className="mono num">{r.issued_count}{r.max_issued != null ? ` / ${r.max_issued}` : ""}</td>
                <td><span className={`pill ${r.active ? "active" : "archived"}`}>{r.active ? "Active" : "Off"}</span></td>
                <td>{isAdmin && <button className="btn sm" type="button" onClick={() => { setErr(""); setEdit({ ...r, value: r.value ?? "", max_issued: r.max_issued ?? "", expires_days: r.expires_days ?? "", description: r.description ?? "", item: r.item ?? "" }); }}>Edit</button>}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted" style={{ margin: 0 }}>No rewards set up yet.</p>}
      </div>

      <div className="panel">
        <h3>Give a reward</h3>
        <div className="form">
          <div className="fld s3"><label htmlFor="g-reward">Reward</label>
            <select id="g-reward" value={giving} onChange={(e) => setGiving(e.target.value)}>
              <option value="">Choose…</option>
              {items.filter((i) => i.active).map((i) => <option key={i.id} value={i.id}>{i.name} ({rewardLabel(i)}{i.points_cost ? `, ${i.points_cost} pts` : ""})</option>)}
            </select></div>
          <div className="fld s3"><label htmlFor="g-note">Note (optional)</label><input id="g-note" placeholder="Thanks for coming to league night" value={note} onChange={(e) => setNote(e.target.value)} /></div>
        </div>
        {reward && (
          <p className="muted" style={{ fontSize: 14, margin: "10px 0 0" }}>
            {reward.points_cost ? `Costs ${reward.points_cost} points. Members without enough points are skipped.` : "No points needed."}{" "}
            {left != null ? `${left} of ${reward.max_issued} left to give.` : "No limit."}
          </p>
        )}
        <div style={{ display: "flex", gap: 16, margin: "14px 0", flexWrap: "wrap" }}>
          <label className="check"><input type="radio" name="who" checked={who === "some"} onChange={() => setWho("some")} /> Choose members</label>
          <label className="check"><input type="radio" name="who" checked={who === "all"} onChange={() => setWho("all")} /> Every member ({members.length}){left != null && left < members.length ? ` (only the first ${left} will get it)` : ""}</label>
        </div>
        {who === "some" && (
          <>
            <input type="search" aria-label="Search members" placeholder="Search members by name or phone" value={q} onChange={(e) => setQ(e.target.value)}
              style={{ width: "100%", height: 38, border: "1px solid var(--line-2)", background: "var(--surface)", borderRadius: "var(--r)", padding: "0 11px", marginBottom: 8 }} />
            <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid var(--line)", borderRadius: "var(--r)" }}>
              {shown.length ? shown.map((m) => (
                <label key={m.id} className="check" style={{ padding: "8px 12px", borderBottom: "1px solid var(--line)", justifyContent: "space-between" }}>
                  <span style={{ display: "flex", gap: 9, alignItems: "center" }}>
                    <input type="checkbox" checked={picked.has(m.id)} onChange={() => setPicked((s) => { const n = new Set(s); if (n.has(m.id)) n.delete(m.id); else n.add(m.id); return n; })} />
                    {m.name} <span className="muted" style={{ fontSize: 13 }}>{m.phone}</span>
                  </span>
                  <span className="mono muted" style={{ fontSize: 13 }}>{m.points} pts</span>
                </label>
              )) : <p className="muted" style={{ padding: 12, margin: 0 }}>{members.length ? "No members match." : "Add members on the Members tab first."}</p>}
            </div>
          </>
        )}
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginTop: 14, flexWrap: "wrap" }}>
          <button className="btn gold" type="button" disabled={busy || !reward || (who === "some" && !picked.size)} onClick={give}>
            {busy ? "Giving…" : who === "all" ? "Give to every member" : `Give to ${picked.size || ""} member${picked.size === 1 ? "" : "s"}`}
          </button>
          {msg && <span className={msg.err ? "err" : ""} style={msg.err ? undefined : { color: "var(--ok)" }} role="status">{msg.t}</span>}
        </div>
      </div>

      <div className="panel">
        <h3>Recently given</h3>
        {recent.length ? (
          <div className="tscroll"><table className="at" style={{ minWidth: 600 }}>
            <thead><tr><th>Code</th><th>Member</th><th>Reward</th><th>Given</th><th>Status</th><th></th></tr></thead>
            <tbody>{recent.map((x) => {
              const expired = x.status === "available" && x.expires_at && new Date(x.expires_at) < new Date();
              return (
                <tr key={x.id}>
                  <td className="mono">{x.code}</td>
                  <td><Link href={`/admin/rewards/${x.member_id}`} style={{ textDecoration: "none" }}>{memberName[x.member_id] ?? "Member"}</Link></td>
                  <td>{byId[x.reward_id]?.name ?? ""}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{date(x.issued_at)}</td>
                  <td><span className={`pill ${x.status === "available" && !expired ? "active" : "archived"}`}>{expired ? "Expired" : x.status === "available" ? "Ready to use" : x.status === "redeemed" ? `Used ${date(x.redeemed_at)}` : "Cancelled"}</span></td>
                  <td>{x.status === "available" && <button className="btn sm" type="button" onClick={async () => { const r = await voidReward(x.id); if (!r.ok) setMsg({ t: r.error, err: true }); router.refresh(); }}>Cancel</button>}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <p className="muted" style={{ margin: 0 }}>Nothing given out yet.</p>}
      </div>
    </>
  );
}
