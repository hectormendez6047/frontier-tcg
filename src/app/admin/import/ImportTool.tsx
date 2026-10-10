"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { commitImport, existingSkus } from "../actions";
import { CSV_ALIASES, CSV_COLUMNS, condAbbrev, isSport, normalizeGame, parseCSV, sealedKind, splitCondition } from "@/lib/csv";
import { PRODUCT_TYPES } from "@/lib/constants";

type Item = { line: number; kind: "new" | "update" | "error"; id?: string; sku: string; name: string; data: Record<string, unknown>; errs: string[]; changes: string };

const BOOL = new Set(["holo", "rookie", "is_insert", "featured"]);
const MONEY = new Set(["price", "sale_price", "cost", "market_price", "store_price"]);
const EXTRA = new Set(["add_quantity", "market_price", "store_price", "printing", "title", "tcgplayer_sku"]);

function typeKey(v: string): string {
  const n = v.toLowerCase().trim();
  const hit = Object.entries(PRODUCT_TYPES).find(([k, l]) => k === n || l.toLowerCase() === n);
  if (hit) return hit[0];
  if (n.includes("sport")) return "sports";
  if (n.includes("seal")) return "sealed";
  if (n.includes("access")) return "accessory";
  if (n.includes("bulk")) return "bulk";
  if (n.includes("collect")) return "collectible";
  return "single";
}

