"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { money } from "@/lib/format";

type Hit = { slug: string; name: string; price: number; sale_price: number | null; available_quantity: number; meta: string };

/** Homepage quick search with live results, so "do you have it?" is answered in one step. */
export function HeroFinder() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[] | null>(null);
  useEffect(() => {
    const term = q.trim();
    if (!term) { setHits(null); return; }
    const ctrl = new AbortController();
    const h = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => r.json()).then((d) => setHits(d.results ?? [])).catch(() => {});
    }, 200);
    return () => { clearTimeout(h); ctrl.abort(); };
  }, [q]);
  return (
    <div className="hero-finder">
      <label htmlFor="heroQ">Card Finder: check our stock</label>
      <form className="f" onSubmit={(e) => { e.preventDefault(); router.push(`/finder?q=${encodeURIComponent(q.trim())}`); }}>
        <input id="heroQ" placeholder="Try “Pikachu” or “Mahomes”" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn gold" type="submit">Search</button>
      </form>
      <div className="quick">
        {["Pikachu", "Charizard", "Rookie", "Booster Box", "Sleeves"].map((t) => (
          <button key={t} className="chip" type="button" onClick={() => setQ(t)}>{t}</button>
        ))}
      </div>
      {hits && (
        <div className="live">
          {hits.length ? hits.map((h) => {
            const eff = h.sale_price != null && h.sale_price < h.price ? h.sale_price : h.price;
            const cls = h.available_quantity <= 0 ? "out" : "in";
            return (
              <Link key={h.slug} className="lr" href={`/p/${h.slug}`}>
                <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  <b>{h.name}</b> <span className="muted mono" style={{ fontSize: 12.5 }}>{h.meta}</span>
                </span>
                <span style={{ display: "flex", gap: 12, alignItems: "center", flex: "none" }}>
                  <span className={`stock ${cls}`}>{h.available_quantity > 0 ? `${h.available_quantity} in stock` : "Out"}</span>
                  <span className="mono">{money(eff)}</span>
                </span>
              </Link>
            );
          }) : <div className="lr"><span className="muted">We couldn&apos;t find that card. Try the full Card Finder.</span></div>}
        </div>
      )}
    </div>
  );
}
