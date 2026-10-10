import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../ProductForm";
import { getPokemonSets, getSettings } from "@/lib/data";

export const metadata = { title: "Add product" };

export default async function NewProduct() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: locations } = await supabase.from("inventory_locations").select("id, name").order("sort");
  const [sets, st] = await Promise.all([getPokemonSets(), getSettings()]);
  return <ProductForm initial={null} images={[]} locations={locations ?? []} isAdmin pokemonSets={sets.map((s) => s.name)} bulkThreshold={st.bulkThreshold} autoBulk={st.autoBulk} />;
}
