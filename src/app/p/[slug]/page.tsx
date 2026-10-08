import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelated, getSettings } from "@/lib/data";
import { effectivePrice, imageUrl, isSports, metaLine, siteUrl } from "@/lib/format";
import { PRODUCT_TYPES } from "@/lib/constants";
import { CardArt } from "@/components/CardArt";
import { Gallery } from "@/components/Gallery";
import { Price, Stock } from "@/components/Price";
import { AddToCart } from "@/components/AddToCart";
import { ProductGrid } from "@/components/ProductCard";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const r = await getProductBySlug(slug);
  if (!r) return { title: "Product not found" };
  const p = r.product;
  const desc = p.description || `${p.name}${metaLine(p) ? " — " + metaLine(p) : ""}. In stock at Frontier TCG, Laredo, Texas.`;
  const img = imageUrl(r.images[0]?.path);
  return {
    title: `${p.name}${p.set_name ? " · " + p.set_name : ""}`,
    description: desc.slice(0, 160),
    alternates: { canonical: `/p/${p.slug}` },
    openGraph: { title: p.name, description: desc.slice(0, 160), images: img ? [img] : ["/logo.png"], type: "website" },
  };
}

export default async function ProductPage({ params }: Props) {
  const { slug } = await params;
  const [r, settings] = await Promise.all([getProductBySlug(slug), getSettings()]);
  if (!r) notFound();
  const { product: p, images } = r;
  const related = await getRelated(p);
  const lowAt = Number(settings.lowStock) || 3;
  const sp = isSports(p);
  const rows: [string, string | null | undefined][] = [
    ["Game", p.game], ["Type", PRODUCT_TYPES[p.product_type]], ["Set", p.set_name], ["Card number", p.card_number ? "#" + p.card_number : ""],
    ["Rarity", p.rarity], ["Player", p.player], ["Team", p.team], ["Year", p.year], ["Manufacturer", p.manufacturer],
    ["Rookie", p.rookie ? "Yes" : ""], ["Parallel", p.parallel], ["Insert", p.is_insert ? "Yes" : ""], ["Finish", p.holo ? "Holo" : ""],
    ["Language", p.language], ["Condition", p.condition], ["SKU", p.sku],
  ];
  const back: [string, string] = p.product_type === "bulk" ? ["/bulk", "Bulk"] : p.product_type === "sealed" ? ["/shop/sealed", "Sealed"]
    : p.game === "Pokémon" ? ["/shop/pokemon", "Pokémon"] : sp ? ["/shop/sports", "Sports Cards"] : ["/shop", "Shop"];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: p.name,
    sku: p.sku,
    description: p.description || metaLine(p),
    image: images.map((i) => imageUrl(i.path)),
    brand: p.manufacturer || p.game || "Frontier TCG",
    offers: {
      "@type": "Offer",
      url: `${siteUrl()}/p/${p.slug}`,
      priceCurrency: "USD",
      price: effectivePrice(p).toFixed(2),
      availability: p.available_quantity > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: p.condition === "Sealed" || p.condition === "New" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition",
    },
  };

  return (
    <div className="wrap">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="crumbs"><Link href="/shop">Shop</Link> / <Link href={back[0]}>{back[1]}</Link> / {p.name}</div>
      <div className="pdp">
        {images.length ? <Gallery images={images} name={p.name} isDemo={p.is_demo} /> : <CardArt p={p} path={null} priority />}
        <div>
          <div className="eyebrow">{p.game || PRODUCT_TYPES[p.product_type]}</div>
          <h1>{p.name}</h1>
          <div className="muted mono" style={{ fontSize: 14 }}>{metaLine(p)}</div>
          <div><Price p={p} big /></div>
          <div style={{ marginTop: 12 }}><Stock available={p.available_quantity} lowAt={lowAt} /></div>
          <div className="buy"><AddToCart id={p.id} name={p.name} available={p.available_quantity} /></div>
          {p.description && <div className="prose" style={{ marginTop: 24 }}><p>{p.description}</p></div>}
          <dl className="spec">
            {rows.filter(([, v]) => v).map(([k, v]) => (<div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>))}
          </dl>
          {p.is_demo && <p className="muted" style={{ fontSize: 14 }}>This is a demo product used to test the store. It isn&apos;t real inventory.</p>}
        </div>
      </div>
      {related.length > 0 && (
        <section style={{ paddingBottom: 56 }}>
          <div className="sec-head"><h2>More {p.game || ""}</h2></div>
          <ProductGrid products={related} lowAt={lowAt} />
        </section>
      )}
    </div>
  );
}
