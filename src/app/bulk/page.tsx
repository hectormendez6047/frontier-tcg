import type { Metadata } from "next";
import { Listing, pickParams } from "@/components/Listing";

export const metadata: Metadata = { title: "Bulk cards", description: "Cheap commons, uncommons and reverse holos. Add as many as you need.", alternates: { canonical: "/bulk" } };

export default async function Bulk({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = pickParams(await searchParams);
  return (
    <div className="wrap">
      <div className="page-head">
        <div className="eyebrow">Bulk</div>
        <h1>Bulk cards</h1>
        <p>Commons, uncommons, reverse holos and base cards. Set the quantity on each row and add as many as you need.</p>
      </div>
      <Listing sp={sp} category="bulk" basePath="/bulk" mode="list" defaultInStock defaultSort="name" searchPlaceholder="Search bulk" />
    </div>
  );
}