export function ImportTool() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState("");
  const [over, setOver] = useState(false);
  const [paste, setPaste] = useState("");
  const [skipZero, setSkipZero] = useState(true);
  const [skipped, setSkipped] = useState(0);

  async function preview(text: string) {
    setError(""); setDone(""); setItems(null); setSkipped(0);
    const rows = parseCSV(text);
    if (rows.length < 2) return setError("That file has no product rows. The first row should be column names like name, price, quantity.");
    if (rows.length > 20001) return setError("Import up to 20,000 rows at a time. Split the file and import each part.");
    const head = rows[0].map((h) => {
      const k = h.trim().toLowerCase().replace(/^\uFEFF/, "");
      return CSV_ALIASES[k] ?? ((CSV_COLUMNS as readonly string[]).includes(k) ? k : null);
    });
    if (!head.includes("name") && !head.includes("sku") && !head.includes("tcgplayer_id")) return setError("Couldn't find a “name”, “Product Name” or “sku” column.");
    setBusy(true);

    // 1. Read every row into our fields, recognising TCGplayer / TCG Automate exports.
    let zero = 0;
    const parsed = rows.slice(1).map((r, i) => {
      const line = i + 2, errs: string[] = [], data: Record<string, unknown> = {}, extra: Record<string, unknown> = {};
      head.forEach((k, j) => {
        if (!k) return;
        const v = (r[j] ?? "").trim();
        if (v === "") return;
        const target = EXTRA.has(k) ? extra : data;
        if (MONEY.has(k)) { const n = parseFloat(v.replace(/[$,]/g, "")); if (!Number.isFinite(n) || n < 0) errs.push(`bad ${k.replace("_", " ")} “${v}”`); else target[k] = Math.round(n * 100) / 100; }
        else if (k === "quantity" || k === "add_quantity") { const n = parseInt(v, 10); if (!Number.isInteger(n) || n < 0) errs.push(`bad quantity “${v}”`); else target[k] = n; }
        else if (BOOL.has(k)) data[k] = /^(y|yes|true|1|x)$/i.test(v);
        else if (k === "product_type") data.product_type = typeKey(v);
        else if (k === "status") data.status = /arch/i.test(v) ? "archived" : /draft/i.test(v) ? "draft" : "active";
        else if (k === "tags") data.tags = v.split(/[;,]/).map((x) => x.trim()).filter(Boolean);
        else if (k === "game") data.game = normalizeGame(v);
        else target[k] = v.slice(0, k === "description" ? 5000 : 300);
      });
      // Price: your price first, then the store price column, then market price.
      if (data.price == null) data.price = extra.store_price ?? extra.market_price;
      if (extra.add_quantity != null) data.quantity = Number(data.quantity ?? 0) + Number(extra.add_quantity);
      if (typeof data.condition === "string") {
        const c = splitCondition(data.condition);
        data.condition = c.condition;
        if (c.holo) data.holo = true;
        if (c.sealed && !data.product_type) data.product_type = "sealed";
      }
      if (typeof extra.printing === "string" && /holo|foil/i.test(extra.printing)) data.holo = true;
      if (typeof data.image_url === "string" && !/^https:\/\//.test(data.image_url)) delete data.image_url;
      // Category: sealed by condition or name, sports by game, otherwise a single (cheap singles go to Bulk automatically).
      const name = String(data.name ?? extra.title ?? "");
      if (!data.name && name) data.name = name;
      if (!data.product_type) {
        const kind = !data.card_number ? sealedKind(name) : null;
        data.product_type = kind ? "sealed" : isSport(String(data.game ?? "")) ? "sports" : "single";
        if (kind && !data.product_kind) data.product_kind = kind;
      }
      if (data.product_type === "sealed" && !data.condition) data.condition = "Sealed";
      // SKU: keep yours; otherwise build a stable one from the TCGplayer ID + condition so re-imports update the same product.
      if (!data.sku && data.tcgplayer_id) data.sku = `TCG-${data.tcgplayer_id}-${condAbbrev(String(data.condition ?? ""))}${data.holo && data.product_type !== "sealed" ? "-F" : ""}`;
      return { line, data, errs };
    }).filter((x) => {
      if (skipZero && x.data.quantity === 0) { zero++; return false; }
      return true;
    });

    // 2. Match against what's already in the store by SKU.
    const existing = await existingSkus(parsed.map((x) => String(x.data.sku ?? "")).filter(Boolean));
    const seen = new Map<string, number>();
    const out: Item[] = parsed.map(({ line, data, errs }) => {
      const sku = String(data.sku ?? "");
      const ex = sku ? existing[sku] : undefined;
      if (sku) { if (seen.has(sku)) errs.push(`duplicate SKU (also row ${seen.get(sku)})`); else seen.set(sku, line); }
      if (!ex && !data.name) errs.push("missing name");
      if (!ex && data.price == null) errs.push("missing price");
      if (data.sale_price != null && data.price != null && Number(data.sale_price) >= Number(data.price)) errs.push("sale price must be below price");
      const changes = ex
        ? Object.entries(data).filter(([k]) => !["sku", "name"].includes(k)).map(([k, v]) => k === "price" ? `price ${ex.price.toFixed(2)} → ${Number(v).toFixed(2)}` : `${k.replace("_", " ")}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).slice(0, 5).join(" · ")
        : [data.game, data.set_name, data.product_type === "sealed" ? "Sealed" : data.product_type === "sports" ? "Sports" : null, data.condition,
           data.price != null ? `$${Number(data.price).toFixed(2)}${Number(data.price) <= 0.99 && data.product_type === "single" ? " → Bulk" : ""}` : null,
           data.quantity != null ? `qty ${data.quantity}` : null].filter(Boolean).join(" · ");
      return { line, kind: errs.length ? "error" : ex ? "update" : "new", id: ex?.id, sku, name: String(data.name ?? ex?.name ?? ""), data, errs, changes };
    });
    setSkipped(zero);
    setBusy(false);
    setItems(out);
  }

  async function apply() {
    if (!items) return;
    setBusy(true); setError("");
    const rows = items.filter((i) => i.kind !== "error").map((i) => ({ kind: i.kind as "new" | "update", id: i.id, data: i.data }));
    let created = 0, updated = 0;
    const failed: string[] = [];
    // Send in batches so large files don't time out.
    for (let i = 0; i < rows.length; i += 1000) {
      setDone(`Importing ${Math.min(i + 1000, rows.length)} of ${rows.length}…`);
      const r = await commitImport(rows.slice(i, i + 1000));
      if (!r.ok) { setBusy(false); setDone(""); return setError(`${r.error} (${created + updated} rows were saved before this.)`); }
      created += r.data!.created; updated += r.data!.updated; failed.push(...r.data!.failed);
    }
    setBusy(false);
    setDone(`Imported: ${created} new, ${updated} updated.${failed.length ? ` ${failed.length} failed: ${failed.slice(0, 10).join("; ")}` : ""}`);
    setItems(null);
    router.refresh();
  }

  const count = (k: Item["kind"]) => items?.filter((i) => i.kind === k).length ?? 0;
  const readFile = (f?: File | null) => { if (!f) return; if (f.size > 10 * 1024 * 1024) return setError("That file is larger than 10 MB. Split it into smaller files."); f.text().then(preview); };

  return (
    <div className="panel">
      <h3>Import CSV</h3>
      <p className="muted" style={{ margin: "0 0 14px", fontSize: 15 }}>
        Works with our template, TCGplayer exports and TCG Automate exports. Rows whose SKU already exists update that product; everything else is added as new.
        Cards are sorted automatically: sealed product by name, sports cards by sport, and singles at or under the bulk price into Bulk. You&apos;ll see a preview before anything is saved.
      </p>
      <label className={`dropzone${over ? " over" : ""}`} htmlFor="csvIn"
        onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); readFile(e.dataTransfer.files[0]); }}>
        <b>Drag a .csv file here</b> or click to choose
      </label>
      <input id="csvIn" type="file" accept=".csv,text/csv" className="sr" onChange={(e) => { readFile(e.target.files?.[0]); e.target.value = ""; }} />
      <details style={{ marginTop: 12 }}>
        <summary className="muted" style={{ cursor: "pointer", fontSize: 14 }}>Or paste CSV text</summary>
        <div className="fld" style={{ marginTop: 10 }}><label htmlFor="csvPaste">CSV</label>
          <textarea id="csvPaste" style={{ fontFamily: "var(--mono)", fontSize: 13, minHeight: 120 }} value={paste} onChange={(e) => setPaste(e.target.value)} /></div>
        <button className="btn sm" type="button" style={{ marginTop: 8 }} onClick={() => preview(paste)}>Preview</button>
      </details>
      <label className="check" style={{ marginTop: 12, fontSize: 14.5 }}>
        <input type="checkbox" checked={skipZero} onChange={(e) => setSkipZero(e.target.checked)} /> Skip rows with a quantity of 0 (recommended for full TCGplayer catalog exports)
      </label>
      {busy && !items && <p className="muted">Checking your file…</p>}
      {error && <div className="confirm" style={{ marginTop: 14 }} role="alert">{error}</div>}
      {done && <p style={{ color: "var(--ok)", marginTop: 14 }} role="status">{done}</p>}
      {items && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10, fontSize: 15 }}>
            <span className="tagnew">{count("new")} new</span><span className="tagupd">{count("update")} updates</span><span className="tagerr">{count("error")} errors (skipped)</span>{skipped > 0 && <span className="muted">{skipped} rows with 0 quantity skipped</span>}
          </div>
          <div className="prev"><table>
            <thead><tr><th>Row</th><th>Result</th><th>SKU</th><th>Name</th><th>Details</th></tr></thead>
            <tbody>{items.slice(0, 500).map((x) => (
              <tr key={x.line}>
                <td>{x.line}</td>
                <td className={x.kind === "new" ? "tagnew" : x.kind === "update" ? "tagupd" : "tagerr"}>{x.kind === "error" ? "Error" : x.kind === "new" ? "New" : "Update"}</td>
                <td>{x.sku}</td><td>{x.name}</td><td>{x.kind === "error" ? x.errs.join(", ") : x.changes}</td>
              </tr>
            ))}</tbody>
          </table></div>
          {items.length > 500 && <p className="muted" style={{ fontSize: 13 }}>Showing the first 500 rows.</p>}
          <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
            <button className="btn gold" type="button" disabled={busy || !(count("new") + count("update"))} onClick={apply}>
              {busy ? "Importing…" : `Apply ${count("new") + count("update")} rows`}
            </button>
            <button className="btn" type="button" onClick={() => setItems(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
