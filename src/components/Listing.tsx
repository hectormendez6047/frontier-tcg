import { Suspense } from "react";
import { getFacets, getSettings, searchProducts, type SearchParams } from "@/lib/data";
import { FilterPanel, SearchBar } from "./Filters";
import { Results } from "./Results";

/** Shared layout for Shop, category pages, Card Finder and Bulk. All filtering happens in the database. */
export async function Listing({ sp, category, basePath, mode, searchPlaceholder, showType, defaultInStock, defaultSort, autoFocus }: {
  sp: SearchParams; category?: string; basePath: string; mode: "grid" | "list";
  searchPlaceholder?: string; showType?: boolean; defaultInStock: boolean; defaultSort?: string; autoFocus?: boolean;
}) {
  const [settings, facets, res] = await Promise.all([
    getSettings(),
    getFacets(),
    searchProducts({ ...sp, category, sort: sp.sort || defaultSort }, { defaultInStock }),
  ]);
  const params = sp as Record<string, string | undefined>;
  return (
    <div className="layout">
      <Suspense>
        <FilterPanel games={facets.games ?? []} rarities={facets.rarities ?? []} showType={showType} defaultInStock={defaultInStock} />
      </Suspense>
      <div style={{ minWidth: 0 }}>
        {searchPlaceholder && <Suspense><SearchBar placeholder={searchPlaceholder} autoFocus={autoFocus} /></Suspense>}
        <Results products={res.products} total={res.total} page={res.page} pageSize={res.pageSize} lowAt={Number(settings.lowStock) || 3}
          mode={mode} basePath={basePath} params={params} error={res.error} defaultSort={defaultSort} />
      </div>
    </div>
  );
}

export function pickParams(raw: Record<string, string | string[] | undefined>): SearchParams {
  const out: Record<string, string> = {};
  for (const k of ["q", "game", "type", "condition", "rarity", "min", "max", "stock", "rookie", "sort", "page"]) {
    const v = raw[k];
    if (typeof v === "string" && v.length <= 120) out[k] = v;
  }
  return out;
}
