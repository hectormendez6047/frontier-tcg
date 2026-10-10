import { createClient } from "@/lib/supabase/server";
import { AddressBook, type Address } from "./AddressBook";

export const metadata = { title: "Addresses", robots: { index: false } };

export default async function Addresses() {
  const supabase = await createClient();
  const { data } = await supabase.from("addresses").select("*").order("is_default", { ascending: false }).order("created_at");
  return <AddressBook addresses={(data ?? []) as Address[]} />;
}
