"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { sendNewsletter, sendTest } from "./actions";
import { EMAIL_TOPICS } from "@/lib/constants";

export function Composer({ counts, enabled }: { counts: Record<string, number>; enabled: boolean }) {
  const router = useRouter();
  const [c, setC] = useState({ topic: "promotions", subject: "", heading: "", body: "", buttonLabel: "Shop now", buttonUrl: "https://frontiertcgshop.com/shop" });
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const n = counts[c.topic] ?? 0;
  const set = (k: keyof typeof c) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => { setC({ ...c, [k]: e.target.value }); setConfirm(false); };

  return (
    <div className="panel">
      <h3>Send a newsletter</h3>
      <p className="muted" style={{ margin: "0 0 14px", fontSize: 14.5 }}>
        Goes only to people who opted in to the topic you pick, from their account or the sign-up form. Every email includes an unsubscribe link and your store address, as the law requires.
      </p>
      <div className="form">
        <div className="fld s3"><label htmlFor="nl-topic">Topic</label>
          <select id="nl-topic" value={c.topic} onChange={set("topic")}>
            {EMAIL_TOPICS.map(([k, l]) => <option key={k} value={k}>{l} ({counts[k] ?? 0})</option>)}
          </select></div>
        <div className="fld s3"><label htmlFor="nl-subject">Subject line</label><input id="nl-subject" value={c.subject} onChange={set("subject")} placeholder="Pitch Black is in stock" /></div>
        <div className="fld"><label htmlFor="nl-heading">Headline (optional)</label><input id="nl-heading" value={c.heading} onChange={set("heading")} placeholder="New set, fresh singles" /></div>
        <div className="fld"><label htmlFor="nl-body">Message (leave a blank line between paragraphs)</label>
          <textarea id="nl-body" value={c.body} onChange={set("body")} style={{ minHeight: 180 }} placeholder={"Pitch Black singles and sealed are live on the site.\n\nBooster boxes are limited to 2 per customer."} /></div>
        <div className="fld s2"><label htmlFor="nl-blabel">Button text (optional)</label><input id="nl-blabel" value={c.buttonLabel} onChange={set("buttonLabel")} /></div>
        <div className="fld s4"><label htmlFor="nl-burl">Button link</label><input id="nl-burl" value={c.buttonUrl} onChange={set("buttonUrl")} /></div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
        <button className="btn" type="button" disabled={!enabled || busy} onClick={async () => {
          setBusy(true); setMsg(null); const r = await sendTest(c); setBusy(false);
          setMsg(r.ok ? { t: "Test sent to your email. Check how it looks before sending to everyone." } : { t: r.error, err: true });
        }}>Send me a test</button>
        <button className="btn gold" type="button" disabled={!enabled || busy || !n} onClick={async () => {
          if (!confirm) return setConfirm(true);
          setBusy(true); setMsg(null); const r = await sendNewsletter(c, n); setBusy(false); setConfirm(false);
          if (!r.ok) return setMsg({ t: r.error, err: true });
          setMsg({ t: `Sent to ${r.sent} people.${r.failed ? ` ${r.failed} couldn't be sent (your Resend plan's daily limit may have been reached).` : ""}` });
          router.refresh();
        }}>{busy ? "Sending…" : confirm ? `Yes, send to ${n} people` : `Send to ${n} ${n === 1 ? "person" : "people"}`}</button>
        {confirm && <button className="btn sm" type="button" onClick={() => setConfirm(false)}>Cancel</button>}
      </div>
      {confirm && <p className="err" style={{ margin: "10px 0 0" }}>This emails {n} people now and can&apos;t be undone. Did you send yourself a test first?</p>}
      {msg && <p className={msg.err ? "err" : ""} style={{ margin: "10px 0 0", color: msg.err ? undefined : "var(--ok)" }} role="status">{msg.t}</p>}
      {!enabled && <p className="muted" style={{ fontSize: 14, margin: "10px 0 0" }}>Sending turns on once email is connected.</p>}
    </div>
  );
}
