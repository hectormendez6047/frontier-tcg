import Link from "next/link";

const ART: Record<string, React.ReactNode> = {
  pokemon: (<><rect x="16" y="8" width="32" height="46" rx="3" /><rect x="20" y="12" width="24" height="20" rx="1.5" /><path className="f" d="M34 14l-8 11h6l-3 9 9-12h-6z" /><path d="M21 38h22M21 43h16M21 48h10" /></>),
  football: (<><path d="M10 42C14 22 30 10 54 10c0 24-12 40-32 44-8 1.5-13-4-12-12z" /><path d="M20 44 44 20" /><path d="M27 33l4 4M31 29l4 4M35 25l4 4" /><path d="M14 36c4 0 10 6 10 10M40 12c0 4 6 10 10 10" /></>),
  basketball: (<><circle cx="32" cy="32" r="22" /><path d="M10 32h44M32 10v44" /><path d="M16 16c8 8 8 24 0 32M48 16c-8 8-8 24 0 32" /></>),
  baseball: (<><circle cx="32" cy="32" r="22" /><path d="M18 15c6 5 9 11 9 17s-3 12-9 17M46 15c-6 5-9 11-9 17s3 12 9 17" /><path d="M21 21l3-2M24 27l3-1M24 37l3 1M21 43l3 2M43 21l-3-2M40 27l-3-1M40 37l-3 1M43 43l-3 2" /></>),
  sports: (<><path d="M20 10h24v14a12 12 0 0 1-24 0z" /><path d="M20 14h-8c0 8 4 12 9 13M44 14h8c0 8-4 12-9 13" /><path d="M32 36v8M24 54h16l-2-10H26z" /><path className="f" d="M32 14l2 4 4 .6-3 2.8.8 4.2-3.8-2-3.8 2 .8-4.2-3-2.8 4-.6z" /></>),
  tcg: (<><rect x="10" y="16" width="24" height="34" rx="2.5" transform="rotate(-14 22 33)" /><rect x="20" y="12" width="24" height="34" rx="2.5" /><rect x="30" y="16" width="24" height="34" rx="2.5" transform="rotate(14 42 33)" /><circle cx="32" cy="27" r="5" /></>),
  sealed: (<><path d="M16 8l3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3 3 3 3-3v48l-3-3-3 3-3-3-3 3-3-3-3 3-3-3-3 3-3-3-3 3z" /><path d="M16 18h32M16 46h32" /><path className="f" d="M32 24l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" /></>),
  accessories: (<><rect x="14" y="6" width="36" height="52" rx="2" /><path d="M26 6v3h12V6" /><rect x="19" y="14" width="26" height="38" rx="1.5" /><path d="M23 18l18 18" /></>),
  bulk: (<><rect x="22" y="8" width="28" height="38" rx="2.5" /><rect x="17" y="13" width="28" height="38" rx="2.5" /><rect x="12" y="18" width="28" height="38" rx="2.5" /><path d="M18 26h16M18 31h12" /></>),
};

const TILES: [string, string, string][] = [
  ["pokemon", "Pokémon", "/shop/pokemon"], ["football", "Football", "/shop/football"], ["basketball", "Basketball", "/shop/basketball"],
  ["baseball", "Baseball", "/shop/baseball"], ["sports", "Sports Cards", "/shop/sports"], ["tcg", "Other TCGs", "/shop/tcg"],
  ["sealed", "Sealed Product", "/shop/sealed"], ["accessories", "Accessories", "/shop/accessories"], ["bulk", "Bulk", "/bulk"],
];

export function CategoryTiles({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="catgrid">
      {TILES.map(([k, label, href]) => (
        <Link key={k} className="cat" href={href}>
          <svg className="art" viewBox="0 0 64 64" aria-hidden="true">{ART[k]}</svg>
          <span className="n">{label}</span>
          <span className="c">{counts[k] ?? 0} items</span>
        </Link>
      ))}
    </div>
  );
}
