/**
 * Transactional email through Resend (resend.com). If RESEND_API_KEY isn't set, emails are skipped
 * and the store keeps working; customers still see their order on the website.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { money, siteUrl } from "./format";

const FROM = () => process.env.EMAIL_FROM || "Frontier TCG <orders@frontiertcgshop.com>";
export const emailConfigured = () => !!process.env.RESEND_API_KEY;

// ─── Unsubscribe links (signed so nobody can unsubscribe someone else) ───
const secret = () => process.env.EMAIL_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "dev-only";
export const unsubscribeSig = (email: string) => createHmac("sha256", secret()).update(email.trim().toLowerCase()).digest("base64url").slice(0, 32);
export function verifyUnsubscribe(email: string, sig: string) {
  const a = Buffer.from(unsubscribeSig(email)); const b = Buffer.from(sig || "");
  return a.length === b.length && timingSafeEqual(a, b);
}
export const unsubscribeUrl = (email: string) => `${siteUrl()}/unsubscribe?e=${encodeURIComponent(email.trim().toLowerCase())}&s=${unsubscribeSig(email)}`;

async function send(to: string | string[], subject: string, html: string, text: string) {
  if (!emailConfigured()) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM(), to, subject, html, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

export type EmailOrder = {
  id: string; number: number; access_token: string; email: string; full_name: string; fulfillment: string;
  ship_line1: string | null; ship_line2: string | null; ship_city: string | null; ship_state: string | null; ship_zip: string | null;
  subtotal: number; shipping: number; pickup_fee: number; tax: number; total: number;
  carrier?: string | null; tracking_number?: string | null;
  items: { name: string; details: string | null; quantity: number; line_total: number }[];
};

function layout(title: string, body: string, footer = "") {
  return `<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:Helvetica,Arial,sans-serif;color:#f4f1ea">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<div style="font:800 24px/1 Arial Narrow,Arial,sans-serif;letter-spacing:.02em"><span style="color:#C39443">FRONTIER</span> TCG</div>
<h1 style="font:700 22px/1.3 Arial,sans-serif;margin:24px 0 8px">${esc(title)}</h1>${body}
<p style="color:#6f6a61;font-size:12px;margin-top:32px">Frontier TCG · Laredo, Texas · <a style="color:#a39d91" href="${siteUrl()}">frontiertcgshop.com</a></p>${footer}
</div></body></html>`;
}

function itemsTable(o: EmailOrder) {
  const rows = o.items.map((i) => `<tr><td style="padding:8px 0;border-bottom:1px solid #2b2823">${i.quantity} × ${esc(i.name)}<div style="color:#a39d91;font-size:12px">${esc(i.details)}</div></td><td style="padding:8px 0;border-bottom:1px solid #2b2823;text-align:right;white-space:nowrap">${money(i.line_total)}</td></tr>`).join("");
  const line = (l: string, v: number) => `<tr><td style="padding:4px 0;color:#a39d91">${l}</td><td style="padding:4px 0;text-align:right">${money(v)}</td></tr>`;
  return `<table style="width:100%;border-collapse:collapse;font-size:14px;margin:16px 0">${rows}
${line("Subtotal", o.subtotal)}${o.fulfillment === "pickup" ? line("Pickup processing", o.pickup_fee) : line("Shipping", o.shipping)}${o.tax ? line("Sales tax", o.tax) : ""}
<tr><td style="padding:8px 0;font-weight:700">Total</td><td style="padding:8px 0;text-align:right;font-weight:700">${money(o.total)}</td></tr></table>`;
}

const orderLink = (o: EmailOrder) => `${siteUrl()}/order/${o.id}?t=${o.access_token}`;
const addr = (o: EmailOrder) => [o.full_name, o.ship_line1, o.ship_line2, `${o.ship_city ?? ""}, ${o.ship_state ?? ""} ${o.ship_zip ?? ""}`].filter(Boolean).map(esc).join("<br>");

export async function sendOrderConfirmation(o: EmailOrder) {
  const how = o.fulfillment === "pickup"
    ? "<p>We'll email you when your order is ready to pick up at the shop. Bring this email or your order number.</p>"
    : `<p>We'll email you a tracking number when it ships to:</p><p style="color:#d6d1c6">${addr(o)}</p>`;
  const html = layout(`Thanks for your order, ${o.full_name.split(" ")[0]}!`,
    `<p>Order <b>#${o.number}</b> is confirmed and paid.</p>${how}${itemsTable(o)}
     <p><a href="${orderLink(o)}" style="display:inline-block;background:#C39443;color:#120e06;padding:12px 18px;border-radius:4px;text-decoration:none;font-weight:700">View your order</a></p>`);
  const text = `Thanks for your order! Order #${o.number} is confirmed. Total ${money(o.total)}. View it at ${orderLink(o)}`;
  return send(o.email, `Order #${o.number} confirmed · Frontier TCG`, html, text);
}

export function trackingUrl(carrier?: string | null, tracking?: string | null) {
  if (!tracking) return null;
  const t = encodeURIComponent(tracking.replace(/\s+/g, ""));
  const c = (carrier || "").toLowerCase();
  if (c.includes("ups")) return `https://www.ups.com/track?tracknum=${t}`;
  if (c.includes("fedex")) return `https://www.fedex.com/fedextrack/?trknbr=${t}`;
  if (c.includes("dhl")) return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${t}`;
  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${t}`;
}

export async function sendShipped(o: EmailOrder) {
  const url = trackingUrl(o.carrier, o.tracking_number);
  const html = layout(`Order #${o.number} is on its way`,
    `<p>Your order shipped${o.carrier ? ` with ${esc(o.carrier)}` : ""}.</p>
     ${o.tracking_number ? `<p>Tracking number: <b>${esc(o.tracking_number)}</b></p><p><a href="${url}" style="display:inline-block;background:#C39443;color:#120e06;padding:12px 18px;border-radius:4px;text-decoration:none;font-weight:700">Track your package</a></p>` : "<p>This shipment doesn't have tracking.</p>"}
     ${itemsTable(o)}`);
  return send(o.email, `Order #${o.number} has shipped · Frontier TCG`, html, `Order #${o.number} shipped. ${o.tracking_number ? `Tracking: ${o.tracking_number} ${url}` : ""}`);
}

export async function sendReadyForPickup(o: EmailOrder) {
  const html = layout(`Order #${o.number} is ready for pickup`, `<p>Your order is ready at Frontier TCG in Laredo. Bring your order number (#${o.number}) and a photo ID.</p>${itemsTable(o)}`);
  return send(o.email, `Order #${o.number} is ready for pickup · Frontier TCG`, html, `Order #${o.number} is ready for pickup at Frontier TCG.`);
}

export async function sendNewOrderAlert(to: string, o: EmailOrder) {
  const html = layout(`New order #${o.number}`, `<p>${esc(o.full_name)} (${esc(o.email)}) placed an order for <b>${money(o.total)}</b> · ${o.fulfillment === "pickup" ? "Local pickup" : "Ship"}.</p>${itemsTable(o)}
    <p><a href="${siteUrl()}/admin/orders/${o.id}" style="color:#C39443">Open in admin</a></p>`);
  return send(to, `New order #${o.number} · ${money(o.total)}`, html, `New order #${o.number} for ${money(o.total)}.`);
}

export async function sendRefund(o: EmailOrder, amount: number) {
  const full = amount >= Number(o.total) - 0.005;
  const html = layout(`Refund for order #${o.number}`,
    `<p>We've refunded <b>${money(amount)}</b> to the card you used${full ? ", the full amount of your order" : ""}.</p>
     <p>Refunds usually show on your statement within 5–10 business days, depending on your bank.</p>${itemsTable(o)}
     <p><a href="${orderLink(o)}" style="color:#C39443">View your order</a></p>`);
  return send(o.email, `Refund for order #${o.number} · Frontier TCG`, html, `We refunded ${money(amount)} for order #${o.number}. It can take 5-10 business days to appear.`);
}

export async function sendRestock(email: string, p: { name: string; slug: string; price: number; details?: string }) {
  const url = `${siteUrl()}/p/${p.slug}`;
  const html = layout(`${p.name} is back in stock`,
    `<p>Good news: <b>${esc(p.name)}</b>${p.details ? ` (${esc(p.details)})` : ""} is back in stock at ${money(p.price)}.</p>
     <p>Stock is limited and first come, first served.</p>
     <p><a href="${url}" style="display:inline-block;background:#C39443;color:#120e06;padding:12px 18px;border-radius:4px;text-decoration:none;font-weight:700">Get it now</a></p>
     <p style="color:#a39d91;font-size:13px">You asked us to tell you when this was back. This is a one-time alert.</p>`);
  return send(email, `Back in stock: ${p.name}`, html, `${p.name} is back in stock at ${money(p.price)}: ${url}`);
}

// ─── Newsletters ───
export type Campaign = { subject: string; heading: string; body: string; buttonLabel?: string; buttonUrl?: string };

/** Plain text with blank lines between paragraphs → simple, readable HTML. */
export function campaignHtml(c: Campaign, email: string, address: string) {
  const paras = c.body.trim().split(/\n\s*\n/).map((p) => `<p style="font-size:15px;line-height:1.6;color:#d6d1c6">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const button = c.buttonLabel && c.buttonUrl && /^https:\/\//.test(c.buttonUrl)
    ? `<p><a href="${esc(c.buttonUrl)}" style="display:inline-block;background:#C39443;color:#120e06;padding:12px 18px;border-radius:4px;text-decoration:none;font-weight:700">${esc(c.buttonLabel)}</a></p>` : "";
  const footer = `<p style="color:#6f6a61;font-size:12px">${esc(address)}<br>You're getting this because you signed up for Frontier TCG emails. <a style="color:#a39d91" href="${unsubscribeUrl(email)}">Unsubscribe</a> · <a style="color:#a39d91" href="${siteUrl()}/account/emails">Email preferences</a></p>`;
  return layout(c.heading || c.subject, paras + button, footer);
}

/** Send a newsletter in batches of 100. Returns how many were accepted. */
export async function sendCampaign(c: Campaign, recipients: string[], address: string) {
  if (!emailConfigured()) return { sent: 0, failed: recipients.length };
  let sent = 0, failed = 0;
  for (let i = 0; i < recipients.length; i += 100) {
    const chunk = recipients.slice(i, i + 100);
    const payload = chunk.map((to) => ({
      from: FROM(), to, subject: c.subject,
      html: campaignHtml(c, to, address),
      text: `${c.heading || c.subject}\n\n${c.body}\n\n${c.buttonUrl ?? ""}\n\nUnsubscribe: ${unsubscribeUrl(to)}`,
      headers: { "List-Unsubscribe": `<${unsubscribeUrl(to)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
    }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) sent += chunk.length; else failed += chunk.length;
    } catch { failed += chunk.length; }
  }
  return { sent, failed };
}

export async function sendCampaignTest(c: Campaign, to: string, address: string) {
  return send(to, `[Test] ${c.subject}`, campaignHtml(c, to, address), c.body);
}
