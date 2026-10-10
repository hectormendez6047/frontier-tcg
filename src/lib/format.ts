import type { Product } from "./types";
import { SPORTS } from "./constants";

export const money = (n: number | string | null | undefined) => "$" + (Number(n) || 0).toFixed(2);

export const effectivePrice = (p: Pick<Product, "price" | "sale_price">) =>
  p.sale_price != null && Number(p.sale_price) < Number(p.price) ? Number(p.sale_price) : Number(p.price);

export const CONDITION_SHORT: Record<string, string> = {
  "Near Mint": "NM", "Lightly Played": "LP", "Moderately Played": "MP", "Heavily Played": "HP", Damaged: "DMG",
};

export const isSports = (p: Pick<Product, "game" | "product_type">) =>
  SPORTS.includes(p.game ?? "") || p.product_type === "sports";

export function metaLine(p: Product): string {
  const parts: string[] = [];
  if (p.grader) parts.push(`${p.grader} ${p.grade ?? ""}`.trim());
  if (isSports(p)) {
    [p.year, p.manufacturer, p.team].forEach((x) => x && parts.push(x));
    if (p.rookie) parts.push("RC");
    if (p.parallel) parts.push(p.parallel);
    if (p.is_insert) parts.push("Insert");
  } else {
    if (p.set_name) parts.push(p.set_name);
    if (p.card_number) parts.push("#" + p.card_number);
    if (p.rarity) parts.push(p.rarity);
  }
  if (p.condition && p.product_type !== "sealed" && p.product_type !== "accessory")
    parts.push(CONDITION_SHORT[p.condition] ?? p.condition);
  return parts.join(" · ");
}

export type StockState = "in" | "low" | "out";
export function stockState(available: number, lowAt: number): [StockState, string] {
  if (available <= 0) return ["out", "Out of stock"];
  if (available <= lowAt) return ["low", `Only ${available} left`];
  return ["in", `${available} in stock`];
}

export function imageUrl(path?: string | null): string | null {
  if (!path) return null;
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${path}`;
}

/** The photo to show for a product: an uploaded photo first, otherwise an outside photo link (e.g. from a TCGplayer export). */
export function productPhoto(p: { image_path?: string | null; image_url?: string | null }): { src: string; external: boolean } | null {
  if (p.image_path) return { src: imageUrl(p.image_path)!, external: false };
  if (p.image_url && /^https:\/\//.test(p.image_url)) return { src: p.image_url, external: true };
  return null;
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || "https://frontiertcgshop.com").replace(/\/$/, "");
