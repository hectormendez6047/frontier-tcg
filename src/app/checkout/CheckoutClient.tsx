"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useCart } from "@/components/CartProvider";
import { useCartProducts } from "@/components/useCartProducts";
import { EmptyState } from "@/components/EmptyState";
import { effectivePrice, money } from "@/lib/format";
import { cancelCheckout, payOrder, startCheckout } from "./actions";

type Settings = {
  shippingEnabled: boolean; shippingFlat: number; freeShippingOver: number; pickupEnabled: boolean; pickupFee: number;
  envelopeEnabled: boolean; envelopePrice: number; envelopeMax: number; taxEnabled: boolean; taxRate: number; taxShipping: boolean;
};
type Prefill = { email: string; name: string; phone: string; address: { line1: string; line2: string; city: string; state: string; zip: string } | null } | null;
type Method = "ship" | "envelope" | "pickup";

// Minimal types for Square's Web Payments SDK (loaded from Square's CDN).
type SqCard = { attach: (sel: string) => Promise<void>; tokenize: (v?: unknown) => Promise<{ status: string; token?: string; errors?: { message: string }[] }>; destroy: () => Promise<void> };
type SqPayments = { card: (opts?: unknown) => Promise<SqCard> };
declare global { interface Window { Square?: { payments: (appId: string, locationId: string) => SqPayments } } }

const SINGLE_TYPES = ["single", "bulk", "sports"];

