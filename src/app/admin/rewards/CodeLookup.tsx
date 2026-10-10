"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { redeemRewardCode } from "../actions";

/** At the register: type the customer's reward code to mark it used. */
export function CodeLookup() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="panel">
      <h3>Redeem a reward code</h3>
      <form style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end" }} onSubmit={async (e) => {
        e.preventDefault(); setBusy(true); setMsg(null);
        const r = await redeemRewardCode(code);
        setBusy(false);
        if (!r.ok) return setMsg({ t: r.error, err: true });
        setMsg({ t: `Done. “${r.data!.name}” for ${r.data!.member} is marked as used. Apply it at the register.` });
        setCode(""); router.refresh();
      }}>
        <div className="fld" style={{ flex: 1, minWidth: 180 }}><label htmlFor="rcode">Reward code</label>
          <input id="rcode" placeholder="FT-1A2B3C4D" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} style={{ fontFamily: "var(--mono)" }} /></div>
        <button className="btn gold" type="submit" disabled={busy || code.length < 5}>{busy ? "Checking…" : "Redeem"}</button>
      </form>
      {msg && <p className={msg.err ? "err" : ""} style={{ margin: "10px 0 0", color: msg.err ? undefined : "var(--ok)" }} role="status">{msg.t}</p>}
    </div>
  );
}
