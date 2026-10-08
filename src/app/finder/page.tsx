import type { Metadata } from "next";
import { Listing, pickParams } from "@/components/Listing";

export const metadata: Metadata = {
  title: "Card Finder",
  description: "Search Frontier TCG's live inventory by card name, set, card number, player or team.",
  alternates: { canonical: "/finder" },
};

export default async function Finder({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = pickParams(await searchParams);
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="eyebrow">Card Finder</div>
        <h1>Find a card</h1>
        <p>Search by card name, set, card number, player or team. Stock is live.</p>
      </div>
      <Listing sp={sp} basePath="/finder" mode="list" showType defaultInStock searchPlaceholder="Pikachu, 125/198, Mahomes…" autoFocus={!sp.q} />
    </div>
  );
}
