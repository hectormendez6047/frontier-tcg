import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ProductForm } from "../ProductForm";

export const metadata = { title: "Add product" };

export default async function NewProduct() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data: locations } = await supabase.from("inventory_locations").select("id, name").order("sort");
  return <ProductForm initial={null} images={[]} locations={locations ?? []} isAdmin />;
}
