import type { Metadata } from "next";
import { getUpcomingEvents } from "@/lib/data";
import { EventRow } from "@/components/EventRow";
import { EmptyState } from "@/components/EmptyState";

export const metadata: Metadata = { title: "Events", description: "League nights, prereleases and tournaments at Frontier TCG in Laredo, Texas.", alternates: { canonical: "/events" } };

export default async function Events() {
  const events = await getUpcomingEvents(50);
  return (
    <div className="wrap">
      <div className="page-head"><div className="eyebrow">Play at Frontier</div><h1>Events</h1><p>League nights, prereleases and tournaments in Laredo.</p></div>
      <div style={{ padding: "20px 0 64px", maxWidth: 860 }}>
        {events.length ? events.map((e) => <EventRow key={e.id} e={e} />) : (
          <EmptyState title="No events scheduled yet"><p>Check back soon.</p></EmptyState>
        )}
      </div>
    </div>
  );
}
