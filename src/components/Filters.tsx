"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ACCESSORY_KINDS, CARD_CONDITIONS, SEALED_KINDS, SPORTS, TCG_GAMES, isSportName, type FilterScope } from "@/lib/constants";
import type { Facets, PokemonSet } from "@/lib/types";
import { SearchIcon } from "./Icons";

function useParamWriter() {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();
  const write = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v === null || v === "" ? next.delete(k) : next.set(k, v)));
    next.delete("page");
    const s = next.toString();
    start(() => router.replace(s ? `${path}?${s}` : path, { scroll: false }));
  };
  return { sp, write, pending };
}

/** Big search box: searches as you type (debounced) so shoppers see stock instantly. */
export function SearchBar({ placeholder, autoFocus }: { placeholder: string; autoFocus?: boolean }) {
  const { sp, write, pending } = useParamWriter();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const h = setTimeout(() => write({ q: q.trim() || null }), 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return (
    <form className="bigsearch" role="search" onSubmit={(e) => { e.preventDefault(); write({ q: q.trim() || null }); }}>
      <div className="in">
        <SearchIcon />
        <label className="sr" htmlFor="fq">Search</label>
        <input id="fq" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder}
          autoComplete="off" autoFocus={autoFocus} aria-busy={pending} />
      </div>
    </form>
  );
}

export function SortSelect({ fallback = "relevance" }: { fallback?: string }) {
  const { sp, write } = useParamWriter();
  return (
    <>
      <label className="sr" htmlFor="fSort">Sort</label>
      <select id="fSort" value={sp.get("sort") ?? fallback} onChange={(e) => write({ sort: e.target.value === fallback ? null : e.target.value })}>
        <option value="relevance">Best match</option>
        <option value="price_asc">Price: low to high</option>
        <option value="price_desc">Price: high to low</option>
        <option value="new">Newest</option>
        <option value="name">Name A–Z</option>
      </select>
    </>
  );
}

type Opt = [string, string];
const opts = (xs: string[]): Opt[] => xs.map((x) => [x, x]);
const SUB_KEYS = ["set", "rarity", "player", "team", "year", "brand", "kind", "condition", "type", "rookie", "insert", "graded", "holo"];

/**
 * Filters that match the tab you're on. Pokémon shows sets and rarities, sports shows players, teams and years,
 * sealed shows product kinds, and the Card Finder switches its filters to match the game you pick.
 */
