"use client";
import { useState } from "react";
import { useCart } from "./CartProvider";

export function QtyStepper({ value, onChange, max, min = 1, label }: {
  value: number; onChange: (n: number) => void; max: number; min?: number; label: string;
}) {
  const clamp = (n: number) => Math.max(min, Math.min(Math.max(max, min), n));
  return (
    <div className="qty">
      <button type="button" aria-label="Decrease" onClick={() => onChange(clamp(value - 1))}>−</button>
      <input type="number" inputMode="numeric" value={value} min={min} max={max} aria-label={label}
        onChange={(e) => onChange(clamp(parseInt(e.target.value, 10) || min))} />
      <button type="button" aria-label="Increase" onClick={() => onChange(clamp(value + 1))}>+</button>
    </div>
  );
}

export function AddToCart({ id, name, available, compact }: { id: string; name: string; available: number; compact?: boolean }) {
  const { add } = useCart();
  const [qty, setQty] = useState(1);
  const soldOut = available <= 0;
  return (
    <>
      <QtyStepper value={qty} onChange={setQty} max={Math.max(1, available)} label={`Quantity for ${name}`} />
      <button className={`btn gold${compact ? " sm add" : ""}`} type="button" disabled={soldOut} onClick={() => add(id, qty, available, name)}>
        {soldOut ? "Sold out" : compact ? "Add" : "Add to cart"}
      </button>
    </>
  );
}
