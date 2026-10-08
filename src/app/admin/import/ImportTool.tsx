"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { commitImport, existingSkus } from "../actions";
import { CSV_ALIASES, CSV_COLUMNS, parseCSV } from "@/lib/csv";
import { PRODUCT_TYPES } from "@/lib/constants";

type Item = { line: number; kind: "new" | "update" | "error"; id?: string; sku: string; name: string; data: Record<string, unknown>; errs: string[]; changes: string };

const BOOL = new Set(["holo", "rookie", "is_insert", "featured"]);
const MONEY = new Set(["price", "sale_price", "cost"]);

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

  async function preview(text: string) {
    setError(""); setDone(""); setItems(null);
    const rows = parseCSV(text);
    if (rows.length < 2) return setError("That file has no product rows. The first row should be column names like sku, name, price, quantity.");
    if (rows.length > 5001) return setError("Import up to 5,000 rows at a time. Split the file and import each part.");
    const head = rows[0].map((h) => { const k = h.trim().toLowerCase().replace(/^﻿/, ""); return CSV_ALIASES[k] ?? (CSV_COLUMNS as readonly string[]).find((c) => c === k) ?? null; });
    if (!head.includes("name") && !head.includes("sku")) return setError("Couldn't find a “name” or “sku” column.");
    setBusy(true);
    const skuIdx = head.indexOf("sku");
    const existing = await existingSkus(skuIdx >= 0 ? rows.slice(1).map((r) => (r[skuIdx] ?? "").trim()) : []);
    const seen = new Map<string, number>();
    const out: Item[] = rows.slice(1).map((r, i) => {
      const line = i + 2, errs: string[] = [], data: Record<string, unknown> = {};
      head.forEach((k, j) => {
        if (!k) return;
        const v = (r[j] ?? "").trim();
        if (v === "") return;
        if (MONEY.has(k)) { const n = parseFloat(v.replace(/[$,]/g, "")); if (!Number.isFinite(n) || n < 0) errs.push(`bad ${k} “${v}”`); else data[k] = Math.round(n * 100) / 100; }
        else if (k === "quantity") { const n = parseInt(v, 10); if (!Number.isInteger(n) || n < 0) errs.push(`bad quantity “${v}”`); else data.quantity = n; }
        else if (BOOL.has(k)) data[k] = /^(y|yes|true|1|x)$/i.test(v);
        else if (k === "product_type") data.product_type = typeKey(v);
        else if (k === "status") data.status = /arch/i.test(v) ? "archived" : /draft/i.test(v) ? "draft" : "active";
        else if (k === "tags") data.tags = v.split(/[;,]/).map((s) => s.trim()).filter(Boolean);
        else data[k] = v.slice(0, k === "description" ? 5000 : 200);
      });
      const sku = String(data.sku ?? "");
      const ex = sku ? existing[sku] : undefined;
      if (sku) { if (seen.has(sku)) errs.push(`duplicate SKU (also row ${seen.get(sku)})`); else seen.set(sku, line); }
      if (!ex && !data.name) errs.push("missing name");
      if (!ex && data.price == null) errs.push("missing price");
      if (data.sale_price != null && data.price != null && Number(data.sale_price) >= Number(data.price)) errs.push("sale price must be below price");
      const changes = ex
        ? Object.entries(data).filter(([k]) => k !== "sku").map(([k, v]) => k === "price" ? `price ${ex.price.toFixed(2)} → ${Number(v).toFixed(2)}` : `${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`).slice(0, 5).join(" · ")
        : Object.entries(data).filter(([k]) => ["price", "quantity", "game", "set_name"].includes(k)).map(([k, v]) => `${k}: ${v}`).join(" · ");
      return { line, kind: errs.length ? "error" : ex ? "update" : "new", id: ex?.id, sku, name: String(data.name ?? ex?.name ?? ""), data, errs, changes };
    });
    setBusy(false);
    setItems(out);
  }

  async function apply() {
    if (!items) return;
    setBusy(true);
    const rows = items.filter((i) => i.kind !== "error").map((i) => ({ kind: i.kind as "new" | "update", id: i.id, data: i.data }));
    const r = await commitImport(rows);
    setBusy(false);
    if (!r.ok) return setError(r.error);
    const f = r.data!.failed;
    setDone(`Imported: ${r.data!.created} new, ${r.data!.updated} updated.${f.length ? ` ${f.length} failed: ${f.join("; ")}` : ""}`);
    setItems(null);
    router.refresh();
  }

  const count = (k: Item["kind"]) => items?.filter((i) => i.kind === k).length ?? 0;
  const readFile = (f?: File | null) => { if (!f) return; if (f.size > 10 * 1024 * 1024) return setError("That file is larger than 10 MB. Split it into smaller files."); f.text().then(preview); };

  return (
    <div className="panel">
      <h3>Import CSV</h3>
      <p className="muted" style={{ margin: "0 0 14px", fontSize: 15 }}>
        Rows whose SKU already exists update that product. Rows without a match are added as new products. Only the columns you include are changed. You&apos;ll see a preview before anything is saved.
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
      {busy && !items && <p className="muted">Checking your file…</p>}
      {error && <div className="confirm" style={{ marginTop: 14 }} role="alert">{error}</div>}
      {done && <p style={{ color: "var(--ok)", marginTop: 14 }} role="status">{done}</p>}
      {items && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10, fontSize: 15 }}>
            <span className="tagnew">{count("new")} new</span><span className="tagupd">{count("update")} updates</span><span className="tagerr">{count("error")} errors (skipped)</span>
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
