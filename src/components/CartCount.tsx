"use client";
import { useCart } from "./CartProvider";

export function CartCount() {
  const { count, ready } = useCart();
  if (!ready || !count) return null;
  return <span className="badge">{count}</span>;
}
