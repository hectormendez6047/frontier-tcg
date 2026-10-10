"use client";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/components/CartProvider";
import { useCartProducts } from "@/components/useCartProducts";
import { QtyStepper } from "@/components/AddToCart";
import { EmptyState } from "@/components/EmptyState";
import { effectivePrice, productPhoto, metaLine, money } from "@/lib/format";

export default function CartPage() {
  const { setQty, remove } = useCart();
  const { cart, ready, products, settings, error } = useCartProducts();
  const lines = (products ?? []).filter((p) => cart[p.id]).map((p) => ({ p, q: cart[p.id], a: p.available_quantity }));
  const sub = lines.reduce((s, l) => s + effectivePrice(l.p) * Math.min(l.q, l.a), 0);
  const points = Math.floor(sub * (settings?.pointsPerDollar ?? 1));

  if (!ready || (products === null && !error)) return <div className="wrap"><div className="page-head"><h1>Your cart</h1></div><div className="skeleton" style={{ height: 160, margin: "24px 0 64px" }} /></div>;
  if (error) return <div className="wrap"><div className="page-head"><h1>Your cart</h1></div><div style={{ padding: "24px 0 64px" }}><EmptyState title="Couldn't load your cart"><p>Check your connection and refresh the page.</p></EmptyState></div></div>;
  if (!lines.length) return (
    <div className="wrap"><div className="page-head"><h1>Your cart</h1></div>
      <div style={{ padding: "24px 0 64px" }}>
        <EmptyState title="Your cart is empty"><p>Find the card you&apos;re missing in the Card Finder.</p><p><Link className="btn gold" href="/finder">Find a card</Link></p></EmptyState>
      </div>
    </div>
  );

  return (
    <div className="wrap">
      <div className="page-head"><h1>Your cart</h1></div>
      <div className="cart">
        <div className="rows">
          {lines.map(({ p, q, a }) => {
            const photo = productPhoto(p);
            return (
              <div className="lrow" key={p.id}>
                <Link className="th" href={`/p/${p.slug}`} tabIndex={-1} aria-hidden="true">
                  {photo ? <Image src={photo.src} alt="" fill sizes="52px" style={{ objectFit: "cover" }} unoptimized={photo.external} /> : (p.game || "").slice(0, 3).toUpperCase()}
                </Link>
                <div className="info">
                  <Link href={`/p/${p.slug}`}>{p.name}</Link>
                  <div className="meta">{metaLine(p)} · {money(effectivePrice(p))} each</div>
                  {q > a && <div className="meta" style={{ color: "var(--warn)" }}>{a ? `Only ${a} available now. We'll only charge for ${a}.` : "This card just sold out."}</div>}
                </div>
                <div className="pcol"><span className="price">{money(effectivePrice(p) * Math.min(q, a))}</span></div>
                <QtyStepper value={Math.min(q, Math.max(a, 1))} onChange={(n) => setQty(p.id, n)} max={a} min={1} label={`Quantity for ${p.name}`} />
                <button className="btn sm add" type="button" onClick={() => remove(p.id)}>Remove</button>
              </div>
            );
          })}
        </div>
        <aside className="summary">
          <h3>Order summary</h3>
          <div className="l"><span>Subtotal</span><span className="num mono">{money(sub)}</span></div>
          <div className="l muted"><span>Shipping or pickup</span><span>At checkout</span></div>
          <div className="l muted"><span>Rewards earned</span><span className="num mono">{points} pts</span></div>
          <div className="l tot"><span>Total</span><span>{money(sub)}</span></div>
          <Link className="btn gold" href="/checkout">Checkout</Link>
          <Link className="btn" href="/finder">Keep shopping</Link>
        </aside>
      </div>
    </div>
  );
}