export function CheckoutClient({ prefill, ready, open, testMode, appId, locationId, settings: st }: {
  prefill: Prefill; ready: boolean; open: boolean; testMode: boolean; appId: string; locationId: string; settings: Settings;
}) {
  const router = useRouter();
  const { clear } = useCart();
  const { cart, ready: cartReady, products } = useCartProducts();
  const [method, setMethod] = useState<Method>(st.shippingEnabled ? "ship" : st.pickupEnabled ? "pickup" : "ship");
  const [f, setF] = useState({
    email: prefill?.email ?? "", name: prefill?.name ?? "", phone: prefill?.phone ?? "",
    line1: prefill?.address?.line1 ?? "", line2: prefill?.address?.line2 ?? "", city: prefill?.address?.city ?? "",
    state: prefill?.address?.state ?? "TX", zip: prefill?.address?.zip ?? "", note: "",
  });
  const [cardReady, setCardReady] = useState(false);
  const [cardError, setCardError] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const cardRef = useRef<SqCard | null>(null);

  // Load Square's card form.
  useEffect(() => {
    if (!ready || !open || !appId) return;
    let cancelled = false;
    const src = appId.startsWith("sandbox-") ? "https://sandbox.web.squarecdn.com/v1/square.js" : "https://web.squarecdn.com/v1/square.js";
    const init = async () => {
      try {
        if (!window.Square) throw new Error("Square didn't load");
        const payments = window.Square.payments(appId, locationId);
        const card = await payments.card({
          style: {
            input: { backgroundColor: "#0a0a0a", color: "#f4f1ea", fontSize: "16px" },
            "input::placeholder": { color: "#6f6a61" },
            ".input-container": { borderColor: "#3a362f", borderRadius: "4px" },
            ".input-container.is-focus": { borderColor: "#C39443" },
            ".message-text": { color: "#a39d91" }, ".message-icon": { color: "#a39d91" },
          },
        });
        if (cancelled) { await card.destroy(); return; }
        await card.attach("#card-container");
        cardRef.current = card;
        setCardReady(true);
      } catch {
        setCardError("The card form couldn't load. Check your connection, turn off ad blockers for this page, and refresh.");
      }
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
    if (existing && window.Square) init();
    else {
      const s = existing ?? Object.assign(document.createElement("script"), { src, async: true });
      s.addEventListener("load", init, { once: true });
      s.addEventListener("error", () => setCardError("The card form couldn't load. Please refresh the page."), { once: true });
      if (!existing) document.head.appendChild(s);
    }
    return () => { cancelled = true; cardRef.current?.destroy().catch(() => {}); cardRef.current = null; };
  }, [ready, open, appId, locationId]);

  if (!cartReady || products === null) return <div className="wrap"><div className="page-head"><h1>Checkout</h1></div><div className="skeleton" style={{ height: 200, margin: "24px 0 64px" }} /></div>;
  const lines = products.filter((p) => cart[p.id] && p.available_quantity > 0).map((p) => ({ p, q: Math.min(cart[p.id], p.available_quantity) }));
  if (!lines.length) return <div className="wrap"><div className="page-head"><h1>Checkout</h1></div><div style={{ padding: "24px 0 64px" }}><EmptyState title="Your cart is empty"><p><Link className="btn gold" href="/finder">Find a card</Link></p></EmptyState></div></div>;

  const sub = lines.reduce((s, l) => s + effectivePrice(l.p) * l.q, 0);
  const envelopeOk = st.envelopeEnabled && sub <= st.envelopeMax && lines.every((l) => SINGLE_TYPES.includes(l.p.product_type));
  const m: Method = method === "pickup" && !st.pickupEnabled ? "ship" : method === "envelope" && !envelopeOk ? "ship" : method;
  const ship = m === "ship" ? (st.freeShippingOver > 0 && sub >= st.freeShippingOver ? 0 : st.shippingFlat) : m === "envelope" ? st.envelopePrice : 0;
  const fee = m === "pickup" ? st.pickupFee : 0;
  const taxed = st.taxEnabled && (m === "pickup" || /^(tx|texas)$/i.test(f.state.trim()));
  const tax = taxed ? Math.round((sub + (st.taxShipping ? ship + fee : 0)) * st.taxRate) / 100 : 0;
  const total = sub + ship + fee + tax;
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  async function placeOrder(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!cardRef.current) return setErr("The card form isn't ready yet.");
    setBusy(true);
    // 1. Hold the items and get the exact total from the server.
    const start = await startCheckout({
      email: f.email, name: f.name, phone: f.phone, fulfillment: m, note: f.note,
      address: { line1: f.line1, line2: f.line2, city: f.city, state: f.state, zip: f.zip },
      items: lines.map((l) => ({ id: l.p.id, qty: l.q })),
    });
    if (!start.ok) { setBusy(false); return setErr(start.error); }
    // 2. Securely read the card (Square handles the card number; it never touches our server).
    const [first, ...rest] = f.name.trim().split(/\s+/);
    const tok = await cardRef.current.tokenize({
      amount: start.total.toFixed(2), currencyCode: "USD", intent: "CHARGE", customerInitiated: true, sellerKeyedIn: false,
      billingContact: { givenName: first, familyName: rest.join(" "), email: f.email, phone: f.phone || undefined,
        ...(m !== "pickup" ? { addressLines: [f.line1, f.line2].filter(Boolean), city: f.city, state: f.state, postalCode: f.zip, countryCode: "US" } : { countryCode: "US" }) },
    }).catch(() => ({ status: "ERROR", errors: [{ message: "" }] } as Awaited<ReturnType<SqCard["tokenize"]>>));
    if (tok.status !== "OK" || !tok.token) {
      await cancelCheckout(start.orderId, start.token);
      setBusy(false);
      return setErr(tok.errors?.[0]?.message || "Please check your card details and try again.");
    }
    // 3. Charge the card and confirm the order.
    const paid = await payOrder(start.orderId, start.token, tok.token);
    if (!paid.ok) { setBusy(false); return setErr(paid.error); }
    clear();
    router.replace(`/order/${paid.orderId}?t=${paid.token}&new=1`);
  }

  return (
    <div className="wrap">
      <div className="page-head"><h1>Checkout</h1></div>
      {!open ? (
        <div style={{ padding: "24px 0 64px" }}><EmptyState title="Online ordering opens soon"><p>Your cart is saved. Check back soon.</p></EmptyState></div>
      ) : (
      <div className="cart">
        <form id="coForm" style={{ display: "flex", flexDirection: "column", gap: 24 }} onSubmit={placeOrder}>
          {testMode && ready && (
            <div className="notice"><b>Test mode.</b> No real money is charged. Use the test card 4111 1111 1111 1111, any future date, CVV 111 and ZIP 12345.</div>
          )}
          <div>
            <h3 style={{ marginBottom: 12 }}>Delivery</h3>
            <div style={{ display: "grid", gap: 10 }}>
              {st.shippingEnabled && (
                <label className="opt">
                  <input type="radio" name="m" value="ship" checked={m === "ship"} onChange={() => setMethod("ship")} />
                  <span><b>Tracked shipping</b><br /><span className="muted" style={{ fontSize: 14 }}>{money(st.shippingFlat)} with tracking{st.freeShippingOver > 0 ? ` · free over ${money(st.freeShippingOver)}` : ""}</span></span>
                </label>
              )}
              {st.envelopeEnabled && (
                <label className="opt" style={!envelopeOk ? { opacity: .5 } : undefined}>
                  <input type="radio" name="m" value="envelope" checked={m === "envelope"} disabled={!envelopeOk} onChange={() => setMethod("envelope")} />
                  <span><b>Card envelope (no tracking)</b><br /><span className="muted" style={{ fontSize: 14 }}>{money(st.envelopePrice)} · single cards only, orders up to {money(st.envelopeMax)}{!envelopeOk ? ". Not available for this cart." : ""}</span></span>
                </label>
              )}
              {st.pickupEnabled && (
                <label className="opt">
                  <input type="radio" name="m" value="pickup" checked={m === "pickup"} onChange={() => setMethod("pickup")} />
                  <span><b>Local pickup in Laredo</b><br /><span className="muted" style={{ fontSize: 14 }}>{money(st.pickupFee)} pickup processing fee. We&apos;ll email you when it&apos;s ready.</span></span>
                </label>
              )}
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: 12 }}>Contact{m !== "pickup" ? " and shipping address" : ""}</h3>
            {!prefill && <p className="muted" style={{ margin: "0 0 12px", fontSize: 14 }}>Have an account? <Link href="/login?next=/checkout">Sign in</Link> to use your saved address and see this order in your account.</p>}
            <div className="form">
              <div className="fld s3"><label htmlFor="coName">Full name</label><input id="coName" required autoComplete="name" value={f.name} onChange={set("name")} /></div>
              <div className="fld s3"><label htmlFor="coPhone">Phone</label><input id="coPhone" autoComplete="tel" inputMode="tel" value={f.phone} onChange={set("phone")} /></div>
              <div className="fld"><label htmlFor="coEmail">Email (for your receipt)</label><input id="coEmail" type="email" required autoComplete="email" value={f.email} onChange={set("email")} /></div>
              {m !== "pickup" && (<>
                <div className="fld"><label htmlFor="coAddr">Street address</label><input id="coAddr" required autoComplete="address-line1" value={f.line1} onChange={set("line1")} /></div>
                <div className="fld"><label htmlFor="coAddr2">Apt, suite (optional)</label><input id="coAddr2" autoComplete="address-line2" value={f.line2} onChange={set("line2")} /></div>
                <div className="fld s2"><label htmlFor="coCity">City</label><input id="coCity" required autoComplete="address-level2" value={f.city} onChange={set("city")} /></div>
                <div className="fld s2"><label htmlFor="coState">State</label><input id="coState" required autoComplete="address-level1" maxLength={20} value={f.state} onChange={set("state")} /></div>
                <div className="fld s2"><label htmlFor="coZip">ZIP</label><input id="coZip" required autoComplete="postal-code" inputMode="numeric" value={f.zip} onChange={set("zip")} /></div>
              </>)}
              <div className="fld"><label htmlFor="coNote">Order note (optional)</label><textarea id="coNote" maxLength={500} value={f.note} onChange={set("note")} style={{ minHeight: 60 }} /></div>
            </div>
          </div>

          <div>
            <h3 style={{ marginBottom: 12 }}>Payment</h3>
            {!ready ? (
              <div className="notice"><b>Online payment isn&apos;t connected yet.</b> No order is placed and no card is charged.</div>
            ) : (<>
              <div id="card-container" style={{ minHeight: 90 }} />
              {!cardReady && !cardError && <p className="muted" style={{ fontSize: 14, margin: 0 }}>Loading secure card form…</p>}
              {cardError && <p className="err" role="alert">{cardError}</p>}
              <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>Payments are processed securely by Square. We never see or store your full card number.</p>
            </>)}
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
          {m === "pickup" ? <div className="l"><span>Pickup processing</span><span className="num mono">{money(fee)}</span></div>
            : <div className="l"><span>{m === "envelope" ? "Envelope shipping" : "Shipping"}</span><span className="num mono">{ship ? money(ship) : "Free"}</span></div>}
          <div className="l"><span>Sales tax{taxed ? ` (${st.taxRate}%)` : ""}</span><span className="num mono">{taxed ? money(tax) : m === "pickup" ? money(0) : "—"}</span></div>
          <div className="l tot"><span>Total</span><span>{money(total)}</span></div>
          {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
          <button className="btn gold" type="submit" form="coForm" disabled={!ready || !cardReady || busy}>
            {busy ? "Processing…" : `Pay ${money(total)}`}
          </button>
          <span className="muted" style={{ fontSize: 13 }}>Texas orders and pickups include sales tax. Your card is charged when you click Pay.</span>
        </aside>
      </div>
      )}
    </div>
  );
}
