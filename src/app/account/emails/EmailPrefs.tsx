"use client";
import { useState } from "react";
import { saveEmailPrefs } from "../actions";
import { EMAIL_TOPICS } from "@/lib/constants";

export function EmailPrefs({ initial }: { initial: Record<string, boolean> }) {
  const [p, setP] = useState<Record<string, boolean>>(initial);
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  return (
    <div className="panel">
      <h3>Email preferences</h3>
      <p className="muted" style={{ margin: "0 0 14px", fontSize: 15 }}>Choose what we can email you about. We&apos;ll always send order receipts and account emails, like password resets.</p>
      <form style={{ display: "grid", gap: 12 }} onSubmit={async (e) => {
        e.preventDefault();
        const r = await saveEmailPrefs(p);
        setMsg(r.ok ? { t: "Saved." } : { t: r.error, err: true });
      }}>
        {EMAIL_TOPICS.map(([k, l]) => (
          <label key={k} className="check"><input type="checkbox" checked={!!p[k]} onChange={(e) => setP({ ...p, [k]: e.target.checked })} /> {l}</label>
        ))}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 6 }}>
          <button className="btn gold sm" type="submit">Save preferences</button>
          <button className="btn sm" type="button" onClick={() => setP({})}>Unsubscribe from all</button>
          {msg && <span className={msg.err ? "err" : ""} style={msg.err ? undefined : { color: "var(--ok)" }} role="status">{msg.t}</span>}
        </div>
      </form>
    </div>
  );
}
