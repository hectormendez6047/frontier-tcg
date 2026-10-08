import type { Metadata } from "next";
import { Listing, pickParams } from "@/components/Listing";

export const metadata: Metadata = { title: "Shop all", description: "Shop Pokémon singles, sealed product, sports cards and accessories at Frontier TCG.", alternates: { canonical: "/shop" } };

export default async function Shop({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = pickParams(await searchParams);
  return (
    <div className="wrap">
      <div className="page-head"><h1>Shop all</h1><p>Singles, sealed product, sports cards and supplies.</p></div>
      <Listing sp={sp} basePath="/shop" mode="grid" showType defaultInStock={false} defaultSort="new" />
    </div>
  );
}
