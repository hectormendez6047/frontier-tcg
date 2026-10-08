"use client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { CONDITIONS, PRODUCT_TYPES } from "@/lib/constants";
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

export function FilterPanel({ games, rarities, showType, defaultInStock }: {
  games: string[]; rarities: string[]; showType?: boolean; defaultInStock: boolean;
}) {
  const { sp, write } = useParamWriter();
  const [open, setOpen] = useState(false);
  const [min, setMin] = useState(sp.get("min") ?? "");
  const [max, setMax] = useState(sp.get("max") ?? "");
  const inStock = sp.get("stock") === null ? defaultInStock : sp.get("stock") === "1";
  const sel = (key: string, label: string, options: [string, string][]) => (
    <div className="fgroup">
      <label className="h" htmlFor={`f-${key}`}>{label}</label>
      <select id={`f-${key}`} value={sp.get(key) ?? ""} onChange={(e) => write({ [key]: e.target.value || null })}>
        <option value="">Any</option>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
  return (
    <>
      <button className="btn sm ftoggle" type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls="filters">
        {open ? "Hide filters" : "Filters"}
      </button>
      <aside className={`filters${open ? " open" : ""}`} id="filters" aria-label="Filters">
        {sel("game", "Game / sport", games.map((g) => [g, g]))}
        {showType && sel("type", "Product type", Object.entries(PRODUCT_TYPES))}
        {sel("condition", "Condition", CONDITIONS.slice(0, 5).map((c) => [c, c]))}
        {rarities.length > 0 && sel("rarity", "Rarity", rarities.map((r) => [r, r]))}
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
        <label className="check">
          <input type="checkbox" checked={sp.get("rookie") === "1"} onChange={(e) => write({ rookie: e.target.checked ? "1" : null })} />
          Rookie cards
        </label>
        <button className="btn sm" type="button" onClick={() => { setMin(""); setMax(""); write({ game: null, type: null, condition: null, rarity: null, min: null, max: null, stock: null, rookie: null }); }}>
          Clear filters
        </button>
      </aside>
    </>
  );
}
