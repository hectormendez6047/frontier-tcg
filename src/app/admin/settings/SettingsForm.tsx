"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveSettings } from "../actions";
import type { Settings } from "@/lib/types";

export function SettingsForm({ initial }: { initial: Settings }) {
  const router = useRouter();
  const [s, setS] = useState<Record<string, unknown>>({ ...initial });
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: unknown) => setS((x) => ({ ...x, [k]: v }));
  const t = (k: keyof Settings, label: string, span = 6, type = "text") => (
    <div className={`fld${span === 6 ? "" : " s" + span}`}>
      <label htmlFor={`st-${k}`}>{label}</label>
      <input id={`st-${k}`} type={type} step={type === "number" ? "0.01" : undefined} min={type === "number" ? 0 : undefined}
        value={String(s[k] ?? "")} onChange={(e) => set(k, e.target.value)} />
    </div>
  );
  const b = (k: keyof Settings, label: string) => (
    <div className="fld s3">
      <label className="check" style={{ font: "inherit", textTransform: "none", letterSpacing: 0, color: "var(--fg)", minHeight: 42 }}>
        <input type="checkbox" checked={!!s[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
      </label>
    </div>
  );
  const area = (k: keyof Settings, label: string, h = 90) => (
    <div className="fld"><label htmlFor={`st-${k}`}>{label}</label>
      <textarea id={`st-${k}`} style={{ minHeight: h }} value={String(s[k] ?? "")} onChange={(e) => set(k, e.target.value)} /></div>
  );

  return (
    <form onSubmit={async (e) => {
      e.preventDefault(); setBusy(true); setMsg(null);
      const { pointsPerDollar, rewardThreshold, rewardAmount, ...rest } = s;
      void pointsPerDollar; void rewardThreshold; void rewardAmount;
      const r = await saveSettings(rest);
      setBusy(false);
      setMsg(r.ok ? { t: "Settings saved. The store uses them now." } : { t: r.error, err: true });
      if (r.ok) router.refresh();
    }}>
      <div className="panel" style={{ borderColor: s.siteMode !== "live" ? "var(--gold)" : undefined }}>
        <h3>Store status</h3>
        <div style={{ display: "grid", gap: 10 }}>
          {([
            ["live", "Open", "Everyone can see and shop the store."],
            ["coming_soon", "Coming soon", "Visitors see a coming-soon page. They can still create accounts."],
            ["maintenance", "Maintenance", "Temporarily closes the store with a “Be right back” page. Use this if something needs fixing."],
          ] as const).map(([v, l, d]) => (
            <label key={v} className="opt">
              <input type="radio" name="siteMode" value={v} checked={s.siteMode === v} onChange={() => set("siteMode", v)} />
              <span><b>{l}</b><br /><span className="muted" style={{ fontSize: 14 }}>{d}</span></span>
            </label>
          ))}
        </div>
        <div className="form" style={{ marginTop: 14 }}>
          {area("comingSoonMessage", "Coming-soon message")}
          {area("maintenanceMessage", "Maintenance message")}
        </div>
        <p className="muted" style={{ fontSize: 14, margin: "10px 0 0" }}>Signed-in staff always see the full store. Changes reach every visitor within about 15 seconds.</p>
      </div>
      <div className="panel"><h3>Checkout</h3><div className="form">
        {b("shippingEnabled", "Shipping enabled")}
        {t("shippingFlat", "Tracked shipping rate $", 2, "number")}{t("freeShippingOver", "Free shipping over $ (0 = off)", 2, "number")}
        {b("envelopeEnabled", "Offer envelope shipping (no tracking)")}
        {t("envelopePrice", "Envelope price $", 1, "number")}{t("envelopeMax", "Envelope max order $", 2, "number")}
        {t("orderEmail", "Email new-order alerts to", 6, "email")}
      </div>
        <p className="muted" style={{ fontSize: 14, margin: "10px 0 0" }}>Envelope shipping is only offered for orders of single cards up to the max amount. Leave the alert email blank to skip new-order emails.</p></div>
      <div className="panel" style={{ borderColor: !s.pickupEnabled ? "var(--line)" : undefined }}><h3>Local pickup</h3>
        <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
          {([[true, "On", "Customers can choose pickup at checkout."], [false, "Paused", "Pickup is hidden at checkout. Use this when the pop-up is closed or you're away."]] as const).map(([v, l, d]) => (
            <label key={l} className="opt">
              <input type="radio" name="pickupEnabled" checked={!!s.pickupEnabled === v} onChange={() => set("pickupEnabled", v)} />
              <span><b>{l}</b><br /><span className="muted" style={{ fontSize: 14 }}>{d}</span></span>
            </label>
          ))}
        </div>
        <div className="form">
        {t("pickupPausedNote", "Note shown at checkout while paused (leave empty to show nothing)")}
        {t("pickupFeeLabel", "Fee name customers see", 2)}{t("pickupFee", "Fee $", 2, "number")}{t("pickupFeeFreeOver", "No fee on orders of $ (0 = always charge)", 2, "number")}
        {t("pickupHours", "Pickup hours", 3)}{t("pickupLocation", "Pickup location", 3)}
      </div>
        <p className="muted" style={{ fontSize: 14, margin: "10px 0 0" }}>Shown at checkout, in pickup emails and on the Local Pickup policy page. Customers see the fee explained as “Covers pulling, sorting and bagging your order.”</p></div>
      <div className="panel"><h3>Sales tax</h3><div className="form">
        {b("taxEnabled", "Charge Texas sales tax")}{t("taxRate", "Tax rate %", 2, "number")}{b("taxShipping", "Also tax shipping and pickup fees")}
      </div>
        <p className="muted" style={{ fontSize: 14, margin: "10px 0 0" }}>
          Tax is added to local pickups and orders shipped to Texas addresses. Laredo&apos;s combined rate is 8.25%. Check with your accountant that these settings fit your sales tax permit.
        </p></div>
      <div className="panel"><h3>Inventory</h3><div className="form">
        {t("lowStock", "Low-stock warning at", 2, "number")}
        {t("bulkThreshold", "Bulk price: singles at or under $", 2, "number")}
        {b("autoBulk", "Sort cheap singles into Bulk automatically")}
      </div>
        <p className="muted" style={{ fontSize: 14, margin: "10px 0 0" }}>
          Products at or below the low-stock number show “Only X left” and appear in Needs restock.
          With automatic Bulk on, any single priced at or under the bulk price goes to the Bulk tab when it&apos;s added or its price changes, and moves back to Singles if the price goes up. You can still move a card by hand.
        </p></div>
      <div className="panel"><h3>Rewards</h3><div className="form">{b("rewardsLive", "Show Frontier Rewards to customers")}</div>
        <p className="muted" style={{ fontSize: 14, margin: "10px 0 0" }}>While this is off, customers see “Rewards coming soon”. You can still set up rewards and give them out in Admin → Rewards.</p></div>
      <div className="panel"><h3>Homepage</h3><div className="form">
        {t("heroHeadline", "Headline under the logo")}{area("heroCopy", "Intro text")}{t("announcement", "Announcement banner (leave empty to hide)")}
      </div><p className="muted" style={{ fontSize: 14, margin: "12px 0 0" }}>Choose featured products with “Feature on homepage” when editing a product. Rewards rules are on the Rewards page.</p></div>
      <div className="panel"><h3>Store info</h3><div className="form">
        {t("email", "Email", 3)}{t("phone", "Phone", 3)}{t("address", "Location")}{area("aboutText", "About page text", 140)}
        {t("instagram", "Instagram URL", 2)}{t("facebook", "Facebook URL", 2)}{t("tiktok", "TikTok URL", 2)}
      </div></div>
      <div className="panel"><h3>Policies</h3>
        <p className="muted" style={{ fontSize: 14, margin: "0 0 12px" }}>
          These are the pages linked in the footer. Leave a box empty to go back to the standard text.
          Formatting: a blank line starts a new paragraph, <span className="mono">## </span> starts a heading, <span className="mono">- </span> starts a bullet, and <span className="mono">**words**</span> makes them bold.
          These fill in automatically: <span className="mono">{"{hours}"}</span>, <span className="mono">{"{location}"}</span>, <span className="mono">{"{prepFee}"}</span>, <span className="mono">{"{freeOver}"}</span>.
        </p>
        <div className="form">
          {area("policyReturns", "Returns & Refunds", 220)}{area("policyShipping", "Shipping", 220)}{area("policyPickup", "Local Pickup", 220)}
          {area("policyPrivacy", "Privacy", 220)}{area("policyTerms", "Terms of Service", 220)}
        </div></div>
      {msg && <p className={msg.err ? "err" : ""} style={msg.err ? undefined : { color: "var(--ok)" }} role="status">{msg.t}</p>}
      <button className="btn gold" type="submit" disabled={busy} style={{ marginBottom: 24 }}>{busy ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
