"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkRole } from "@/lib/auth";
import { PRODUCT_TYPES } from "@/lib/constants";
import { DEFAULT_SETTINGS } from "@/lib/settings";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

function friendly(msg: string) {
  if (/duplicate key.*sku/i.test(msg)) return "That SKU is already used by another product.";
  if (/duplicate key.*slug/i.test(msg)) return "Another product already uses that web address. Change the name or SKU slightly.";
  if (/reserved_le_quantity/i.test(msg)) return "Reserved can't be more than the quantity on hand.";
  if (/row-level security|permission denied/i.test(msg)) return "You don't have permission to do that.";
  return "Something went wrong saving that. Please try again.";
}

function revalidateStore() {
  revalidatePath("/", "layout");
}

// ─── Products ────────────────────────────────────────────────

const optText = z.string().trim().max(500).optional().nullable().transform((v) => (v ? v : null));
const money = z.coerce.number().min(0).max(1_000_000).transform((v) => Math.round(v * 100) / 100);
const optMoney = z.union([z.literal(""), z.null(), z.undefined(), money]).transform((v) => (v === "" || v == null ? null : v));

const ProductInput = z.object({
  id: z.string().uuid(),
  isNew: z.boolean(),
  sku: z.string().trim().max(80).optional().default(""),
  name: z.string().trim().min(1, "Name is required.").max(200),
  product_type: z.enum(Object.keys(PRODUCT_TYPES) as [string, ...string[]]),
  game: optText, set_name: optText, card_number: optText, rarity: optText, card_type: optText,
  player: optText, team: optText, year: optText, manufacturer: optText, parallel: optText,
  language: optText, condition: optText,
  rookie: z.boolean().default(false), is_insert: z.boolean().default(false), holo: z.boolean().default(false),
  price: money,
  sale_price: optMoney, compare_at_price: optMoney, cost: optMoney,
  quantity: z.coerce.number().int().min(0).max(1_000_000),
  reserved_quantity: z.coerce.number().int().min(0).max(1_000_000).default(0),
  location_id: z.coerce.number().int().positive().nullable().optional(),
  description: z.string().trim().max(5000).optional().nullable().transform((v) => v || null),
  notes: z.string().trim().max(5000).optional().nullable().transform((v) => v || null),
  tags: z.array(z.string().trim().max(40)).max(30).default([]),
  status: z.enum(["active", "draft", "archived"]),
  featured: z.boolean().default(false),
  is_demo: z.boolean().default(false),
  images: z.array(z.object({ path: z.string().min(3).max(300), alt: z.string().max(200).optional().nullable() })).max(12),
});
export type ProductPayload = Record<string, unknown>;

const slugBit = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 24);

