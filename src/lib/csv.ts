import { SPORTS } from "./constants";

export const CSV_COLUMNS = [
  "sku", "name", "product_type", "product_kind", "game", "set_name", "card_number", "rarity", "condition", "language", "holo",
  "player", "team", "year", "manufacturer", "rookie", "parallel", "is_insert", "grader", "grade",
  "price", "sale_price", "cost", "quantity", "status", "featured", "description", "tags", "tcgplayer_id", "image_url",
] as const;

/** Column names from other tools (TCGplayer, TCG Automate and common spreadsheets) mapped to ours. */
export const CSV_ALIASES: Record<string, string> = {
  set: "set_name", "set name": "set_name", "card number": "card_number", number: "card_number", "card #": "card_number", "collector number": "card_number",
  qty: "quantity", stock: "quantity", "total quantity": "quantity", "current quantity": "quantity", "add to quantity": "add_quantity",
  "sale price": "sale_price", type: "product_type", "product type": "product_type", category: "product_type",
  sport: "game", "product line": "game", "product name": "name", "card name": "name", title: "title",
  insert: "is_insert", foil: "holo", printing: "printing", finish: "printing",
  "tcgplayer id": "tcgplayer_id", "tcgplayer product id": "tcgplayer_id", "product id": "tcgplayer_id", "tcgplayer sku id": "tcgplayer_sku",
  "tcg marketplace price": "price", "marketplace price": "price", "my store price": "store_price", "your price": "price", "list price": "price",
  "tcg market price": "market_price", "market price": "market_price", "photo url": "image_url", "image url": "image_url", image: "image_url",
  brand: "manufacturer", "graded by": "grader", "grading company": "grader",
};

export function toCSV(rows: Record<string, unknown>[], cols: readonly string[] = CSV_COLUMNS): string {
  const q = (v: unknown) => {
    const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : typeof v === "boolean" ? (v ? "yes" : "") : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => q(r[c])).join(","))].join("\n");
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); rows.push(row); row = []; f = "";
    } else f += c;
  }
  if (f !== "" || row.length) { row.push(f); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ""));
}

/** "Pokemon" → "Pokémon", "Magic" → "Magic: The Gathering", etc. */
export function normalizeGame(v: string): string {
  const n = v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const map: [RegExp, string][] = [
    [/^pokemon/, "Pokémon"], [/^magic/, "Magic: The Gathering"], [/^yu ?gi ?oh/, "Yu-Gi-Oh!"], [/^one piece/, "One Piece"],
    [/lorcana/, "Disney Lorcana"], [/^dragon ball/, "Dragon Ball Super"], [/^digimon/, "Digimon"], [/^flesh and blood/, "Flesh and Blood"],
    [/^star wars/, "Star Wars: Unlimited"], [/^union arena/, "Union Arena"], [/^weiss/, "Weiss Schwarz"],
    [/^(nfl|football)/, "Football"], [/^(nba|basketball)/, "Basketball"], [/^(mlb|baseball)/, "Baseball"], [/^(nhl|hockey)/, "Hockey"], [/^(soccer|fifa|mls)/, "Soccer"],
  ];
  return map.find(([re]) => re.test(n))?.[1] ?? v.trim();
}

/** TCGplayer conditions like "Lightly Played Reverse Holofoil" → condition + holo flag. */
export function splitCondition(v: string): { condition: string; holo: boolean; sealed: boolean } {
  const s = v.toLowerCase();
  const holo = /holo|foil/.test(s);
  if (/unopened|sealed|^new/.test(s)) return { condition: "Sealed", holo, sealed: true };
  const base = /near mint|^nm/.test(s) ? "Near Mint" : /lightly|^lp/.test(s) ? "Lightly Played" : /moderately|^mp/.test(s) ? "Moderately Played"
    : /heavily|^hp/.test(s) ? "Heavily Played" : /damaged|^dmg/.test(s) ? "Damaged" : v.trim();
  return { condition: base, holo, sealed: false };
}

const SEALED_PATTERNS: [RegExp, string][] = [
  [/elite trainer box|\betb\b/i, "etb"], [/booster bundle/i, "booster_bundle"], [/sleeved booster/i, "sleeved_booster"],
  [/build (&|and) battle/i, "build_battle"], [/premium collection|ultra[- ]premium/i, "premium_collection"], [/hobby box/i, "hobby_box"],
  [/blaster box|blaster/i, "blaster_box"], [/mega box/i, "mega_box"], [/hanger|fat pack|value pack/i, "hanger_pack"],
  [/booster box|booster display|\bdisplay\b/i, "booster_box"], [/\bcase\b/i, "case"], [/\btin\b/i, "tin"],
  [/collection|box set|\bbox\b/i, "collection_box"], [/blister|checklane/i, "blister"],
  [/starter deck|theme deck|battle deck|\bdeck\b/i, "starter_deck"], [/booster pack|\bpack\b/i, "booster_pack"],
];
/** Guess the sealed product kind from its name, or null if it doesn't look sealed. */
export function sealedKind(name: string): string | null {
  return SEALED_PATTERNS.find(([re]) => re.test(name))?.[1] ?? null;
}

export const condAbbrev = (c: string) => ({ "Near Mint": "NM", "Lightly Played": "LP", "Moderately Played": "MP", "Heavily Played": "HP", Damaged: "DMG", Sealed: "S" }[c] ?? "X");
export const isSport = (g: string) => SPORTS.includes(g);
