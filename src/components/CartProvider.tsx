"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type Cart = Record<string, number>;
type Toast = { msg: string; err?: boolean } | null;
type Ctx = {
  cart: Cart;
  count: number;
  ready: boolean;
  add: (id: string, qty: number, available: number, name: string) => void;
  setQty: (id: string, qty: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  toast: (msg: string, err?: boolean) => void;
};

const CartCtx = createContext<Ctx | null>(null);
const KEY = "ftcg-cart-v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart>({});
  const [ready, setReady] = useState(false);
  const [t, setT] = useState<Toast>(null);

  useEffect(() => {
    try { setCart(JSON.parse(localStorage.getItem(KEY) || "{}") || {}); } catch { /* storage unavailable */ }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(KEY, JSON.stringify(cart)); } catch { /* storage unavailable */ }
  }, [cart, ready]);
  useEffect(() => {
    if (!t) return;
    const h = setTimeout(() => setT(null), 2600);
    return () => clearTimeout(h);
  }, [t]);

  const toast = useCallback((msg: string, err?: boolean) => setT({ msg, err }), []);

  const add = useCallback((id: string, qty: number, available: number, name: string) => {
    setCart((c) => {
      const have = c[id] || 0;
      if (available <= 0) { setT({ msg: "This card just sold out.", err: true }); return c; }
      const next = Math.min(available, have + Math.max(1, qty));
      if (next === have) { setT({ msg: `Only ${available} available, and they're all in your cart.`, err: true }); return c; }
      setT({ msg: `Added ${next - have} × ${name}` });
      return { ...c, [id]: next };
    });
  }, []);
  const setQty = useCallback((id: string, qty: number) => setCart((c) => {
    const n = { ...c };
    if (qty > 0) n[id] = qty; else delete n[id];
    return n;
  }), []);
  const remove = useCallback((id: string) => setCart((c) => { const n = { ...c }; delete n[id]; return n; }), []);
  const clear = useCallback(() => setCart({}), []);

  const value = useMemo<Ctx>(() => ({
    cart, ready, count: Object.values(cart).reduce((a, b) => a + b, 0), add, setQty, remove, clear, toast,
  }), [cart, ready, add, setQty, remove, clear, toast]);

  return (
    <CartCtx.Provider value={value}>
      {children}
      <div aria-live="polite">{t && <div className={`toast${t.err ? " err" : ""}`}>{t.msg}</div>}</div>
    </CartCtx.Provider>
  );
}

export function useCart() {
  const c = useContext(CartCtx);
  if (!c) throw new Error("useCart must be used inside CartProvider");
  return c;
}
