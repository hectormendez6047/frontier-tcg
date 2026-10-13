"use client";
import Link from "next/link";
import Image from "next/image";
import { useCart } from "@/components/CartProvider";
import { useCartProducts } from "@/components/useCartProducts";
import { AddToCart, QtyStepper } from "@/components/AddToCart";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/EmptyState";
import { effectivePrice, productPhoto, metaLine, money } from "@/lib/format";

export default function CartPage() {
  const { setQty, remove } = useCart();
  const router = useRouter();
  const [asked, setAsked] = useState(false);
  const { cart, ready, products, settings, error, protect } = useCartProducts({ protect: true });
  const lines = (products ?? []).filter((p) => cart[p.id]).map((p) => ({ p, q: cart[p.id], a: p.available_quantity }));
  const sub = lines.reduce((s, l) => s + effectivePrice(l.p) * Math.min(l.q, l.a), 0);
  const hasCards = lines.some(({ p }) => ["single", "bulk", "sports"].includes(p.product_type) && !p.grader);
  const hasProtection = lines.some(({ p }) => protect.some((x) => x.id === p.id) || (p.product_type === "accessory" && ["sleeves", "top_loaders", "one_touch"].includes(p.product_kind ?? "")));
  const offer = hasCards && !hasProtection && protect.length > 0;
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
          {offer && asked ? (
            <div className="protect" role="dialog" aria-label="Protect your cards">
              <b>Protect your cards?</b>
              <p className="muted">Add sleeves or top loaders to keep your new cards safe.</p>
              {protect.map((x) => (
                <div className="prow" key={x.id}>
                  <div><Link href={`/p/${x.slug}`}>{x.name}</Link><div className="meta">{money(effectivePrice(x))}</div></div>
                  <div className="padd"><AddToCart id={x.id} name={x.name} available={x.available_quantity} compact /></div>
                </div>
              ))}
              <button className="btn gold" type="button" onClick={() => router.push("/checkout")}>Continue to checkout</button>
            </div>
          ) : (
            <button className="btn gold" type="button" onClick={() => (offer && !asked ? setAsked(true) : router.push("/checkout"))}>Checkout</button>
          )}
          <Link className="btn" href="/finder">Keep shopping</Link>
        </aside>
      </div>
    </div>
  );
}
