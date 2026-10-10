import Image from "next/image";
import { money, productPhoto } from "@/lib/format";
import { trackingUrl } from "@/lib/email";

export type OrderRow = {
  id: string; number: number; status: string; email: string; full_name: string; phone: string | null; fulfillment: string;
  ship_line1: string | null; ship_line2: string | null; ship_city: string | null; ship_state: string | null; ship_zip: string | null;
  subtotal: number; shipping: number; pickup_fee: number; tax: number; tax_rate: number; total: number; refunded_amount: number;
  card_brand: string | null; card_last4: string | null; receipt_url: string | null; carrier: string | null; tracking_number: string | null;
  customer_note: string | null; internal_note?: string | null; created_at: string; paid_at: string | null; shipped_at: string | null; payment_id?: string | null;
};
export type OrderItemRow = { id: string; name: string; details: string | null; quantity: number; unit_price: number; line_total: number; image_path: string | null; image_url: string | null; sku: string | null; product_id: string | null };

export const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment", payment_failed: "Payment failed", paid: "Paid, preparing", processing: "Being packed",
  ready_for_pickup: "Ready for pickup", shipped: "Shipped", delivered: "Delivered", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded",
};
export const STATUS_TONE = (s: string) => ["shipped", "delivered", "completed", "ready_for_pickup"].includes(s) ? "in" : ["paid", "processing"].includes(s) ? "low" : "out";
export const METHOD_LABEL: Record<string, string> = { ship: "Tracked shipping", envelope: "Envelope (no tracking)", pickup: "Local pickup" };
export const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" }) : "";

export function OrderView({ o, items }: { o: OrderRow; items: OrderItemRow[] }) {
  const track = trackingUrl(o.carrier, o.tracking_number);
  return (
    <div className="cart" style={{ paddingTop: 8 }}>
      <div>
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <h3 style={{ margin: 0 }}>Order #{o.number}</h3>
            <span className={`stock ${STATUS_TONE(o.status)}`}>{STATUS_LABEL[o.status] ?? o.status}</span>
          </div>
          <p className="muted" style={{ margin: "8px 0 0", fontSize: 14 }}>Placed {fmtDate(o.created_at)} · {METHOD_LABEL[o.fulfillment]}</p>
          {o.status === "shipped" && (
            <p style={{ margin: "12px 0 0" }}>
              {o.tracking_number ? <>Tracking {o.carrier ? `(${o.carrier})` : ""}: <a href={track!} target="_blank" rel="noopener noreferrer" style={{ color: "var(--gold)" }}>{o.tracking_number}</a></> : "Shipped without tracking."}
            </p>
          )}
          {o.status === "ready_for_pickup" && <p style={{ margin: "12px 0 0" }}>Your order is ready at Frontier TCG in Laredo. Bring order #{o.number} and a photo ID.</p>}
        </div>
        <div className="rows">
          {items.map((i) => {
            const photo = productPhoto(i);
            return (
              <div className="lrow" key={i.id} style={{ gridTemplateColumns: "52px minmax(0,1fr) auto" }}>
                <div className="th">{photo ? <Image src={photo.src} alt="" fill sizes="52px" style={{ objectFit: "cover" }} unoptimized={photo.external} /> : null}</div>
                <div className="info"><b>{i.name}</b><div className="meta">{[i.details, `${i.quantity} × ${money(i.unit_price)}`].filter(Boolean).join(" · ")}</div></div>
                <div className="pcol"><span className="price">{money(i.line_total)}</span></div>
              </div>
            );
          })}
        </div>
      </div>
      <aside className="summary">
        <div className="l"><span>Subtotal</span><span className="num mono">{money(o.subtotal)}</span></div>
        {o.fulfillment === "pickup" ? <div className="l"><span>Pickup processing</span><span className="num mono">{money(o.pickup_fee)}</span></div>
          : <div className="l"><span>Shipping</span><span className="num mono">{Number(o.shipping) ? money(o.shipping) : "Free"}</span></div>}
        {Number(o.tax) > 0 && <div className="l"><span>Sales tax</span><span className="num mono">{money(o.tax)}</span></div>}
        <div className="l tot"><span>Total</span><span>{money(o.total)}</span></div>
        {Number(o.refunded_amount) > 0 && <div className="l" style={{ color: "var(--warn)" }}><span>Refunded</span><span className="num mono">−{money(o.refunded_amount)}</span></div>}
        {o.card_brand && <div className="l muted"><span>Paid with</span><span>{o.card_brand.replace(/_/g, " ")} ···· {o.card_last4}</span></div>}
        {o.fulfillment !== "pickup" && (
          <div style={{ fontSize: 14, lineHeight: 1.6, borderTop: "1px solid var(--line)", paddingTop: 12 }}>
            <div className="muted mono" style={{ fontSize: 11.5, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 6 }}>Ship to</div>
            {o.full_name}<br />{o.ship_line1}{o.ship_line2 ? `, ${o.ship_line2}` : ""}<br />{o.ship_city}, {o.ship_state} {o.ship_zip}
          </div>
        )}
        {o.receipt_url && <a className="btn sm" href={o.receipt_url} target="_blank" rel="noopener noreferrer">Square receipt</a>}
      </aside>
    </div>
  );
}
