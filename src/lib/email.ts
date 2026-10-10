/**
 * Transactional email through Resend (resend.com). If RESEND_API_KEY isn't set, emails are skipped
 * and the store keeps working; customers still see their order on the website.
 */
import { money, siteUrl } from "./format";

const FROM = () => process.env.EMAIL_FROM || "Frontier TCG <orders@frontiertcgshop.com>";
export const emailConfigured = () => !!process.env.RESEND_API_KEY;

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

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#0a0a0a;font-family:Helvetica,Arial,sans-serif;color:#f4f1ea">
<div style="max-width:560px;margin:0 auto;padding:28px 20px">
<div style="font:800 24px/1 Arial Narrow,Arial,sans-serif;letter-spacing:.02em"><span style="color:#C39443">FRONTIER</span> TCG</div>
<h1 style="font:700 22px/1.3 Arial,sans-serif;margin:24px 0 8px">${esc(title)}</h1>${body}
<p style="color:#6f6a61;font-size:12px;margin-top:32px">Frontier TCG · Laredo, Texas · <a style="color:#a39d91" href="${siteUrl()}">frontiertcgshop.com</a></p>
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
