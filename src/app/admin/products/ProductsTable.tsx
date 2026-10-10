"use client";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkUpdate, updateProductField } from "../actions";
import { CONDITION_SHORT, productPhoto } from "@/lib/format";
import { PRODUCT_TYPES } from "@/lib/constants";
import type { AdminProduct } from "@/lib/types";

function Cell({ p, field, onError }: { p: AdminProduct; field: "price" | "quantity"; onError: (m: string) => void }) {
  const router = useRouter();
  const orig = field === "price" ? Number(p.price).toFixed(2) : String(p.quantity);
  const [v, setV] = useState(orig);
  const [state, setState] = useState<"" | "saving" | "saved" | "error">("");
  async function commit() {
    if (v === orig) return;
    const n = field === "price" ? parseFloat(v) : parseInt(v, 10);
    if (!Number.isFinite(n) || n < 0) { setV(orig); setState("error"); return; }
    setState("saving");
    const r = await updateProductField(p.id, field, n);
    if (!r.ok) { setState("error"); setV(orig); onError(r.error); return; }
    setState("saved");
    router.refresh();
    setTimeout(() => setState(""), 1500);
  }
  return (
    <>
      <label className="sr" htmlFor={`${field}-${p.id}`}>{field === "price" ? "Price" : "Quantity"} for {p.name}</label>
      <input className="cell" id={`${field}-${p.id}`} type="number" min={0} step={field === "price" ? "0.01" : "1"} value={v}
        style={{ width: field === "price" ? 88 : 70, borderColor: state === "saved" ? "var(--ok)" : state === "error" ? "var(--bad)" : undefined }}
        onChange={(e) => setV(e.target.value)} onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === "Escape") setV(orig); }}
        aria-busy={state === "saving"} />
    </>
  );
}

export function ProductsTable({ products, isAdmin }: { products: AdminProduct[]; isAdmin: boolean }) {
  const router = useRouter();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const [price, setPrice] = useState(""), [pct, setPct] = useState(""), [qty, setQty] = useState(""), [type, setType] = useState("");
  const onError = (t: string) => setMsg({ t, err: true });

  const allOn = products.length > 0 && products.every((p) => sel.has(p.id));
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function run(action: Parameters<typeof bulkUpdate>[0]["action"], value?: number | string) {
    start(async () => {
      const r = await bulkUpdate({ ids: [...sel], action, value });
      if (!r.ok) { setMsg({ t: r.error, err: true }); return; }
      setMsg({ t: `Updated ${r.data?.count ?? 0} product${r.data?.count === 1 ? "" : "s"}.` });
      setConfirmDelete(false);
      if (action === "delete") setSel(new Set());
      router.refresh();
    });
  }

  if (!products.length) return (
    <div className="empty"><h3>No products here</h3><p>Try a different search or status, or add a product.</p>
      {isAdmin && <p><Link className="btn gold" href="/admin/products/new">Add product</Link></p>}</div>
  );

  return (
    <>
      {msg && <p className={msg.err ? "err" : "muted"} role="status" style={{ margin: "0 0 10px" }}>{msg.t}</p>}
      {sel.size > 0 && (
        <div className="bulkbar" aria-busy={pending}>
          <b>{sel.size} selected</b>
          <input type="number" step="0.01" min="0" placeholder="Price $" aria-label="New price" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button className="btn sm" type="button" disabled={pending} onClick={() => run("price", parseFloat(price))}>Set price</button>
          <input type="number" step="1" placeholder="± %" aria-label="Percent change" value={pct} onChange={(e) => setPct(e.target.value)} />
          <button className="btn sm" type="button" disabled={pending} onClick={() => run("pct", parseFloat(pct))}>Adjust %</button>
          <input type="number" step="1" min="0" placeholder="Qty" aria-label="Quantity" value={qty} onChange={(e) => setQty(e.target.value)} />
          <button className="btn sm" type="button" disabled={pending} onClick={() => run("quantity", parseInt(qty, 10))}>Set qty</button>
          {isAdmin && (<>
            <select aria-label="Product type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Type…</option>
              {Object.entries(PRODUCT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
            <button className="btn sm" type="button" disabled={pending || !type} onClick={() => run("type", type)}>Set type</button>
          </>)}
          <button className="btn sm" type="button" disabled={pending} onClick={() => run("feature")}>Feature</button>
          <button className="btn sm" type="button" disabled={pending} onClick={() => run("unfeature")}>Unfeature</button>
          <button className="btn sm" type="button" disabled={pending} onClick={() => run("archive")}>Archive</button>
          <button className="btn sm" type="button" disabled={pending} onClick={() => run("restore")}>Restore</button>
          {isAdmin && <button className="btn sm danger" type="button" disabled={pending} onClick={() => setConfirmDelete(true)}>Delete</button>}
          <button className="btn sm" type="button" onClick={() => setSel(new Set())}>Clear</button>
        </div>
      )}
      {confirmDelete && (
        <div className="confirm" style={{ marginBottom: 12 }}>
          Delete {sel.size} product{sel.size === 1 ? "" : "s"} and their photos permanently? Archiving keeps them recoverable.
          <button className="btn sm danger" type="button" disabled={pending} onClick={() => run("delete")}>Delete</button>
          <button className="btn sm" type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      )}
      <div className="tscroll">
        <table className="at">
          <thead><tr>
            <th><input type="checkbox" checked={allOn} aria-label="Select all on this page" onChange={() => setSel(allOn ? new Set() : new Set(products.map((p) => p.id)))} /></th>
            <th></th><th>Product</th><th>Type</th><th>Cond.</th><th style={{ textAlign: "right" }}>Price</th><th style={{ textAlign: "right" }}>Qty</th><th>Status</th><th></th>
          </tr></thead>
          <tbody>
            {products.map((p) => {
              const photo = productPhoto(p);
              return (
                <tr key={p.id} className={sel.has(p.id) ? "sel" : undefined}>
                  <td><input type="checkbox" checked={sel.has(p.id)} onChange={() => toggle(p.id)} aria-label={`Select ${p.name}`} /></td>
                  <td><div className="th">{photo && <Image src={photo.src} alt="" fill sizes="36px" style={{ objectFit: "cover" }} unoptimized={photo.external} />}</div></td>
                  <td style={{ minWidth: 220 }}>
                    <Link href={`/admin/products/${p.id}`} style={{ fontWeight: 600, textDecoration: "none" }}>{p.name}</Link>
                    {p.is_demo && <span className="pill" style={{ marginLeft: 6 }}>Demo</span>}
                    {p.featured && <span className="pill" style={{ marginLeft: 6, color: "var(--gold)" }}>Featured</span>}
                    <div className="muted mono" style={{ fontSize: 12 }}>{[p.sku, p.game, p.set_name, p.card_number && "#" + p.card_number].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>{PRODUCT_TYPES[p.product_type]}</td>
                  <td className="mono" style={{ fontSize: 13 }}>{p.condition ? CONDITION_SHORT[p.condition] ?? p.condition : ""}</td>
                  <td style={{ textAlign: "right" }}><Cell key={`pr-${p.id}-${p.price}`} p={p} field="price" onError={onError} /></td>
                  <td style={{ textAlign: "right" }}><Cell key={`qt-${p.id}-${p.quantity}`} p={p} field="quantity" onError={onError} /></td>
                  <td><span className={`pill ${p.status === "active" ? "active" : "archived"}`}>{p.status}</span></td>
                  <td><Link className="btn sm" href={`/admin/products/${p.id}`}>Edit</Link></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
