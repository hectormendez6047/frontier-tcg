import Link from "next/link";

// Line icons drawn on a 48-unit grid with one stroke weight, so every tile matches.
const ART: Record<string, string> = {
  pokemon: "<rect x=\"11\" y=\"5\" width=\"26\" height=\"38\" rx=\"3\"/><rect x=\"15\" y=\"9\" width=\"18\" height=\"14\" rx=\"1.5\"/><path class=\"f\" d=\"M25.6 10.8 20.4 17.2h3.4l-1.4 4.4 5.2-6.4h-3.4z\"/><path d=\"M15 28h18M15 32.5h18M15 37h11\"/>",
  tcg: "<rect class=\"bg\" x=\"14\" y=\"8\" width=\"20\" height=\"30\" rx=\"2.5\" transform=\"rotate(-16 24 42)\"/><rect class=\"bg\" x=\"14\" y=\"8\" width=\"20\" height=\"30\" rx=\"2.5\" transform=\"rotate(16 24 42)\"/><rect class=\"bg\" x=\"14\" y=\"7\" width=\"20\" height=\"30\" rx=\"2.5\"/><path class=\"f\" d=\"M24 15.5 29 22l-5 6.5-5-6.5z\"/>",
  sealed: "<path d=\"M13 9 L15.2 5.5 L17.4 9 L19.6 5.5 L21.8 9 L24 5.5 L26.2 9 L28.4 5.5 L30.6 9 L32.8 5.5 L35 9\"/><path d=\"M13 39 L15.2 42.5 L17.4 39 L19.6 42.5 L21.8 39 L24 42.5 L26.2 39 L28.4 42.5 L30.6 39 L32.8 42.5 L35 39\"/><path d=\"M13 9v30M35 9v30\"/><path d=\"M13 15h22M13 33h22\"/><path class=\"f\" d=\"M24 18.2l1.9 3.9 4.3.6-3.1 3 .7 4.3-3.8-2-3.8 2 .7-4.3-3.1-3 4.3-.6z\"/>",
  football: "<g transform=\"rotate(-38 24 24)\"><path d=\"M5.5 24C11 13.5 37 13.5 42.5 24 37 34.5 11 34.5 5.5 24z\"/><path d=\"M18 24h12\"/><path d=\"M19.5 21.6v4.8\"/><path d=\"M22.5 21.6v4.8\"/><path d=\"M25.5 21.6v4.8\"/><path d=\"M28.5 21.6v4.8\"/><path d=\"M13 19.6c.8 1.6.8 7.2 0 8.8M35 19.6c-.8 1.6-.8 7.2 0 8.8\"/></g>",
  basketball: "<circle cx=\"24\" cy=\"24\" r=\"17\"/><path d=\"M24 7v34M7 24h34\"/><path d=\"M12.4 11.6c6.6 6.6 6.6 18.2 0 24.8M35.6 11.6c-6.6 6.6-6.6 18.2 0 24.8\"/>",
  baseball: "<circle cx=\"24\" cy=\"24\" r=\"17\"/><path d=\"M15.2 9.8C21.2 15.6 21.2 32.4 15.2 38.2\"/><path d=\"M32.8 9.8C26.8 15.6 26.8 32.4 32.8 38.2\"/><path d=\"M15.37 13.45 17.74 13.6 19.21 11.75\"/><path d=\"M16.91 17.66 19.18 18.35 21.04 16.87\"/><path d=\"M17.6 22.9 19.7 24 21.8 22.9\"/><path d=\"M17.32 28.18 19.18 29.65 21.45 28.97\"/><path d=\"M16.27 32.54 17.74 34.4 20.11 34.24\"/><path d=\"M28.79 11.75 30.26 13.6 32.63 13.45\"/><path d=\"M26.96 16.87 28.82 18.35 31.09 17.66\"/><path d=\"M26.2 22.9 28.3 24 30.4 22.9\"/><path d=\"M26.55 28.97 28.82 29.65 30.68 28.18\"/><path d=\"M27.89 34.24 30.26 34.4 31.73 32.54\"/>",
  hockey: "<path d=\"M30.2 5.5h4.2L22.7 33.8c-.8 1.9-2.4 3-4.4 3H9.5A1.5 1.5 0 0 1 8 35.3v-2.1a1.5 1.5 0 0 1 1.5-1.5h8.6z\"/><ellipse cx=\"33.5\" cy=\"36.6\" rx=\"7.5\" ry=\"2.7\"/><path d=\"M26 36.6v3c0 1.5 3.4 2.7 7.5 2.7s7.5-1.2 7.5-2.7v-3\"/>",
  soccer: "<circle cx=\"24\" cy=\"24\" r=\"17\"/><path class=\"f\" d=\"M24 18.4 29.33 22.27 27.29 28.53 20.71 28.53 18.67 22.27z\"/><path d=\"M24 18.4 29.33 22.27 27.29 28.53 20.71 28.53 18.67 22.27z\"/><path d=\"M24 18.4L24 12.8\"/><path d=\"M29.33 22.27L34.65 20.54\"/><path d=\"M27.29 28.53L30.58 33.06\"/><path d=\"M20.71 28.53L17.42 33.06\"/><path d=\"M18.67 22.27L13.35 20.54\"/><path d=\"M24 12.8L16.55 8.72\"/><path d=\"M24 12.8L31.45 8.72\"/><path d=\"M34.65 20.54L36.23 12.19\"/><path d=\"M34.65 20.54L40.83 26.37\"/><path d=\"M30.58 33.06L39.01 31.98\"/><path d=\"M30.58 33.06L26.95 40.74\"/><path d=\"M17.42 33.06L21.05 40.74\"/><path d=\"M17.42 33.06L8.99 31.98\"/><path d=\"M13.35 20.54L7.17 26.37\"/><path d=\"M13.35 20.54L11.77 12.19\"/>",
  accessories: "<path d=\"M12 8a2 2 0 0 1 2-2h5.5a4.5 4.5 0 0 0 9 0H34a2 2 0 0 1 2 2v32a2 2 0 0 1-2 2H14a2 2 0 0 1-2-2z\"/><rect x=\"15.5\" y=\"12\" width=\"17\" height=\"26.5\" rx=\"1.5\"/><path d=\"M18.5 16.5l4 4\"/>",
  bulk: "<rect class=\"bg\" x=\"10.5\" y=\"12\" width=\"4.5\" height=\"14\" rx=\"1\"/><rect class=\"bg\" x=\"16.5\" y=\"14\" width=\"4.5\" height=\"12\" rx=\"1\"/><rect class=\"bg\" x=\"22.5\" y=\"11\" width=\"4.5\" height=\"15\" rx=\"1\"/><rect class=\"bg\" x=\"28.5\" y=\"13\" width=\"4.5\" height=\"13\" rx=\"1\"/><rect class=\"bg\" x=\"34.5\" y=\"11.5\" width=\"4.5\" height=\"14.5\" rx=\"1\"/><rect class=\"bg\" x=\"6\" y=\"22\" width=\"36\" height=\"19\" rx=\"2\"/><path d=\"M6 27h36\"/><rect x=\"19\" y=\"31\" width=\"10\" height=\"5\" rx=\"1\"/>",
};

const TILES: [string, string, string][] = [
  ["pokemon", "Pokémon", "/shop/pokemon"],
  ["tcg", "Other TCGs", "/shop/tcg"],
  ["sealed", "Sealed Product", "/shop/sealed"],
  ["football", "Football", "/shop/football"],
  ["basketball", "Basketball", "/shop/basketball"],
  ["baseball", "Baseball", "/shop/baseball"],
  ["hockey", "Hockey", "/shop/hockey"],
  ["soccer", "Soccer", "/shop/soccer"],
  ["accessories", "Accessories", "/shop/accessories"],
  ["bulk", "Bulk", "/bulk"],
];

export function CategoryTiles({ counts }: { counts: Record<string, number> }) {
  return (
    <div className="catgrid">
      {TILES.map(([k, label, href]) => (
        <Link key={k} className="cat" href={href}>
          <svg className="art" viewBox="0 0 48 48" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART[k] }} />
          <span className="n">{label}</span>
          <span className="c">{counts[k] ?? 0} item{counts[k] === 1 ? "" : "s"}</span>
        </Link>
      ))}
    </div>
  );
}
