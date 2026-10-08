import { effectivePrice, money, stockState } from "@/lib/format";
import type { Product } from "@/lib/types";

export function Price({ p, big }: { p: Pick<Product, "price" | "sale_price">; big?: boolean }) {
  const eff = effectivePrice(p);
  const onSale = eff < Number(p.price);
  return (
    <span className={big ? "bigprice" : "price"}>
      {money(eff)}
      {onSale && <s>{money(p.price)}</s>}
    </span>
  );
}

export function Stock({ available, lowAt }: { available: number; lowAt: number }) {
  const [state, label] = stockState(available, lowAt);
  return <span className={`stock ${state}`}>{label}</span>;
}