export function FilterPanel({ scope, facets, pokemonSets, defaultInStock }: {
  scope: FilterScope; facets: Facets; pokemonSets: PokemonSet[]; defaultInStock: boolean;
}) {
  const { sp, write } = useParamWriter();
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(sp.get("min") ?? "");
  const [max, setMax] = useState(sp.get("max") ?? "");
  const [player, setPlayer] = useState(sp.get("player") ?? "");
  const inStock = sp.get("stock") === null ? defaultInStock : sp.get("stock") === "1";
  const game = sp.get("game") ?? "";

  // What kind of filters to show for the current tab + chosen game.
  const mode: "pokemon" | "tcg" | "sports" | "sealed" | "accessories" | "bulk" | "general" =
    scope === "pokemon" ? "pokemon"
    : scope === "sports" || scope === "sport" ? "sports"
    : scope === "sealed" ? "sealed"
    : scope === "accessories" ? "accessories"
    : scope === "bulk" ? "bulk"
    : scope === "tcg" ? (game === "Pokémon" ? "pokemon" : "tcg")
    : game === "Pokémon" ? "pokemon" : isSportName(game) ? "sports" : game ? "tcg" : "general";

  const sel = (key: string, label: string, options: Opt[], extra?: { onChange?: (v: string) => void; anyLabel?: string }) => (
    <div className="fgroup" key={key}>
      <label className="h" htmlFor={`f-${key}`}>{label}</label>
      <select id={`f-${key}`} value={sp.get(key) ?? ""} onChange={(e) => (extra?.onChange ? extra.onChange(e.target.value) : write({ [key]: e.target.value || null }))}>
        <option value="">{extra?.anyLabel ?? "Any"}</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
  const check = (key: string, label: string) => (
    <label className="check" key={key}>
      <input type="checkbox" checked={sp.get(key) === "1"} onChange={(e) => write({ [key]: e.target.checked ? "1" : null })} />
      {label}
    </label>
  );
  const clearSub = Object.fromEntries(SUB_KEYS.map((k) => [k, null]));
  const changeGame = (v: string) => { setPlayer(""); write({ ...clearSub, game: v || null }); };

  // Game list: what's in stock, plus the usual names for this tab so the list is never empty.
  const gameList = (base: string[]) => [...new Set([...facets.games.filter((g) => base.includes(g)), ...base])];

  // Pokémon set picker: sets we stock first, then every set grouped by era.
  const pokemonSetSelect = () => {
    const stocked = new Set(facets.sets);
    const bySeries = new Map<string, PokemonSet[]>();
    pokemonSets.forEach((s) => { const k = s.series || "Other"; if (!bySeries.has(k)) bySeries.set(k, []); bySeries.get(k)!.push(s); });
    return (
      <div className="fgroup" key="set">
        <label className="h" htmlFor="f-set">Set</label>
        <select id="f-set" value={sp.get("set") ?? ""} onChange={(e) => write({ set: e.target.value || null })}>
          <option value="">All sets</option>
          {stocked.size > 0 && (
            <optgroup label="In stock now">
              {pokemonSets.filter((s) => stocked.has(s.name)).map((s) => <option key={"s-" + s.name} value={s.name}>{s.name}</option>)}
              {[...stocked].filter((n) => !pokemonSets.some((s) => s.name === n)).map((n) => <option key={"x-" + n} value={n}>{n}</option>)}
            </optgroup>
          )}
          {[...bySeries.entries()].map(([series, list]) => (
            <optgroup key={series} label={series}>
              {list.map((s) => <option key={s.name} value={s.name}>{s.name}{s.code ? ` (${s.code})` : ""}</option>)}
            </optgroup>
          ))}
        </select>
      </div>
    );
  };
  const setSelect = () => (game === "Pokémon" || scope === "pokemon") && pokemonSets.length
    ? pokemonSetSelect()
    : facets.sets.length ? sel("set", "Set", opts(facets.sets), { anyLabel: "All sets" }) : null;

  const playerInput = (
    <div className="fgroup" key="player">
      <label className="h" htmlFor="f-player">Player</label>
      <input id="f-player" list="f-player-list" value={player} placeholder="Any player" style={{ width: "100%", height: 38, border: "1px solid var(--line-2)", background: "var(--bg)", borderRadius: "var(--r)", padding: "0 10px" }}
        onChange={(e) => setPlayer(e.target.value)} onBlur={() => write({ player: player.trim() || null })}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); write({ player: player.trim() || null }); } }} />
      <datalist id="f-player-list">{facets.players.slice(0, 300).map((p) => <option key={p} value={p} />)}</datalist>
    </div>
  );

  const groups: React.ReactNode[] = [];
  if (scope === "all") groups.push(sel("game", "Game / sport", opts(gameList([...TCG_GAMES, ...SPORTS])), { onChange: changeGame }));
  if (scope === "tcg") groups.push(sel("game", "Game", opts(gameList(TCG_GAMES.filter((g) => g !== "Pokémon"))), { onChange: changeGame }));
  if (scope === "sports") groups.push(sel("game", "Sport", opts(SPORTS), { onChange: changeGame }));
  if (scope === "sealed" || scope === "bulk") groups.push(sel("game", "Game", opts(gameList(scope === "sealed" ? [...TCG_GAMES, ...SPORTS] : TCG_GAMES)), { onChange: changeGame }));

  if (mode === "pokemon" || mode === "tcg") {
    groups.push(setSelect());
    if (scope !== "sealed" && scope !== "bulk") groups.push(sel("type", "Show", [["single", "Singles"], ["sealed", "Sealed product"], ...(scope === "all" ? [["bulk", "Bulk"] as Opt] : [])], { anyLabel: "Everything" }));
    if (facets.rarities.length) groups.push(sel("rarity", "Rarity", opts(facets.rarities)));
    groups.push(sel("condition", "Condition", opts(CARD_CONDITIONS)));
    groups.push(<div className="fgroup" key="tcg-checks" style={{ display: "grid", gap: 10 }}>{check("holo", "Holo / foil")}{check("graded", "Graded slabs")}</div>);
  } else if (mode === "sports") {
    groups.push(playerInput);
    if (facets.teams.length) groups.push(sel("team", "Team", opts(facets.teams)));
    if (facets.years.length) groups.push(sel("year", "Year", opts(facets.years)));
    if (facets.brands.length) groups.push(sel("brand", "Brand", opts(facets.brands)));
    groups.push(sel("type", "Show", [["sports", "Singles"], ["sealed", "Boxes & packs"]], { anyLabel: "Everything" }));
    groups.push(<div className="fgroup" key="sport-checks" style={{ display: "grid", gap: 10 }}>{check("rookie", "Rookie cards")}{check("insert", "Inserts & parallels")}{check("graded", "Graded slabs")}</div>);
  } else if (mode === "sealed") {
    groups.push(sel("kind", "Product", SEALED_KINDS.filter(([k]) => facets.kinds.includes(k) || !facets.kinds.length)));
    if (game) groups.push(setSelect());
  } else if (mode === "accessories") {
    groups.push(sel("kind", "Product", ACCESSORY_KINDS));
    if (facets.brands.length) groups.push(sel("brand", "Brand", opts(facets.brands)));
  } else if (mode === "bulk") {
    if (game) groups.push(setSelect());
    if (facets.rarities.length) groups.push(sel("rarity", "Rarity", opts(facets.rarities)));
    groups.push(sel("condition", "Condition", opts(CARD_CONDITIONS)));
  } else {
    groups.push(sel("type", "Product type", [["single", "Singles"], ["sports", "Sports cards"], ["sealed", "Sealed product"], ["bulk", "Bulk"], ["accessory", "Accessories"]], { anyLabel: "Everything" }));
    groups.push(sel("condition", "Condition", opts(CARD_CONDITIONS)));
    groups.push(<div className="fgroup" key="gen-checks">{check("graded", "Graded slabs")}</div>);
  }

  const activeCount = [...SUB_KEYS, "game", "min", "max"].filter((k) => sp.get(k)).length;
  return (
    <>
      <button className="btn sm ftoggle" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="filters">
        {open ? "Hide filters" : `Filters${activeCount ? ` (${activeCount})` : ""}`}
      </button>
      <aside className={`filters${open ? " open" : ""}`} id="filters" aria-label="Filters">
        {groups}
        <div className="fgroup">
          <label className="h" htmlFor="f-min">Price</label>
          <div className="pr">
            <input id="f-min" type="number" min={0} step="0.01" placeholder="Min" value={min}
              onChange={(e) => setMin(e.target.value)} onBlur={() => write({ min: min || null })} />
            <input type="number" min={0} step="0.01" placeholder="Max" aria-label="Maximum price" value={max}
              onChange={(e) => setMax(e.target.value)} onBlur={() => write({ max: max || null })} />
          </div>
        </div>
        <label className="check">
          <input type="checkbox" checked={inStock} onChange={(e) => write({ stock: e.target.checked === defaultInStock ? null : e.target.checked ? "1" : "0" })} />
          In stock only
        </label>
        <button className="btn sm" type="button" onClick={() => { setMin(""); setMax(""); setPlayer(""); write({ ...clearSub, game: null, min: null, max: null, stock: null }); }}>
          Clear filters
        </button>
      </aside>
    </>
  );
}

