import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import { emailConfigured } from "@/lib/email";
import { EMAIL_TOPICS } from "@/lib/constants";
import { fmtDate } from "@/components/OrderView";
import { Composer } from "./Composer";

export const metadata = { title: "Emails" };

export default async function Emails() {
  await requireRole("admin");
  const supabase = await createClient();
  const counts: Record<string, number> = {};
  if (hasAdminKey()) {
    const admin = createAdminClient();
    const res = await Promise.all(EMAIL_TOPICS.map(([k]) => admin.rpc("email_audience", { p_topic: k })));
    EMAIL_TOPICS.forEach(([k], i) => { counts[k] = (res[i].data ?? []).length; });
  }
  const [{ data: campaigns }, { count: subs }, { count: alerts }] = await Promise.all([
    supabase.from("email_campaigns").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("newsletter_subscribers").select("id", { count: "exact", head: true }).is("unsubscribed_at", null),
    supabase.from("stock_alerts").select("id", { count: "exact", head: true }).is("notified_at", null),
  ]);
  const on = emailConfigured();
  return (
    <>
      {!on && (
        <div className="notice" style={{ marginBottom: 16 }}>
          <b>Email isn&apos;t connected yet.</b> Until RESEND_API_KEY is added in Vercel, no emails go out: no receipts, shipping or refund emails, newsletters or back-in-stock alerts. Everything else keeps working.
        </div>
      )}
      <div className="kpis">
        <div className="kpi"><div className="k">Email status</div><div className="v" style={{ fontSize: 22, color: on ? "var(--ok)" : "var(--warn)" }}>{on ? "Connected" : "Not set up"}</div></div>
        <div className="kpi"><div className="k">Newsletter sign-ups</div><div className="v">{subs ?? 0}</div><div className="s">without an account</div></div>
        <div className="kpi"><div className="k">Waiting for restock</div><div className="v">{alerts ?? 0}</div><div className="s">alerts sent automatically</div></div>
      </div>

      <div className="panel">
        <h3>Automatic emails</h3>
        <dl className="spec" style={{ margin: 0, border: 0, padding: 0 }}>
          <dt>Order confirmation</dt><dd>Receipt with items, totals and a link to the order, right after payment</dd>
          <dt>Shipped</dt><dd>Carrier and tracking link, when you mark an order shipped with “Email the customer” ticked</dd>
          <dt>Ready for pickup</dt><dd>When you mark a pickup order ready</dd>
          <dt>Refund</dt><dd>Amount refunded, whenever you refund an order</dd>
          <dt>Back in stock</dt><dd>One email to each person who asked, when a sold-out product gets stock again</dd>
          <dt>New order alert</dt><dd>To the address in Settings → Checkout, for every new order</dd>
          <dt>Account emails</dt><dd>Sign-up confirmation and password reset, sent by Supabase (needs the SMTP step in the setup guide)</dd>
        </dl>
      </div>

      <Composer counts={counts} enabled={on} />

      <div className="panel">
        <h3>Sent newsletters</h3>
        {campaigns?.length ? (
          <div className="tscroll"><table className="at" style={{ minWidth: 560 }}>
            <thead><tr><th>Sent</th><th>Subject</th><th>Topic</th><th style={{ textAlign: "right" }}>Delivered</th><th>By</th></tr></thead>
            <tbody>{(campaigns as { id: string; created_at: string; subject: string; topic: string; sent_count: number; failed: number; sent_by_email: string | null }[]).map((c) => (
              <tr key={c.id}>
                <td className="mono" style={{ fontSize: 13 }}>{fmtDate(c.created_at)}</td>
                <td>{c.subject}</td>
                <td>{EMAIL_TOPICS.find(([k]) => k === c.topic)?.[1] ?? c.topic}</td>
                <td className="mono num" style={{ textAlign: "right" }}>{c.sent_count}{c.failed ? <span style={{ color: "var(--bad)" }}> ({c.failed} failed)</span> : null}</td>
                <td className="muted" style={{ fontSize: 13 }}>{c.sent_by_email}</td>
              </tr>
            ))}</tbody>
          </table></div>
        ) : <p className="muted" style={{ margin: 0 }}>No newsletters sent yet.</p>}
      </div>
    </>
  );
}
