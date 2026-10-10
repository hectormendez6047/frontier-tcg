"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { EMAIL_TOPICS } from "@/lib/constants";

type Result = { ok: true } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function updateProfile(raw: { full_name: string; phone: string }): Promise<Result> {
  const { supabase, user } = await me();
  if (!user) return fail("Please sign in again.");
  const parsed = z.object({ full_name: z.string().trim().min(1, "Enter your name.").max(120), phone: z.string().trim().max(30) }).safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check your details.");
  const { error } = await supabase.from("profiles").update({ full_name: parsed.data.full_name, phone: parsed.data.phone || null }).eq("id", user.id);
  if (error) return fail("Couldn't save your profile. Please try again.");
  revalidatePath("/account", "layout");
  return { ok: true };
}

export async function saveEmailPrefs(raw: Record<string, boolean>): Promise<Result> {
  const { supabase, user } = await me();
  if (!user) return fail("Please sign in again.");
  const prefs: Record<string, boolean> = {};
  for (const [k] of EMAIL_TOPICS) prefs[k] = !!raw[k];
  const any = Object.values(prefs).some(Boolean);
  const { error } = await supabase.from("profiles").update({ email_prefs: prefs, marketing_opt_in: any }).eq("id", user.id);
  if (error) return fail("Couldn't save your email choices. Please try again.");
  revalidatePath("/account/emails");
  return { ok: true };
}

const Address = z.object({
  id: z.string().uuid().optional(),
  full_name: z.string().trim().min(1, "Enter the name for this address.").max(120),
  line1: z.string().trim().min(1, "Enter the street address.").max(200),
  line2: z.string().trim().max(200).optional().transform((v) => v || null),
  city: z.string().trim().min(1, "Enter the city.").max(100),
  state: z.string().trim().min(2, "Enter the state.").max(40),
  zip: z.string().trim().regex(/^\d{5}(-\d{4})?$/, "Enter a 5-digit ZIP code."),
  phone: z.string().trim().max(30).optional().transform((v) => v || null),
  is_default: z.boolean().default(false),
});

export async function saveAddress(raw: Record<string, unknown>): Promise<Result> {
  const { supabase, user } = await me();
  if (!user) return fail("Please sign in again.");
  const parsed = Address.safeParse(raw);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Check the address.");
  const { id, ...row } = parsed.data;
  const { count } = await supabase.from("addresses").select("id", { count: "exact", head: true });
  if (!id && (count ?? 0) >= 10) return fail("You can save up to 10 addresses.");
  if (row.is_default || !count) {
    await supabase.from("addresses").update({ is_default: false }).eq("user_id", user.id);
    row.is_default = true;
  }
  const { error } = id
    ? await supabase.from("addresses").update(row).eq("id", id)
    : await supabase.from("addresses").insert({ ...row, user_id: user.id });
  if (error) return fail("Couldn't save the address. Please try again.");
  revalidatePath("/account/addresses");
  return { ok: true };
}

export async function deleteAddress(id: string): Promise<Result> {
  const { supabase, user } = await me();
  if (!user) return fail("Please sign in again.");
  const { error } = await supabase.from("addresses").delete().eq("id", id);
  if (error) return fail("Couldn't delete the address.");
  revalidatePath("/account/addresses");
  return { ok: true };
}

/** Save or unsave a product. Returns the new state. */
export async function toggleFavorite(productId: string): Promise<{ ok: true; saved: boolean } | { ok: false; error: string; signIn?: boolean }> {
  const { supabase, user } = await me();
  if (!user) return { ok: false, error: "Sign in to save cards.", signIn: true };
  if (!z.string().uuid().safeParse(productId).success) return { ok: false, error: "Unknown product." };
  const { data: existing } = await supabase.from("favorites").select("product_id").eq("product_id", productId).maybeSingle();
  if (existing) {
    await supabase.from("favorites").delete().eq("product_id", productId).eq("user_id", user.id);
    revalidatePath("/account/saved");
    return { ok: true, saved: false };
  }
  const { count } = await supabase.from("favorites").select("product_id", { count: "exact", head: true });
  if ((count ?? 0) >= 500) return { ok: false, error: "You've saved 500 items. Remove some to save more." };
  const { error } = await supabase.from("favorites").insert({ user_id: user.id, product_id: productId });
  if (error) return { ok: false, error: "Couldn't save that. Please try again." };
  revalidatePath("/account/saved");
  return { ok: true, saved: true };
}
