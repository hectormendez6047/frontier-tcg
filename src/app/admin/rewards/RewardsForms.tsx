"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addMember, deleteMember, issueReward, rewardsAction, saveSettings, voidReward } from "../actions";
import { rewardExplainer } from "@/lib/settings";

export function MemberSearch({ initial }: { initial: string }) {
  const router = useRouter();
  const path = usePathname();
  const [q, setQ] = useState(initial);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const h = setTimeout(() => router.replace(q.trim() ? `${path}?q=${encodeURIComponent(q.trim())}` : path, { scroll: false }), 250);
    return () => clearTimeout(h);
  }, [q, path, router]);
  return (
    <div className="tbar">
      <label className="sr" htmlFor="rq">Search members</label>
      <input type="search" id="rq" placeholder="Search by name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} />
    </div>
  );
}

export function AddMemberForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (!open) return <div style={{ marginBottom: 12 }}><button className="btn gold sm" type="button" onClick={() => setOpen(true)} style={{ height: 38 }}>Add member</button></div>;
  return (
    <div className="panel">
      <h3>New member</h3>
      <form className="form" onSubmit={async (e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setBusy(true); setErr("");
        const r = await addMember({ name: f.get("name"), phone: f.get("phone"), email: f.get("email"), start: f.get("start") || 0 });
        setBusy(false);
        if (!r.ok) return setErr(r.error);
        router.push(`/admin/rewards/${r.data!.id}`);
      }}>
        <div className="fld s2"><label htmlFor="mb-name">Name *</label><input id="mb-name" name="name" required autoFocus /></div>
        <div className="fld s2"><label htmlFor="mb-phone">Phone</label><input id="mb-phone" name="phone" inputMode="tel" /></div>
        <div className="fld s2"><label htmlFor="mb-email">Email</label><input id="mb-email" name="email" type="email" /></div>
        <div className="fld s2"><label htmlFor="mb-start">Starting points</label><input id="mb-start" name="start" type="number" min={0} step={1} defaultValue={0} /></div>
        <div className="fld" style={{ flexDirection: "row", gap: 10 }}>
          <button className="btn gold" type="submit" disabled={busy}>{busy ? "Adding…" : "Add member"}</button>
          <button className="btn" type="button" onClick={() => setOpen(false)}>Cancel</button>
        </div>
        {err && <p className="err" role="alert" style={{ gridColumn: "span 6", margin: 0 }}>{err}</p>}
        <p className="muted" style={{ gridColumn: "span 6", margin: 0, fontSize: 13.5 }}>Ask the customer before saving their phone or email. Only store staff can see this list.</p>
      </form>
    </div>
  );
}

export function ProgramForm(props: { pointsPerDollar: number; rewardThreshold: number; rewardAmount: number }) {
  const router = useRouter();
  const [v, setV] = useState({ pointsPerDollar: String(props.pointsPerDollar), rewardThreshold: String(props.rewardThreshold), rewardAmount: String(props.rewardAmount) });
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const preview = rewardExplainer({ pointsPerDollar: Number(v.pointsPerDollar), rewardThreshold: Number(v.rewardThreshold), rewardAmount: Number(v.rewardAmount) });
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      const r = await saveSettings({ pointsPerDollar: v.pointsPerDollar, rewardThreshold: v.rewardThreshold, rewardAmount: v.rewardAmount });
      setMsg(r.ok ? { t: "Rewards rules saved." } : { t: r.error, err: true });
      if (r.ok) router.refresh();
    }}>
      <div className="fld s2"><label htmlFor="rw-ppd">Points earned per $1 spent</label><input id="rw-ppd" type="number" step="0.5" min={0} value={v.pointsPerDollar} onChange={(e) => setV({ ...v, pointsPerDollar: e.target.value })} /></div>
      <div className="fld s2"><label htmlFor="rw-th">Points needed for a reward</label><input id="rw-th" type="number" step={1} min={1} value={v.rewardThreshold} onChange={(e) => setV({ ...v, rewardThreshold: e.target.value })} /></div>
      <div className="fld s2"><label htmlFor="rw-amt">Reward value ($ off)</label><input id="rw-amt" type="number" step="0.01" min={0} value={v.rewardAmount} onChange={(e) => setV({ ...v, rewardAmount: e.target.value })} /></div>
      <p className="muted" style={{ gridColumn: "span 6", margin: 0, fontSize: 14 }}>Preview: {preview} The points needed and reward value here are what customers are told. Set up the matching points reward under Rewards &amp; giveaways.</p>
      <div className="fld" style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <button className="btn gold sm" type="submit">Save rules</button>
        {msg && <span className={msg.err ? "err" : "muted"} role="status">{msg.t}</span>}
      </div>
    </form>
  );
}

