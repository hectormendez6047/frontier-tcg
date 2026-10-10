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
        <p>Every card and product we stock, in one place. Search by name, set, card number, player or team, then narrow it down by game. Stock is live.</p>
      </div>
      <Listing sp={sp} scope="all" basePath="/finder" mode="list" defaultInStock searchPlaceholder="Pikachu, 125/198, Mahomes…" autoFocus={!sp.q} />
    </div>
  );
}
