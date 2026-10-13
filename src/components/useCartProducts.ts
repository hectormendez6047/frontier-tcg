"use client";
import { useEffect, useState } from "react";
import { useCart } from "./CartProvider";
import type { Product } from "@/lib/types";

export type CartSettings = { shippingEnabled: boolean; shippingFlat: number; freeShippingOver: number; pickupEnabled: boolean; pickupFee: number; pointsPerDollar: number };

/** Loads current prices and stock for the cart from the server, so a stale browser can't change prices. */
export function useCartProducts(opts: { protect?: boolean } = {}) {
  const { cart, ready } = useCart();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [settings, setSettings] = useState<CartSettings | null>(null);
  const [error, setError] = useState(false);
  const [protect, setProtect] = useState<Product[]>([]);
  const key = Object.keys(cart).sort().join(",");
  useEffect(() => {
    if (!ready) return;
    const ids = key ? key.split(",") : [];
    let live = true;
    fetch("/api/cart", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids, protect: !!opts.protect }) })
      .then((r) => r.json())
      .then((d) => { if (live) { setProducts(d.products ?? []); setSettings(d.settings ?? null); setProtect(d.protect ?? []); setError(false); } })
      .catch(() => live && setError(true));
    return () => { live = false; };
  }, [key, ready, opts.protect]);
  return { cart, ready, products, settings, error, protect };
}
