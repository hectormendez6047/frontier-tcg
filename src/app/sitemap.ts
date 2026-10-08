import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/format";
import { CATEGORIES } from "@/lib/constants";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const fixed = ["", "/shop", "/finder", "/bulk", "/events", "/rewards", "/about"].map((p) => ({ url: base + p, changeFrequency: "daily" as const }));
  const cats = Object.keys(CATEGORIES).map((c) => ({ url: `${base}/shop/${c}`, changeFrequency: "daily" as const }));
  try {
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data } = await supabase.from("products_public").select("slug, updated_at").eq("is_demo", false).limit(45000);
    const products = (data ?? []).map((r: { slug: string; updated_at: string }) => ({ url: `${base}/p/${r.slug}`, lastModified: r.updated_at }));
    return [...fixed, ...cats, ...products];
  } catch {
    return [...fixed, ...cats];
  }
}