export async function saveProduct(raw: ProductPayload): Promise<Result<{ id: string }>> {
  const parsed = ProductInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the form and try again.");
  const v = parsed.data;
  const { error: roleErr } = await checkRole(v.isNew ? "admin" : "staff");
  if (roleErr) return fail(v.isNew ? "Only owners and admins can add products." : roleErr);
  if (v.sale_price != null && v.sale_price >= v.price) return fail("Sale price must be lower than the regular price.");
  if (v.reserved_quantity > v.quantity) return fail("Reserved can't be more than the quantity on hand.");
  if (v.images.some((i) => !i.path.startsWith(`${v.id}/`))) return fail("One of the photos doesn't belong to this product.");

  const supabase = await createClient();
  const row = {
    sku: v.sku || `${slugBit(v.name)}-${v.id.slice(0, 4).toUpperCase()}`,
    name: v.name, product_type: v.product_type, game: v.game, set_name: v.set_name, card_number: v.card_number,
    rarity: v.rarity, card_type: v.card_type, player: v.player, team: v.team, year: v.year, manufacturer: v.manufacturer,
    parallel: v.parallel, language: v.language, condition: v.condition, rookie: v.rookie, is_insert: v.is_insert, holo: v.holo,
    price: v.price, sale_price: v.sale_price, compare_at_price: v.compare_at_price, cost: v.cost,
    quantity: v.quantity, reserved_quantity: v.reserved_quantity, location_id: v.location_id ?? null,
    description: v.description, notes: v.notes, tags: v.tags, status: v.status, featured: v.featured, is_demo: v.is_demo,
  };

  if (v.isNew) {
    const { error } = await supabase.from("products").insert({ id: v.id, ...row });
    if (error) return fail(friendly(error.message));
  } else {
    const { error } = await supabase.from("products").update(row).eq("id", v.id);
    if (error) return fail(friendly(error.message));
  }

  // Sync photos: remove dropped ones (row + file), then write the new order.
  const { data: existing } = await supabase.from("product_images").select("id, path").eq("product_id", v.id);
  const keep = new Set(v.images.map((i) => i.path));
  const drop = (existing ?? []).filter((e) => !keep.has(e.path));
  if (drop.length) {
    await supabase.from("product_images").delete().in("id", drop.map((d) => d.id));
    await supabase.storage.from("product-images").remove(drop.map((d) => d.path));
  }
  if (v.images.length) {
    const { error } = await supabase.from("product_images").upsert(
      v.images.map((im, position) => ({ product_id: v.id, path: im.path, alt: im.alt || v.name, position })),
      { onConflict: "path" }
    );
    if (error) return fail("The product saved, but its photos didn't. Try saving again.");
  }

  revalidateStore();
  return { ok: true, data: { id: v.id } };
}

export async function updateProductField(id: string, field: "price" | "quantity", value: number): Promise<Result> {
  const { error: roleErr } = await checkRole("staff");
  if (roleErr) return fail(roleErr);
  if (!z.string().uuid().safeParse(id).success) return fail("Unknown product.");
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000) return fail(field === "price" ? "Price must be 0 or more." : "Quantity must be 0 or more.");
  const v = field === "price" ? Math.round(value * 100) / 100 : Math.floor(value);
  const supabase = await createClient();
  const { error } = await supabase.from("products").update({ [field]: v }).eq("id", id);
  if (error) return fail(friendly(error.message));
  revalidateStore();
  return { ok: true };
}

const BulkInput = z.object({
  ids: z.array(z.string().uuid()).min(1).max(1000),
  action: z.enum(["price", "pct", "quantity", "type", "archive", "restore", "delete", "feature", "unfeature"]),
  value: z.union([z.number(), z.string()]).optional(),
});

export async function bulkUpdate(raw: z.input<typeof BulkInput>): Promise<Result<{ count: number }>> {
  const parsed = BulkInput.safeParse(raw);
  if (!parsed.success) return fail("Choose some products and an action.");
  const { ids, action, value } = parsed.data;
  const needAdmin = action === "delete" || action === "type";
  const { error: roleErr } = await checkRole(needAdmin ? "admin" : "staff");
  if (roleErr) return fail(roleErr);
  const supabase = await createClient();

  if (action === "delete") {
    const { data: imgs } = await supabase.from("product_images").select("path").in("product_id", ids);
    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) return fail(friendly(error.message));
    if (imgs?.length) await supabase.storage.from("product-images").remove(imgs.map((i) => i.path));
    revalidateStore();
    return { ok: true, data: { count: ids.length } };
  }

  if (action === "pct") {
    const pct = Number(value);
    if (!Number.isFinite(pct) || pct <= -100 || pct > 1000) return fail("Enter a percent like 10 or -15.");
    const { data, error } = await supabase.rpc("admin_adjust_prices", { p_ids: ids, p_pct: pct });
    if (error) return fail(friendly(error.message));
    revalidateStore();
    return { ok: true, data: { count: Number(data) || 0 } };
  }

  let patch: Record<string, unknown>;
  if (action === "price") {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return fail("Enter a price first.");
    patch = { price: Math.round(n * 100) / 100 };
  } else if (action === "quantity") {
    const n = Number(value);
    if (!Number.isInteger(n) || n < 0) return fail("Enter a whole-number quantity.");
    patch = { quantity: n, reserved_quantity: 0 };
  } else if (action === "type") {
    if (typeof value !== "string" || !(value in PRODUCT_TYPES)) return fail("Choose a product type.");
    patch = { product_type: value };
  } else if (action === "archive") patch = { status: "archived" };
  else if (action === "restore") patch = { status: "active" };
  else if (action === "feature") patch = { featured: true };
  else patch = { featured: false };

  const { error } = await supabase.from("products").update(patch).in("id", ids);
  if (error) return fail(friendly(error.message));
  revalidateStore();
  return { ok: true, data: { count: ids.length } };
}

