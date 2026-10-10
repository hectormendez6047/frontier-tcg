import { Suspense } from "react";
import { FILTER_KEYS, getPokemonSets, getScopeFacets, getSettings, searchProducts, type SearchParams } from "@/lib/data";
import type { FilterScope } from "@/lib/constants";
import { FilterPanel, SearchBar } from "./Filters";
import { Results } from "./Results";

/** Shared layout for Shop, category pages, Card Finder and Bulk. All filtering happens in the database. */
export async function Listing({ sp, category, scope, fixedGame, basePath, mode, searchPlaceholder, defaultInStock, defaultSort, autoFocus }: {
  sp: SearchParams; category?: string; scope: FilterScope; fixedGame?: string; basePath: string; mode: "grid" | "list";
  searchPlaceholder?: string; defaultInStock: boolean; defaultSort?: string; autoFocus?: boolean;
}) {
  const game = fixedGame ?? sp.game ?? null;
  const needSets = scope === "pokemon" || game === "Pokémon";
  const [settings, facets, pokemonSets, res] = await Promise.all([
    getSettings(),
    getScopeFacets(category ?? null, game),
    needSets ? getPokemonSets() : Promise.resolve([]),
    searchProducts({ ...sp, game: game ?? undefined, sort: sp.sort || defaultSort }, { defaultInStock, category }),
  ]);
  const params = sp as Record<string, string | undefined>;
  return (
    <div className="layout">
      <Suspense>
        <FilterPanel scope={scope} facets={facets} pokemonSets={pokemonSets} defaultInStock={defaultInStock} />
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
  for (const k of FILTER_KEYS) {
    const v = raw[k];
    if (typeof v === "string" && v.length <= 120) out[k] = v;
  }
  return out;
}
