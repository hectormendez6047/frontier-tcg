import { cache } from "react";
import { createClient } from "./supabase/server";
import { DEFAULT_SETTINGS } from "./settings";
import type { Facets, PokemonSet, Product, ProductImage, Settings, StoreEvent } from "./types";
import { PAGE_SIZE } from "./constants";

export const getSettings = cache(async (): Promise<Settings> => {
  const supabase = await createClient();
  const { data } = await supabase.from("store_settings").select("data").eq("id", 1).maybeSingle();
  const raw = (data?.data as Partial<Settings>) ?? {};
  const merged = { ...DEFAULT_SETTINGS, ...raw };
  if (!raw.siteMode) merged.siteMode = raw.comingSoon === false ? "live" : "coming_soon";
  merged.comingSoon = merged.siteMode !== "live";
  return merged;
});

export type SearchParams = {
  q?: string;
  category?: string;
  game?: string;
  type?: string;
  condition?: string;
  rarity?: string;
  min?: string;
  max?: string;
  set?: string;
  player?: string;
  team?: string;
  year?: string;
  brand?: string;
  kind?: string;
  stock?: string;   // "1" = in stock only
  rookie?: string;  // "1"
  insert?: string;  // "1"
  graded?: string;  // "1"
  holo?: string;    // "1"
  sort?: string;
  page?: string;
};

export const FILTER_KEYS = ["q", "game", "type", "condition", "rarity", "set", "player", "team", "year", "brand", "kind",
  "min", "max", "stock", "rookie", "insert", "graded", "holo", "sort", "page"] as const;

export async function searchProducts(sp: SearchParams & { category?: string }, opts: { pageSize?: number; defaultInStock?: boolean; category?: string } = {}) {
  const supabase = await createClient();
  const pageSize = opts.pageSize ?? PAGE_SIZE;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const num = (v?: string) => (v && !isNaN(parseFloat(v)) ? parseFloat(v) : null);
  const inStock = sp.stock === undefined ? !!opts.defaultInStock : sp.stock === "1";
  const { data, error } = await supabase.rpc("search_products", {
    q: (sp.q ?? "").slice(0, 120),
    p_category: opts.category || sp.category || null,
    p_game: sp.game || null,
    p_type: sp.type || null,
    p_condition: sp.condition || null,
    p_rarity: sp.rarity || null,
    p_set: sp.set || null,
    p_player: sp.player?.trim() || null,
    p_team: sp.team || null,
    p_year: sp.year || null,
    p_brand: sp.brand || null,
    p_kind: sp.kind || null,
    p_min: num(sp.min),
    p_max: num(sp.max),
    p_in_stock: inStock,
    p_rookie: sp.rookie === "1",
    p_insert: sp.insert === "1",
    p_graded: sp.graded === "1",
    p_holo: sp.holo === "1",
    p_sort: sp.sort || "relevance",
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  });
  if (error) console.error("search_products", error.message);
  const rows = (data ?? []) as { product: Product; total: number }[];
  return {
    products: rows.map((r) => r.product),
    total: rows.length ? Number(rows[0].total) : 0,
    page,
    pageSize,
    inStock,
    error: !!error,
  };
}

export const getFacets = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("product_facets");
  return (data ?? { games: [], rarities: [], counts: {} }) as { games: string[]; rarities: string[]; counts: Record<string, number> };
});

const PUBLIC_COLS =
  "id, sku, slug, name, product_type, game, set_name, card_number, rarity, card_type, player, team, year, manufacturer, rookie, parallel, is_insert, holo, language, condition, price, sale_price, compare_at_price, available_quantity, description, tags, featured, is_demo, created_at, image_path, image_url, product_kind, grader, grade";

export const getScopeFacets = cache(async (category: string | null, game: string | null): Promise<Facets> => {
  const supabase = await createClient();
  const { data } = await supabase.rpc("scope_facets", { p_category: category, p_game: game });
  const empty: Facets = { games: [], sets: [], rarities: [], teams: [], players: [], years: [], brands: [], kinds: [], total: 0 };
  return { ...empty, ...((data as Partial<Facets>) ?? {}) };
});

/** Every Pokémon set, newest first, for the Set filter and the product form. */
export const getPokemonSets = cache(async (): Promise<PokemonSet[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("sets").select("name, code, series, release_date").eq("game", "Pokémon")
    .order("release_date", { ascending: false }).limit(500);
  return (data ?? []) as PokemonSet[];
});

export async function getNewSealed(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase.from("products_public").select(PUBLIC_COLS).eq("product_type", "sealed").gt("available_quantity", 0)
    .order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as Product[];
}

export async function getProductBySlug(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("products_public").select(PUBLIC_COLS).eq("slug", slug).maybeSingle();
  if (!data) return null;
  const { data: images } = await supabase
    .from("product_images").select("id, product_id, path, alt, position").eq("product_id", data.id).order("position");
  return { product: data as unknown as Product, images: (images ?? []) as ProductImage[] };
}

export async function getProductsByIds(ids: string[]) {
  if (!ids.length) return [];
  const supabase = await createClient();
  const { data } = await supabase.from("products_public").select(PUBLIC_COLS).in("id", ids.slice(0, 200));
  return (data ?? []) as unknown as Product[];
}

export async function getFeatured(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase.from("products_public").select(PUBLIC_COLS).eq("featured", true)
    .order("updated_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as Product[];
}

export async function getNewArrivals(limit = 8) {
  const supabase = await createClient();
  const { data } = await supabase.from("products_public").select(PUBLIC_COLS).gt("available_quantity", 0).neq("product_type", "bulk")
    .order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as unknown as Product[];
}

export async function getRelated(p: Product, limit = 4) {
  const supabase = await createClient();
  let q = supabase.from("products_public").select(PUBLIC_COLS).neq("id", p.id).gt("available_quantity", 0).limit(limit);
  q = p.game ? q.eq("game", p.game) : q.eq("product_type", p.product_type);
  const { data } = await q;
  return (data ?? []) as unknown as Product[];
}

export async function getUpcomingEvents(limit = 20) {
  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("events").select("*").eq("status", "active").gte("starts_on", today)
    .order("starts_on").limit(limit);
  return (data ?? []) as StoreEvent[];
}
