"use client";
import Link from "next/link";
import { useState } from "react";
import { useCartProducts } from "@/components/useCartProducts";
import { EmptyState } from "@/components/EmptyState";
import { effectivePrice, money } from "@/lib/format";

export default function CheckoutPage() {
  const { cart, ready, products, settings } = useCartProducts();
  const [method, setMethod] = useState<"ship" | "pickup">("ship");
  if (!ready || products === null || !settings) return <div className="wrap"><div className="page-head"><h1>Checkout</h1></div><div className="skeleton" style={{ height: 200, margin: "24px 0 64px" }} /></div>;

  const lines = products.filter((p) => cart[p.id] && p.available_quantity > 0).map((p) => ({ p, q: Math.min(cart[p.id], p.available_quantity) }));
  if (!lines.length) return <div className="wrap"><div className="page-head"><h1>Checkout</h1></div><div style={{ padding: "24px 0 64px" }}><EmptyState title="Your cart is empty"><p><Link className="btn gold" href="/finder">Find a card</Link></p></EmptyState></div></div>;

  const m = method === "pickup" && settings.pickupEnabled ? "pickup" : "ship";
  const sub = lines.reduce((s, l) => s + effectivePrice(l.p) * l.q, 0);
  const freeShip = settings.freeShippingOver > 0 && sub >= settings.freeShippingOver;
  const ship = m === "ship" ? (freeShip ? 0 : Number(settings.shippingFlat)) : 0;
  const fee = m === "pickup" ? Number(settings.pickupFee) : 0;
  const total = sub + ship + fee;
  const points = Math.floor(sub * settings.pointsPerDollar);

  return (
    <div className="wrap">
      <div className="page-head"><h1>Checkout</h1></div>
      <div className="cart">
        <form id="coForm" style={{ display: "flex", flexDirection: "column", gap: 24 }} onSubmit={(e) => e.preventDefault()}>
          <div>
            <h3 style={{ marginBottom: 12 }}>Delivery</h3>
            <div style={{ display: "grid", gap: 10 }}>
              <label className="opt">
                <input type="radio" name="m" value="ship" checked={m === "ship"} onChange={() => setMethod("ship")} />
                <span><b>Ship to me</b><br /><span className="muted" style={{ fontSize: 14 }}>{money(settings.shippingFlat)} flat rate{settings.freeShippingOver > 0 ? ` · free over ${money(settings.freeShippingOver)}` : ""}</span></span>
              </label>
              {settings.pickupEnabled && (
                <label className="opt">
                  <input type="radio" name="m" value="pickup" checked={m === "pickup"} onChange={() => setMethod("pickup")} />
                  <span><b>Local pickup in Laredo</b><br /><span className="muted" style={{ fontSize: 14 }}>{money(settings.pickupFee)} pickup processing fee. We&apos;ll email you when it&apos;s ready.</span></span>
                </label>
              )}
            </div>
          </div>
          <div>
            <h3 style={{ marginBottom: 12 }}>Contact{m === "ship" ? " and shipping address" : ""}</h3>
            <div className="form">
              <div className="fld s3"><label htmlFor="coName">Full name</label><input id="coName" required autoComplete="name" /></div>
              <div className="fld s3"><label htmlFor="coPhone">Phone</label><input id="coPhone" autoComplete="tel" /></div>
              <div className="fld"><label htmlFor="coEmail">Email</label><input id="coEmail" type="email" required autoComplete="email" /></div>
              {m === "ship" && (<>
                <div className="fld"><label htmlFor="coAddr">Address</label><input id="coAddr" required autoComplete="street-address" /></div>
                <div className="fld s2"><label htmlFor="coCity">City</label><input id="coCity" required autoComplete="address-level2" /></div>
                <div className="fld s2"><label htmlFor="coState">State</label><input id="coState" required autoComplete="address-level1" defaultValue="TX" /></div>
                <div className="fld s2"><label htmlFor="coZip">ZIP</label><input id="coZip" required autoComplete="postal-code" inputMode="numeric" /></div>
              </>)}
            </div>
          </div>
          <div className="notice">
            <b>Online payment isn&apos;t connected yet.</b> Card payments through Square are the next stage of the build. Until then no order is placed and no card is charged.
          </div>
        </form>
        <aside className="summary">
          <h3>Order summary</h3>
          {lines.map((l) => (
            <div className="l" key={l.p.id}>
              <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.q} × {l.p.name}</span>
              <span className="num mono">{money(effectivePrice(l.p) * l.q)}</span>
            </div>
          ))}
          <div className="l" style={{ borderTop: "1px solid var(--line)", paddingTop: 10 }}><span>Subtotal</span><span className="num mono">{money(sub)}</span></div>
          {m === "ship" ? <div className="l"><span>Shipping</span><span className="num mono">{ship ? money(ship) : "Free"}</span></div>
            : <div className="l"><span>Pickup processing</span><span className="num mono">{money(fee)}</span></div>}
          <div className="l muted"><span>Rewards earned</span><span className="num mono">{points} pts</span></div>
          <div className="l tot"><span>Total</span><span>{money(total)}</span></div>
          <button className="btn gold" type="submit" form="coForm" disabled>Place order</button>
          <span className="muted" style={{ fontSize: 13 }}>Payment opens once Square is connected.</span>
        </aside>
      </div>
    </div>
  );
}
