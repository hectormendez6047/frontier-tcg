"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { addMember, deleteMember, rewardsAction, saveSettings } from "../actions";
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
      <p className="muted" style={{ gridColumn: "span 6", margin: 0, fontSize: 14 }}>Preview: {preview}</p>
      <div className="fld" style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
        <button className="btn gold sm" type="submit">Save rules</button>
        {msg && <span className={msg.err ? "err" : "muted"} role="status">{msg.t}</span>}
      </div>
    </form>
  );
}

export function MemberActions({ memberId, points, threshold, rewardAmount, pointsPerDollar, canDelete, name }: {
  memberId: string; points: number; threshold: number; rewardAmount: number; pointsPerDollar: number; canDelete: boolean; name: string;
}) {
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
    setMsg({ t: kind === "redeem" ? `Redeemed. Give the customer $${rewardAmount.toFixed(2)} off at the register.` : "Points updated." });
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
          <div className="eyebrow">Redeem a reward</div>
          <p style={{ margin: 0, fontSize: 15 }}>Uses {threshold} points and gives the customer ${rewardAmount.toFixed(2)} off. Apply the discount at the register.</p>
          <button className={`btn${points >= threshold ? " gold" : ""}`} type="button" disabled={busy || points < threshold} style={{ alignSelf: "flex-start" }} onClick={() => act("redeem", null)}>
            Redeem ${rewardAmount.toFixed(2)} off
          </button>
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
      {canDelete && (confirm ? (
        <div className="confirm">Delete {name} and their points history?
          <button className="btn sm danger" type="button" onClick={async () => { const r = await deleteMember(memberId); if (!r.ok) return setMsg({ t: r.error, err: true }); router.replace("/admin/rewards"); router.refresh(); }}>Delete</button>
          <button className="btn sm" type="button" onClick={() => setConfirm(false)}>Cancel</button></div>
      ) : <button className="btn sm danger" type="button" onClick={() => setConfirm(true)}>Delete member</button>)}
    </>
  );
}
