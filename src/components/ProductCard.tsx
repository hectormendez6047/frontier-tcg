import Link from "next/link";
import { CardArt } from "./CardArt";
import { Price, Stock } from "./Price";
import { metaLine } from "@/lib/format";
import { PRODUCT_TYPES } from "@/lib/constants";
import type { Product } from "@/lib/types";

export function ProductCard({ p, lowAt }: { p: Product; lowAt: number }) {
  return (
    <Link className="pc" href={`/p/${p.slug}`}>
      <CardArt p={p} path={p.image_path} />
      <div className="nm">{p.name}</div>
      <div className="meta">{metaLine(p) || PRODUCT_TYPES[p.product_type]}</div>
      <div className="row"><Price p={p} /><Stock available={p.available_quantity} lowAt={lowAt} /></div>
    </Link>
  );
}

export function ProductGrid({ products, lowAt }: { products: Product[]; lowAt: number }) {
  return <div className="pgrid">{products.map((p) => <ProductCard key={p.id} p={p} lowAt={lowAt} />)}</div>;
}
