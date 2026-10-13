"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { addOrderNote, refundOrder, setOrderStatus } from "../actions";
import { money } from "@/lib/format";
import type { OrderRow } from "@/components/OrderView";

const CARRIERS = ["USPS", "UPS", "FedEx", "DHL", "Other"];

function carrierLink(carrier: string, tracking: string) {
  const t = encodeURIComponent(tracking.replace(/\s+/g, ""));
  if (!t) return null;
  const c = carrier.toLowerCase();
  if (c === "ups") return `https://www.ups.com/track?tracknum=${t}`;
  if (c === "fedex") return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  if (c === "dhl") return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${t}`;
  if (c === "usps") return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
  return null;
}

/** A gentle check that the number looks like the chosen carrier's format. */
function trackingWarning(carrier: string, tracking: string, envelope: boolean) {
  const t = tracking.replace(/\s+/g, "").toUpperCase();
  if (!t) return envelope ? "" : "There's no tracking number. The customer will be told this shipment has no tracking.";
  if (carrier === "USPS" && !/^(\d{20,22}|[A-Z]{2}\d{9}US)$/.test(t)) return "This doesn't look like a USPS number (usually 20–22 digits, often starting with 92, 93, 94 or 95).";
  if (carrier === "UPS" && !/^1Z[0-9A-Z]{16}$/.test(t)) return "This doesn't look like a UPS number (starts with 1Z and is 18 characters).";
  if (carrier === "FedEx" && !/^(\d{12}|\d{15}|\d{20}|\d{22})$/.test(t)) return "This doesn't look like a FedEx number (usually 12 or 15 digits).";
  return "";
}

export function OrderActions({ order: o, isAdmin }: { order: OrderRow; isAdmin: boolean }) {
  const router = useRouter();
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [carrier, setCarrier] = useState(o.carrier ?? "USPS");
  const [tracking, setTracking] = useState(o.tracking_number ?? "");
  const [notify, setNotify] = useState(true);
  const [note, setNote] = useState("");
  const [confirmShip, setConfirmShip] = useState(false);
  const left = Math.round((Number(o.total) - Number(o.refunded_amount)) * 100) / 100;
  const [refund, setRefund] = useState({ open: false, amount: left.toFixed(2), restock: true, reason: "", confirm: false });

  async function go(status: string, extra: Parameters<typeof setOrderStatus>[2] = {}) {
    setBusy(true); setMsg(null);
    const r = await setOrderStatus(o.id, status, extra);
    setBusy(false);
    if (!r.ok) return setMsg({ t: r.error, err: true });
    setMsg({ t: extra.notify ? (r.emailed ? "Updated and emailed the customer." : "Updated. The email couldn't be sent (email isn't set up yet).") : "Updated." });
    router.refresh();
  }

  const shipping = o.fulfillment !== "pickup";
  const open = ["paid", "processing", "ready_for_pickup", "shipped"].includes(o.status);
  return (
    <div className="panel" style={{ borderColor: ["paid", "processing"].includes(o.status) ? "var(--gold)" : undefined }}>
      <h3>{["paid", "processing"].includes(o.status) ? (shipping ? "Ship this order" : "Get this order ready") : "Update order"}</h3>

      {shipping && ["paid", "processing", "shipped"].includes(o.status) && (
        <form className="form" onSubmit={async (e) => {
          e.preventDefault();
          if (!confirmShip) return setConfirmShip(true);
          await go("shipped", { carrier, tracking, notify });
          setConfirmShip(false);
        }}>
          <div className="fld s2"><label htmlFor="oa-carrier">Carrier</label>
            <select id="oa-carrier" value={carrier} onChange={(e) => { setCarrier(e.target.value); setConfirmShip(false); }}>{CARRIERS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div className="fld s4"><label htmlFor="oa-track">Tracking number {o.fulfillment === "envelope" ? "(envelopes usually have none)" : ""}</label>
            <input id="oa-track" className="mono" value={tracking} onChange={(e) => { setTracking(e.target.value); setConfirmShip(false); }} placeholder="9400 1000 0000 0000 0000 00" /></div>
          {confirmShip ? (() => {
            const link = carrierLink(carrier, tracking);
            const warn = trackingWarning(carrier, tracking, o.fulfillment === "envelope");
            return (
              <div className="fld" style={{ border: "1px solid var(--gold)", borderRadius: "var(--r)", padding: 14, gap: 10, background: "rgba(195,148,67,.06)" }}>
                <b style={{ fontSize: 17 }}>Is this the right tracking for order #{o.number}?</b>
                <div>Ship to <b>{o.full_name}</b>, {o.ship_city}, {o.ship_state}</div>
                <div className="mono" style={{ fontSize: 20, letterSpacing: ".06em", wordBreak: "break-all" }}>{carrier} · {tracking.trim() || "No tracking"}</div>
                {link && <a href={link} target="_blank" rel="noopener noreferrer">Check this number on {carrier}&apos;s site ↗</a>}
                {warn && <span className="err">{warn}</span>}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <button className="btn gold" type="submit" disabled={busy} aria-busy={busy}>{busy ? "Saving…" : notify ? "Yes, mark shipped and email customer" : "Yes, mark shipped"}</button>
                  <button className="btn" type="button" disabled={busy} aria-busy={busy} onClick={() => setConfirmShip(false)}>No, let me fix it</button>
                </div>
              </div>
            );
          })() : (
            <div className="fld" style={{ flexDirection: "row", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
              <button className="btn gold" type="submit" disabled={busy} aria-busy={busy}>{o.status === "shipped" ? "Update tracking" : "Mark as shipped"}</button>
              <label className="check" style={{ fontSize: 14.5 }}><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email the customer</label>
            </div>
          )}
        </form>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
        {o.status === "paid" && <button className="btn sm" type="button" disabled={busy} aria-busy={busy} onClick={() => go("processing")}>Mark as packing</button>}
        {!shipping && ["paid", "processing"].includes(o.status) && <button className="btn gold sm" type="button" disabled={busy} aria-busy={busy} onClick={() => go("ready_for_pickup", { notify })}>Ready for pickup{notify ? " + email" : ""}</button>}
        {!shipping && o.status === "ready_for_pickup" && <button className="btn gold sm" type="button" disabled={busy} aria-busy={busy} onClick={() => go("completed", { note: "Picked up" })}>Picked up</button>}
        {shipping && o.status === "shipped" && <button className="btn sm" type="button" disabled={busy} aria-busy={busy} onClick={() => go("delivered")}>Mark delivered</button>}
        {!shipping && ["paid", "processing"].includes(o.status) && (
          <label className="check" style={{ fontSize: 14.5 }}><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} /> Email the customer</label>
        )}
      </div>
      {!open && <p className="muted" style={{ margin: "12px 0 0", fontSize: 14 }}>This order is {o.status.replace(/_/g, " ")}.</p>}

      <form style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }} onSubmit={async (e) => {
        e.preventDefault(); const r = await addOrderNote(o.id, note);
        if (!r.ok) return setMsg({ t: r.error, err: true }); setNote(""); router.refresh();
      }}>
        <label className="sr" htmlFor="oa-note">Staff note</label>
        <input id="oa-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Add a staff note (customer won't see it)"
          style={{ flex: 1, minWidth: 200, height: 36, border: "1px solid var(--line-2)", background: "var(--bg)", borderRadius: "var(--r)", padding: "0 10px" }} />
        <button className="btn sm" type="submit" disabled={!note.trim()}>Add note</button>
      </form>

      {isAdmin && o.payment_id && left > 0 && (
        <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--line)" }}>
          {!refund.open ? <button className="btn sm danger" type="button" onClick={() => setRefund({ ...refund, open: true })}>Refund…</button> : (
            <form className="form" onSubmit={async (e) => {
              e.preventDefault();
              if (!refund.confirm) return setRefund({ ...refund, confirm: true });
              setBusy(true); setMsg(null);
              const r = await refundOrder(o.id, Number(refund.amount), refund.restock, refund.reason);
              setBusy(false);
              if (!r.ok) return setMsg({ t: r.error, err: true });
              setRefund({ ...refund, open: false, confirm: false });
              setMsg({ t: "Refund sent through Square." }); router.refresh();
            }}>
              <div className="fld s2"><label htmlFor="rf-amt">Amount (up to {money(left)})</label>
                <input id="rf-amt" type="number" min={0.01} max={left} step="0.01" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value, confirm: false })} /></div>
              <div className="fld s4"><label htmlFor="rf-reason">Reason</label>
                <input id="rf-reason" value={refund.reason} onChange={(e) => setRefund({ ...refund, reason: e.target.value })} placeholder="Out of stock, damaged in shipping…" /></div>
              <div className="fld"><label className="check" style={{ font: "inherit", textTransform: "none", letterSpacing: 0, color: "var(--fg)" }}>
                <input type="checkbox" checked={refund.restock} onChange={(e) => setRefund({ ...refund, restock: e.target.checked })} /> Put the items back in stock</label></div>
              <div className="fld" style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                <button className="btn sm danger" type="submit" disabled={busy} aria-busy={busy}>{refund.confirm ? `Yes, refund ${money(refund.amount)}` : "Refund"}</button>
                <button className="btn sm" type="button" onClick={() => setRefund({ ...refund, open: false, confirm: false })}>Cancel</button>
                {refund.confirm && <span className="err">This sends money back to the customer&apos;s card and can&apos;t be undone.</span>}
              </div>
            </form>
          )}
        </div>
      )}
      {msg && <p className={msg.err ? "err" : ""} style={{ margin: "12px 0 0", color: msg.err ? undefined : "var(--ok)" }} role="status">{msg.t}</p>}
    </div>
  );
}
