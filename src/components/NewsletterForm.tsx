"use client";
import { useState } from "react";

export function NewsletterForm({ source, cta = "Subscribe" }: { source: string; cta?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");
  const [err, setErr] = useState("");
  if (state === "done") return <p style={{ margin: 0, color: "var(--ok)" }} role="status">You&apos;re on the list. Thanks!</p>;
  return (
    <form className="newsletter" onSubmit={async (e) => {
      e.preventDefault(); setState("busy"); setErr("");
      const hp = (e.currentTarget.elements.namedItem("website") as HTMLInputElement | null)?.value ?? "";
      const r = await fetch("/api/subscribe", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, source, website: hp }) })
        .then((x) => x.json()).catch(() => ({ ok: false, error: "Couldn't sign you up. Please try again." }));
      if (r.ok) setState("done"); else { setState("error"); setErr(r.error || "Couldn't sign you up."); }
    }}>
      <label className="sr" htmlFor={`nl-${source}`}>Email</label>
      <input id={`nl-${source}`} type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1 }} />
      <button className="btn gold" type="submit" disabled={state === "busy"}>{state === "busy" ? "…" : cta}</button>
      {err && <span className="err" role="alert" style={{ flexBasis: "100%" }}>{err}</span>}
    </form>
  );
}
