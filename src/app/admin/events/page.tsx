import { createClient } from "@/lib/supabase/server";
import type { StoreEvent } from "@/lib/types";
import { EventsManager } from "./EventsManager";

export const metadata = { title: "Events" };

export default async function EventsAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("*").order("starts_on", { ascending: false }).limit(200);
  return <EventsManager events={(data ?? []) as StoreEvent[]} />;
}
