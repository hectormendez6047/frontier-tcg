"use client";
import { useState } from "react";
import { requestStockAlert } from "@/app/p/actions";

export function StockAlert({ productId, defaultEmail }: { productId: string; defaultEmail: string }) {
  const [email, setEmail] = useState(defaultEmail);
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [err, setErr] = useState("");
  if (state === "done") return <p style={{ color: "var(--ok)", margin: "14px 0 0" }} role="status">Done. We&apos;ll email {email} once when it&apos;s back.</p>;
  return (
    <div className="panel" style={{ margin: "18px 0 0", padding: 16 }}>
      <b>Want it when it&apos;s back?</b>
      <p className="muted" style={{ margin: "4px 0 10px", fontSize: 14 }}>We&apos;ll send you one email when this is back in stock.</p>
      <form className="newsletter" onSubmit={async (e) => {
        e.preventDefault(); setState("busy"); setErr("");
        const r = await requestStockAlert(productId, email);
        if (r.ok) setState("done"); else { setState("idle"); setErr(r.error); }
      }}>
        <label className="sr" htmlFor="sa-email">Email</label>
        <input id="sa-email" type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        <button className="btn gold" type="submit" disabled={state === "busy"}>{state === "busy" ? "…" : "Email me"}</button>
        {err && <span className="err" role="alert" style={{ flexBasis: "100%" }}>{err}</span>}
      </form>
    </div>
  );
}
