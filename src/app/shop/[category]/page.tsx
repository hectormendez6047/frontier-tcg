import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CATEGORIES } from "@/lib/constants";
import { Listing, pickParams } from "@/components/Listing";

type Props = { params: Promise<{ category: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const c = CATEGORIES[category];
  if (!c) return {};
  return { title: c.title, description: `${c.blurb} Frontier TCG, Laredo, Texas.`, alternates: { canonical: `/shop/${category}` } };
}

export default async function Category({ params, searchParams }: Props) {
  const { category } = await params;
  const c = CATEGORIES[category];
  if (!c) notFound();
  const sp = pickParams(await searchParams);
  return (
    <div className="wrap">
      <div className="page-head"><h1>{c.title}</h1><p>{c.blurb}</p></div>
      <Listing sp={sp} category={category} basePath={`/shop/${category}`} mode="grid" defaultInStock={false} defaultSort="new" />
    </div>
  );
}
