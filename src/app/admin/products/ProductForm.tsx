"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { saveProduct, bulkUpdate, type ProductPayload } from "../actions";
import { createClient } from "@/lib/supabase/client";
import { ACCESSORY_KINDS, CONDITIONS, GAMES, GRADERS, PRODUCT_TYPES, SEALED_KINDS, SPORTS } from "@/lib/constants";
import { imageUrl } from "@/lib/format";
import type { AdminProduct } from "@/lib/types";

type Img = { path: string; alt?: string | null };
type Loc = { id: number; name: string };

async function toWebp(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error(`${file.name}: use a JPG, PNG or WebP photo.`);
  if (file.size > 20 * 1024 * 1024) throw new Error(`${file.name} is larger than 20 MB.`);
  const bmp = await createImageBitmap(file);
  const max = 1800, s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  c.getContext("2d")!.drawImage(bmp, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/webp", 0.88));
  return blob ?? file;
}

export function ProductForm({ initial, images: initialImages, locations, isAdmin, pokemonSets = [], bulkThreshold = 0.99, autoBulk = true }: {
  initial: AdminProduct | null; images: Img[]; locations: Loc[]; isAdmin: boolean; pokemonSets?: string[]; bulkThreshold?: number; autoBulk?: boolean;
}) {
  const router = useRouter();
  const isNew = !initial;
  const [id] = useState(() => initial?.id ?? crypto.randomUUID());
  const [d, setD] = useState<Record<string, unknown>>(() => initial ? { ...initial, tags: (initial.tags ?? []).join(", ") } : {
    product_type: "single", game: "Pokémon", condition: "Near Mint", language: "English", price: "", quantity: "", reserved_quantity: 0,
    status: "active", location_id: locations[0]?.id ?? null, tags: "",
  });
  const [images, setImages] = useState<Img[]>(initialImages);
  const [uploading, setUploading] = useState(0);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const [over, setOver] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const set = (k: string, v: unknown) => setD((x) => ({ ...x, [k]: v }));
  const str = (k: string) => (d[k] == null ? "" : String(d[k]));
  const sports = SPORTS.includes(str("game")) || d.product_type === "sports";

  async function upload(files: FileList | File[]) {
    const list = [...files].slice(0, 12 - images.length);
    if (!list.length) return;
    setErr(""); setUploading((n) => n + list.length);
    const supabase = createClient();
    for (const f of list) {
      try {
        const blob = await toWebp(f);
        const path = `${id}/${crypto.randomUUID()}.webp`;
        const { error } = await supabase.storage.from("product-images").upload(path, blob, { contentType: "image/webp", cacheControl: "31536000", upsert: false });
        if (error) throw new Error("Image upload failed. Please try again.");
        setImages((im) => [...im, { path, alt: str("name") || null }]);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Image upload failed. Please try again.");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  }

  const move = (i: number, to: number) => setImages((im) => { const n = [...im]; const [x] = n.splice(i, 1); n.splice(to, 0, x); return n; });

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setOk("");
    if (!str("name").trim()) return setErr("Name is required.");
    if (str("price") === "") return setErr("Price is required.");
    if (str("quantity") === "") return setErr("Quantity is required.");
    setSaving(true);
    const payload: ProductPayload = {
      id, isNew,
      sku: str("sku"), name: str("name"), product_type: str("product_type"),
      game: str("game"), set_name: str("set_name"), card_number: str("card_number"), rarity: str("rarity"), card_type: str("card_type"),
      player: str("player"), team: str("team"), year: str("year"), manufacturer: str("manufacturer"), parallel: str("parallel"),
      language: str("language"), condition: str("condition"),
      rookie: !!d.rookie, is_insert: !!d.is_insert, holo: !!d.holo,
      price: str("price"), sale_price: str("sale_price"), compare_at_price: str("compare_at_price"), cost: str("cost"),
      quantity: str("quantity"), reserved_quantity: str("reserved_quantity") || 0,
      location_id: d.location_id ? Number(d.location_id) : null,
      description: str("description"), notes: str("notes"),
      tags: str("tags").split(",").map((t) => t.trim()).filter(Boolean),
      status: str("status"), featured: !!d.featured, is_demo: !!d.is_demo,
      images: images.map((i) => ({ path: i.path, alt: i.alt ?? null })),
      product_kind: str("product_kind"), grader: str("grader"), grade: str("grade"), tcgplayer_id: str("tcgplayer_id"), image_url: str("image_url"),
    };
    const r = await saveProduct(payload);
    setSaving(false);
    if (!r.ok) return setErr(r.error);
    setOk("Saved. The store shows the change now.");
    if (isNew) router.replace(`/admin/products/${id}?saved=1`);
    router.refresh();
  }

  async function onDelete() {
    setSaving(true);
    const r = await bulkUpdate({ ids: [id], action: "delete" });
    setSaving(false);
    if (!r.ok) return setErr(r.error);
    router.replace("/admin/products");
    router.refresh();
  }

  const txt = (k: string, label: string, span = 6, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={`fld${span === 6 ? "" : " s" + span}`}>
      <label htmlFor={`e-${k}`}>{label}{extra.required ? " *" : ""}</label>
      <input id={`e-${k}`} value={str(k)} onChange={(e) => set(k, e.target.value)} {...extra} />
    </div>
  );
  const num = (k: string, label: string, span: number, step: string, required?: boolean) =>
    txt(k, label, span, { type: "number", min: 0, step, required, inputMode: step === "1" ? "numeric" : "decimal" });
  const check = (k: string, label: string, span = 3) => (
    <div className={`fld s${span}`} style={{ justifyContent: "flex-end" }}>
      <label className="check" style={{ font: "inherit", letterSpacing: 0, textTransform: "none", color: "var(--fg)", minHeight: 42 }}>
        <input type="checkbox" checked={!!d[k]} onChange={(e) => set(k, e.target.checked)} /> {label}
      </label>
    </div>
  );
  const select = (k: string, label: string, span: number, opts: [string, string][], blank = true) => (
    <div className={`fld s${span}`}>
      <label htmlFor={`e-${k}`}>{label}</label>
      <select id={`e-${k}`} value={str(k)} onChange={(e) => set(k, e.target.value)}>
        {blank && <option value="">—</option>}
        {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
  const H = ({ children }: { children: React.ReactNode }) => <h3 style={{ margin: "22px 0 12px", fontSize: 16, color: "var(--muted)" }}>{children}</h3>;

  return (
    <form onSubmit={onSave} noValidate>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 8 }}>
        <h2 style={{ fontSize: 28 }}>{isNew ? "Add product" : str("name") || "Edit product"}</h2>
        <Link href="/admin/products" className="btn sm">← All products</Link>
      </div>

      <div className="panel">
        <h3>Photos</h3>
        <div
          className={`dropzone${over ? " over" : ""}`}
          role="button" tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); upload(e.dataTransfer.files); }}
        >
          <b>Drag photos here</b> or click to upload<br />
          <span style={{ fontSize: 13 }}>JPG, PNG or WebP, up to 12 photos. Photos are resized and compressed automatically. The first photo is the main one.</span>
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr" aria-label="Upload photos"
          onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ""; }} />
        {uploading > 0 && <p className="muted" style={{ fontSize: 14 }} aria-live="polite">Uploading {uploading} photo{uploading > 1 ? "s" : ""}…</p>}
        {images.length > 0 && (
          <div className="imgs">
            {images.map((im, i) => (
              <div key={im.path} className={`it${i === 0 ? " primary" : ""}`}>
                <div className="tag" style={i ? { color: "var(--dim)" } : undefined}>{i === 0 ? "Main photo" : `Photo ${i + 1}`}</div>
                <div className="im" style={{ position: "relative" }}><Image src={imageUrl(im.path)!} alt={`Photo ${i + 1}`} fill sizes="120px" style={{ objectFit: "contain" }} /></div>
                <div className="acts">
                  {i > 0 && <button type="button" onClick={() => move(i, 0)}>Main</button>}
                  {i > 0 && <button type="button" aria-label="Move left" onClick={() => move(i, i - 1)}>←</button>}
                  {i < images.length - 1 && <button type="button" aria-label="Move right" onClick={() => move(i, i + 1)}>→</button>}
                  <button type="button" style={{ color: "var(--bad)" }} onClick={() => setImages((x) => x.filter((_, n) => n !== i))}>Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
        {!isNew && images.length !== initialImages.length && <p className="muted" style={{ fontSize: 13.5 }}>Photo changes apply when you save.</p>}
      </div>

      <div className="panel">
        <H>Details</H>
        <div className="form">
          {txt("name", "Name", 6, { required: true, maxLength: 200 })}
          {txt("sku", "SKU (leave blank to generate)", 3, { maxLength: 80 })}
          {select("product_type", "Product type", 3, Object.entries(PRODUCT_TYPES), false)}
          {select("game", "Game / sport", 3, GAMES.map((g) => [g, g]))}
          {select("condition", "Condition", 3, CONDITIONS.map((c) => [c, c]))}
          {d.product_type === "sealed" && select("product_kind", "Sealed product", 3, SEALED_KINDS)}
          {d.product_type === "accessory" && select("product_kind", "Accessory", 3, ACCESSORY_KINDS)}
          {(d.product_type === "single" || d.product_type === "sports" || d.product_type === "collectible") && (<>
            {select("grader", "Graded by (if slabbed)", 2, GRADERS.map((g) => [g, g]))}
            {str("grader") && txt("grade", "Grade", 1, { placeholder: "10" })}
          </>)}
        </div>
        {autoBulk && (d.product_type === "single" || d.product_type === "bulk") && (
          <p className="muted" style={{ fontSize: 13.5, margin: "10px 0 0" }}>Singles priced ${Number(bulkThreshold).toFixed(2)} or less go to Bulk automatically when you save.</p>
        )}
        {sports ? (<>
          <H>Sports card details</H>
          <div className="form">
            {txt("player", "Player", 3)}{txt("team", "Team", 3)}{txt("year", "Year", 2)}{txt("manufacturer", "Manufacturer", 4)}
            {txt("parallel", "Parallel", 2)}{check("rookie", "Rookie card", 2)}{check("is_insert", "Insert", 2)}
          </div>
        </>) : d.product_type !== "accessory" && (<>
          <H>Card and set details</H>
          <div className="form">
            <div className="fld s4"><label htmlFor="e-set_name">Set</label>
              <input id="e-set_name" list="set-list" value={str("set_name")} onChange={(e) => set("set_name", e.target.value)} placeholder={str("game") === "Pokémon" ? "Start typing, e.g. Pitch Black" : ""} />
              <datalist id="set-list">{(str("game") === "Pokémon" ? pokemonSets : []).map((s) => <option key={s} value={s} />)}</datalist></div>{txt("card_number", "Card number", 2)}{txt("rarity", "Rarity", 3)}{txt("language", "Language", 3)}{check("holo", "Holo / foil", 3)}
          </div>
        </>)}

        <H>Pricing</H>
        <div className="form">
          {num("price", "Regular price $", 2, "0.01", true)}{num("sale_price", "Sale price $", 2, "0.01")}{num("cost", "Your cost $", 2, "0.01")}
        </div>

        <H>Inventory</H>
        <div className="form">
          {num("quantity", "Quantity on hand", 2, "1", true)}{num("reserved_quantity", "Reserved / on hold", 2, "1")}
          {select("location_id", "Location", 2, locations.map((l) => [String(l.id), l.name]))}
        </div>

        <H>Description and visibility</H>
        <div className="form">
          <div className="fld"><label htmlFor="e-description">Description (shown to customers)</label><textarea id="e-description" value={str("description")} onChange={(e) => set("description", e.target.value)} /></div>
          <div className="fld"><label htmlFor="e-notes">Internal notes (staff only)</label><textarea id="e-notes" value={str("notes")} onChange={(e) => set("notes", e.target.value)} style={{ minHeight: 60 }} /></div>
          {txt("tags", "Tags, separated by commas", 6)}
          {txt("image_url", "Photo link (used when no photo is uploaded)", 4, { placeholder: "https://…" })}
          {txt("tcgplayer_id", "TCGplayer ID", 2)}
          {select("status", "Status", 3, [["active", "Active (visible)"], ["draft", "Draft (hidden)"], ["archived", "Archived (hidden)"]], false)}
          {check("featured", "Feature on homepage", 3)}
          {check("is_demo", "Demo product (sample data)", 6)}
        </div>
      </div>

      {err && <p className="err" role="alert">{err}</p>}
      {ok && <p style={{ color: "var(--ok)" }} role="status">{ok}</p>}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 24 }}>
        <button className="btn gold" type="submit" disabled={saving || uploading > 0}>{saving ? "Saving…" : isNew ? "Save product" : "Save changes"}</button>
        <Link className="btn" href="/admin/products">Cancel</Link>
        {!isNew && isAdmin && <span style={{ flex: 1 }} />}
        {!isNew && isAdmin && !confirmDel && <button className="btn sm danger" type="button" onClick={() => setConfirmDel(true)}>Delete product</button>}
      </div>
      {confirmDel && (
        <div className="confirm" style={{ marginBottom: 24 }}>
          Delete “{str("name")}” and its photos permanently? You can archive it instead to keep it.
          <button className="btn sm danger" type="button" onClick={onDelete} disabled={saving}>Delete</button>
          <button className="btn sm" type="button" onClick={() => setConfirmDel(false)}>Cancel</button>
        </div>
      )}
    </form>
  );
}
