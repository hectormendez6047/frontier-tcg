import Link from "next/link";
import Image from "next/image";
import { AddToCart } from "./AddToCart";
import { Price, Stock } from "./Price";
import { imageUrl, metaLine } from "@/lib/format";
import type { Product } from "@/lib/types";

/** Dense list row used by Card Finder and Bulk: built for scanning and adding quickly. */
export function ProductRow({ p, lowAt }: { p: Product; lowAt: number }) {
  const src = imageUrl(p.image_path);
  return (
    <div className="lrow">
      <Link className="th" href={`/p/${p.slug}`} tabIndex={-1} aria-hidden="true">
        {src ? <Image src={src} alt="" fill sizes="52px" style={{ objectFit: "cover" }} /> : (p.game || "").slice(0, 3).toUpperCase()}
      </Link>
      <div className="info">
        <Link href={`/p/${p.slug}`}>{p.name}</Link>
        {p.is_demo && <span className="pill" style={{ marginLeft: 6 }}>Demo</span>}
        <div className="meta">{[p.game, metaLine(p)].filter(Boolean).join(" · ")}</div>
      </div>
      <div className="pcol"><Price p={p} /><Stock available={p.available_quantity} lowAt={lowAt} /></div>
      <AddToCart id={p.id} name={p.name} available={p.available_quantity} compact />
    </div>
  );
}