// ─── CSV import ──────────────────────────────────────────────

export async function existingSkus(skus: string[]): Promise<Record<string, { id: string; name: string; price: number; quantity: number }>> {
  const { error: roleErr } = await checkRole("admin");
  if (roleErr) return {};
  const supabase = await createClient();
  const out: Record<string, { id: string; name: string; price: number; quantity: number }> = {};
  const unique = [...new Set(skus.filter(Boolean))].slice(0, 20000);
  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    const { data } = await supabase.from("products").select("id, sku, name, price").in("sku", chunk);
    for (const r of data ?? []) out[r.sku] = { id: r.id, name: r.name, price: Number(r.price), quantity: 0 };
  }
  return out;
}

const ImportRow = z.object({
  kind: z.enum(["new", "update"]),
  id: z.string().uuid().optional(),
  data: z.record(z.unknown()),
});

const IMPORT_FIELDS = new Set(["sku", "name", "product_type", "game", "set_name", "card_number", "rarity", "card_type", "player", "team", "year",
  "manufacturer", "rookie", "parallel", "is_insert", "holo", "language", "condition", "price", "sale_price", "compare_at_price", "cost",
  "quantity", "description", "notes", "tags", "status", "featured", "is_demo"]);

export async function commitImport(rows: z.input<typeof ImportRow>[]): Promise<Result<{ created: number; updated: number; failed: string[] }>> {
  const { error: roleErr } = await checkRole("admin");
  if (roleErr) return fail("Only owners and admins can import.");
  if (!Array.isArray(rows) || rows.length > 5000) return fail("Import up to 5,000 rows at a time.");
  const supabase = await createClient();
  let created = 0, updated = 0;
  const failed: string[] = [];
  const clean = (d: Record<string, unknown>) => Object.fromEntries(Object.entries(d).filter(([k]) => IMPORT_FIELDS.has(k)));

  const parsed = rows.map((r) => ImportRow.safeParse(r)).filter((r) => r.success).map((r) => r.data!);
  const news = parsed.filter((r) => r.kind === "new").map((r) => {
    const row: Record<string, unknown> = { product_type: "single", status: "active", ...clean(r.data) };
    if (!row.sku) row.sku = `${slugBit(String(row.name ?? "ITEM"))}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
    return row;
  });
  for (let i = 0; i < news.length; i += 200) {
    const chunk = news.slice(i, i + 200);
    const { error } = await supabase.from("products").insert(chunk);
    if (error) {
      // Fall back to one at a time so one bad row doesn't sink the batch.
      for (const row of chunk) {
        const { error: e } = await supabase.from("products").insert(row);
        if (e) failed.push(`${(row as { sku?: string }).sku || (row as { name?: string }).name}: ${friendly(e.message)}`); else created++;
      }
    } else created += chunk.length;
  }
  for (const r of parsed.filter((r) => r.kind === "update" && r.id)) {
    const { error } = await supabase.from("products").update(clean(r.data)).eq("id", r.id!);
    if (error) failed.push(`${String(r.data.sku ?? r.id)}: ${friendly(error.message)}`); else updated++;
  }
  await supabase.from("audit_logs").insert({
    actor_id: (await supabase.auth.getUser()).data.user?.id, action: "imported CSV", entity: "products",
    entity_name: `${created} new, ${updated} updated`,
  });
  revalidateStore();
  return { ok: true, data: { created, updated, failed: failed.slice(0, 50) } };
}

// ─── Settings ────────────────────────────────────────────────

const SettingsInput = z.object({
  storeName: z.string().max(80), email: z.string().max(120), phone: z.string().max(40), address: z.string().max(200),
  heroHeadline: z.string().max(120), heroCopy: z.string().max(400), announcement: z.string().max(240),
  shippingEnabled: z.boolean(), shippingFlat: z.coerce.number().min(0).max(1000), freeShippingOver: z.coerce.number().min(0).max(100000),
  pickupEnabled: z.boolean(), pickupFee: z.coerce.number().min(0).max(1000),
  lowStock: z.coerce.number().int().min(0).max(1000),
  pointsPerDollar: z.coerce.number().min(0).max(100), rewardThreshold: z.coerce.number().int().min(1).max(1000000), rewardAmount: z.coerce.number().min(0).max(10000),
  aboutText: z.string().max(5000),
  instagram: z.string().max(300), facebook: z.string().max(300), tiktok: z.string().max(300),
}).partial();

export async function saveSettings(raw: Record<string, unknown>): Promise<Result> {
  const { viewer, error: roleErr } = await checkRole("admin");
  if (roleErr) return fail("Only owners and admins can change settings.");
  const parsed = SettingsInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the settings and try again.");
  for (const k of ["instagram", "facebook", "tiktok"] as const) {
    const u = parsed.data[k];
    if (u && !/^https:\/\//.test(u)) return fail("Social links must start with https://");
  }
  const supabase = await createClient();
  const { data: cur } = await supabase.from("store_settings").select("data").eq("id", 1).maybeSingle();
  const before = { ...DEFAULT_SETTINGS, ...((cur?.data as object) ?? {}) } as Record<string, unknown>;
  const next = { ...before, ...parsed.data };
  const { error } = await supabase.from("store_settings").update({ data: next, updated_at: new Date().toISOString() }).eq("id", 1);
  if (error) return fail(friendly(error.message));
  const changed = Object.keys(parsed.data).filter((k) => JSON.stringify(before[k]) !== JSON.stringify((next as Record<string, unknown>)[k]));
  if (changed.length) {
    await supabase.from("audit_logs").insert(changed.map((k) => ({
      actor_id: viewer!.id, actor_email: viewer!.email, action: "changed", entity: "settings", entity_name: "Settings",
      field: k, old_value: String(before[k] ?? ""), new_value: String((next as Record<string, unknown>)[k] ?? ""),
    })));
  }
  revalidateStore();
  return { ok: true };
}

// ─── Events ──────────────────────────────────────────────────

const EventInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Add an event name.").max(140),
  starts_on: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date."),
  start_time: z.string().trim().max(40).optional().transform((v) => v || null),
  description: z.string().trim().max(2000).optional().transform((v) => v || null),
  entry_fee: z.coerce.number().min(0).max(10000).default(0),
  capacity: z.union([z.literal(""), z.coerce.number().int().min(0).max(100000)]).optional().transform((v) => (v === "" || v == null ? null : v)),
  registration: z.enum(["walkin", "open", "full", "closed"]),
});

export async function saveEvent(raw: Record<string, unknown>): Promise<Result> {
  const { error: roleErr } = await checkRole("staff");
  if (roleErr) return fail(roleErr);
  const parsed = EventInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the event details.");
  const { id, ...row } = parsed.data;
  const supabase = await createClient();
  const { error } = id
    ? await supabase.from("events").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id)
    : await supabase.from("events").insert(row);
  if (error) return fail(friendly(error.message));
  revalidateStore();
  return { ok: true };
}

export async function deleteEvent(id: string): Promise<Result> {
  const { error: roleErr } = await checkRole("staff");
  if (roleErr) return fail(roleErr);
  const supabase = await createClient();
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return fail(friendly(error.message));
  revalidateStore();
  return { ok: true };
}

// ─── Rewards ─────────────────────────────────────────────────

const MemberInput = z.object({
  name: z.string().trim().min(1, "Add the member's name.").max(120),
  phone: z.string().trim().max(30).optional().transform((v) => v || null),
  email: z.string().trim().max(120).optional().transform((v) => v || null),
  start: z.coerce.number().int().min(0).max(1000000).default(0),
});

export async function addMember(raw: Record<string, unknown>): Promise<Result<{ id: string }>> {
  const { error: roleErr } = await checkRole("staff");
  if (roleErr) return fail(roleErr);
  const parsed = MemberInput.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the member details.");
  const { start, ...m } = parsed.data;
  if (m.email && !z.string().email().safeParse(m.email).success) return fail("That email address doesn't look right.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("rewards_members").insert(m).select("id").single();
  if (error) return fail(/duplicate key.*phone/i.test(error.message) ? "A member with that phone number already exists." : friendly(error.message));
  if (start > 0) await supabase.rpc("rewards_apply", { p_member: data.id, p_kind: "adjust", p_amount: start, p_note: "Starting balance" });
  revalidatePath("/admin/rewards");
  return { ok: true, data: { id: data.id } };
}

export async function rewardsAction(memberId: string, kind: "purchase" | "redeem" | "adjust", amount: number | null, note?: string): Promise<Result<{ points: number }>> {
  const { error: roleErr } = await checkRole("staff");
  if (roleErr) return fail(roleErr);
  if (!z.string().uuid().safeParse(memberId).success) return fail("Unknown member.");
  if (kind !== "redeem" && (amount == null || !Number.isFinite(amount))) return fail(kind === "purchase" ? "Enter the purchase total." : "Enter a number of points.");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rewards_apply", { p_member: memberId, p_kind: kind, p_amount: amount, p_note: note?.slice(0, 200) || null });
  if (error) {
    const known = ["Not enough points to redeem", "Enter the purchase total", "Member not found"].find((m) => error.message.includes(m));
    return fail(known ? known + "." : friendly(error.message));
  }
  revalidatePath(`/admin/rewards/${memberId}`);
  revalidatePath("/admin/rewards");
  return { ok: true, data: { points: (data as { points: number }).points } };
}

export async function deleteMember(memberId: string): Promise<Result> {
  const { error: roleErr } = await checkRole("admin");
  if (roleErr) return fail("Only owners and admins can delete members.");
  const supabase = await createClient();
  const { error } = await supabase.from("rewards_members").delete().eq("id", memberId);
  if (error) return fail(friendly(error.message));
  revalidatePath("/admin/rewards");
  return { ok: true };
}

// ─── Team ────────────────────────────────────────────────────

export async function setRole(email: string, role: "owner" | "admin" | "staff" | "customer"): Promise<Result> {
  const { viewer, error: roleErr } = await checkRole("owner");
  if (roleErr) return fail("Only the owner can change roles.");
  if (!["owner", "admin", "staff", "customer"].includes(role)) return fail("Choose a role.");
  const supabase = await createClient();
  const { data: target } = await supabase.from("profiles").select("id, email").ilike("email", email.trim()).maybeSingle();
  if (!target) return fail("No account with that email yet. Invite them first in Supabase (Authentication → Users → Invite).");
  if (target.id === viewer!.id && role !== "owner") return fail("You can't remove your own owner role.");
  const { error } = await supabase.from("profiles").update({ role }).eq("id", target.id);
  if (error) return fail(friendly(error.message));
  await supabase.from("audit_logs").insert({ actor_id: viewer!.id, actor_email: viewer!.email, action: "changed", entity: "team", entity_name: target.email, field: "role", new_value: role });
  revalidatePath("/admin/team");
  return { ok: true };
}
