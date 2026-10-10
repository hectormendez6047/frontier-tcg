import { notFound } from "next/navigation";
import { getViewer, hasRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { AdminProduct } from "@/lib/types";
import { ProductForm } from "../ProductForm";
import { getPokemonSets, getSettings } from "@/lib/data";

export const metadata = { title: "Edit product" };

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const viewer = await getViewer();
  const [sets, st, { data: product }, { data: images }, { data: locations }] = await Promise.all([
    getPokemonSets(), getSettings(),
    supabase.rpc("admin_get_product", { p_id: id }),
    supabase.from("product_images").select("path, alt").eq("product_id", id).order("position"),
    supabase.from("inventory_locations").select("id, name").order("sort"),
  ]);
  if (!product || !(product as AdminProduct).id) notFound();
  return (
    <ProductForm key={(product as AdminProduct).updated_at} initial={product as AdminProduct} images={images ?? []}
      locations={locations ?? []} isAdmin={!!viewer && hasRole(viewer.role, "admin")}
      pokemonSets={sets.map((s) => s.name)} bulkThreshold={st.bulkThreshold} autoBulk={st.autoBulk} />
  );
}
