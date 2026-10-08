export const CSV_COLUMNS = [
  "sku", "name", "product_type", "game", "set_name", "card_number", "rarity", "condition", "language", "holo",
  "player", "team", "year", "manufacturer", "rookie", "parallel", "is_insert",
  "price", "sale_price", "cost", "quantity", "status", "featured", "description", "tags",
] as const;

export const CSV_ALIASES: Record<string, string> = {
  set: "set_name", "set name": "set_name", "card number": "card_number", number: "card_number", "card #": "card_number",
  qty: "quantity", stock: "quantity", "sale price": "sale_price", type: "product_type", "product type": "product_type",
  category: "product_type", sport: "game", insert: "is_insert", foil: "holo",
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
