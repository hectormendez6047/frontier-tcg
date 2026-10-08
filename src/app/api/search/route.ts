import { NextResponse } from "next/server";
import { searchProducts } from "@/lib/data";
import { metaLine } from "@/lib/format";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 80) ?? "";
  if (!q.trim()) return NextResponse.json({ results: [] });
  const { products } = await searchProducts({ q, stock: "0" }, { pageSize: 6 });
  return NextResponse.json({
    results: products.map((p) => ({
      slug: p.slug, name: p.name, price: Number(p.price), sale_price: p.sale_price == null ? null : Number(p.sale_price),
      available_quantity: p.available_quantity, meta: metaLine(p),
    })),
  });
}