type CatalogOpt = { id: string; name: string; label: string; points_cost: number; left: number | null };
type HeldReward = { id: string; code: string; status: string; name: string; label: string; issued_at: string; expires_at: string | null; redeemed_at: string | null };
const shortDate = (s: string | null) => (s ? new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : "");

export function MemberActions({ memberId, points, pointsPerDollar, canDelete, name, catalog, held }: {
  memberId: string; points: number; pointsPerDollar: number; canDelete: boolean; name: string; catalog: CatalogOpt[]; held: HeldReward[];
}) {
  const [giveId, setGiveId] = useState(catalog[0]?.id ?? "");
  const router = useRouter();
  const [amt, setAmt] = useState("");
  const [adj, setAdj] = useState(""), [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const earn = Math.floor((parseFloat(amt) || 0) * pointsPerDollar);

  async function act(kind: "purchase" | "redeem" | "adjust", amount: number | null, n?: string) {
    setBusy(true); setMsg(null);
    const r = await rewardsAction(memberId, kind, amount, n);
    setBusy(false);
    if (!r.ok) return setMsg({ t: r.error, err: true });
    setMsg({ t: "Points updated." });
    setAmt(""); setAdj(""); setNote("");
    router.refresh();
  }

  return (
    <>
      {msg && <p className={msg.err ? "err" : ""} style={msg.err ? undefined : { color: "var(--ok)" }} role="status">{msg.t}</p>}
      <div className="split" style={{ marginBottom: 20 }}>
        <div>
          <div className="eyebrow">Record a purchase</div>
          <form style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }} onSubmit={(e) => { e.preventDefault(); act("purchase", parseFloat(amt)); }}>
            <div className="fld" style={{ flex: 1, minWidth: 120 }}><label htmlFor="tx-amt">Purchase total $</label>
              <input id="tx-amt" type="number" step="0.01" min={0} value={amt} placeholder="0.00" onChange={(e) => setAmt(e.target.value)} /></div>
            <button className="btn gold" type="submit" disabled={busy || earn <= 0}>Add {earn} pts</button>
          </form>
          <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Points are calculated from your rewards rules.</p>
        </div>
        <div>
          <div className="eyebrow">Give a reward</div>
          {catalog.length ? (<>
            <div className="fld"><label htmlFor="give-r">Reward</label>
              <select id="give-r" value={giveId} onChange={(e) => setGiveId(e.target.value)}>
                {catalog.map((c) => <option key={c.id} value={c.id} disabled={c.left === 0}>{c.name} · {c.label}{c.points_cost ? ` · ${c.points_cost} pts` : " · free"}{c.left === 0 ? " · none left" : ""}</option>)}
              </select></div>
            {(() => { const c = catalog.find((x) => x.id === giveId); return c ? (
              <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>{c.points_cost ? (points >= c.points_cost ? `Uses ${c.points_cost} of ${name}'s ${points} points.` : `Needs ${c.points_cost} points. ${name} has ${points}.`) : "No points needed."}{c.left != null ? ` ${c.left} left to give.` : ""}</p>
            ) : null; })()}
            <button className="btn gold" type="button" style={{ alignSelf: "flex-start" }} disabled={busy || !giveId}
              onClick={async () => { setBusy(true); setMsg(null); const r = await issueReward(giveId, { memberIds: [memberId] }); setBusy(false);
                if (!r.ok) return setMsg({ t: r.error, err: true });
                if (!r.data!.count) return setMsg({ t: "That reward has run out.", err: true });
                setMsg({ t: "Reward given. The code is in the list below." }); router.refresh(); }}>Give reward</button>
          </>) : <p className="muted" style={{ margin: 0, fontSize: 14 }}>No active rewards yet. Set them up under Rewards &amp; giveaways.</p>}
        </div>
      </div>
      <div className="panel">
        <h3>Adjust points</h3>
        <form className="form" onSubmit={(e) => { e.preventDefault(); const n = parseInt(adj, 10); if (!n) return setMsg({ t: "Enter a number of points, like 25 or -10.", err: true }); act("adjust", n, note || "Manual adjustment"); }}>
          <div className="fld s2"><label htmlFor="adj-pts">Points (+ or −)</label><input id="adj-pts" type="number" step={1} placeholder="e.g. 25 or -10" value={adj} onChange={(e) => setAdj(e.target.value)} /></div>
          <div className="fld s4"><label htmlFor="adj-note">Reason</label><input id="adj-note" placeholder="Event bonus, correction, returned item…" value={note} onChange={(e) => setNote(e.target.value)} /></div>
          <div className="fld"><button className="btn sm" type="submit" disabled={busy} style={{ alignSelf: "flex-start" }}>Apply adjustment</button></div>
        </form>
      </div>
      <div className="panel">
        <h3>{name}&apos;s rewards</h3>
        {held.length ? (
          <div className="tscroll"><table className="at" style={{ minWidth: 520 }}>
            <thead><tr><th>Code</th><th>Reward</th><th>Given</th><th>Status</th><th></th></tr></thead>
            <tbody>{held.map((h) => {
              const expired = h.status === "available" && h.expires_at && new Date(h.expires_at) < new Date();
              return (
                <tr key={h.id}>
                  <td className="mono">{h.code}</td>
                  <td>{h.name}<div className="muted" style={{ fontSize: 12.5 }}>{h.label}</div></td>
                  <td className="mono" style={{ fontSize: 13 }}>{shortDate(h.issued_at)}{h.expires_at ? <div className="muted">expires {shortDate(h.expires_at)}</div> : null}</td>
                  <td><span className={`pill ${h.status === "available" && !expired ? "active" : "archived"}`}>{expired ? "Expired" : h.status === "available" ? "Ready to use" : h.status === "redeemed" ? `Used ${shortDate(h.redeemed_at)}` : "Cancelled"}</span></td>
                  <td>{h.status === "available" && !expired && (
                    <button className="btn sm" type="button" onClick={async () => { const r = await voidReward(h.id); if (!r.ok) return setMsg({ t: r.error, err: true }); setMsg({ t: "Reward cancelled. Any points spent were returned." }); router.refresh(); }}>Cancel</button>
                  )}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        ) : <p className="muted" style={{ margin: 0 }}>No rewards yet.</p>}
        <p className="muted" style={{ fontSize: 13.5, margin: "10px 0 0" }}>To use a reward at the register, enter its code under Redeem a reward code on the Members tab.</p>
      </div>
      {canDelete && (confirm ? (
        <div className="confirm">Delete {name} and their points history?
          <button className="btn sm danger" type="button" onClick={async () => { const r = await deleteMember(memberId); if (!r.ok) return setMsg({ t: r.error, err: true }); router.replace("/admin/rewards"); router.refresh(); }}>Delete</button>
          <button className="btn sm" type="button" onClick={() => setConfirm(false)}>Cancel</button></div>
      ) : <button className="btn sm danger" type="button" onClick={() => setConfirm(true)}>Delete member</button>)}
    </>
  );
}
