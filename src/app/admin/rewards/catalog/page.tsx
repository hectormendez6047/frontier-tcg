import { createClient } from "@/lib/supabase/server";
import { getViewer, hasRole } from "@/lib/auth";
import { CatalogManager, type CatalogItem } from "./CatalogManager";

export const metadata = { title: "Rewards & giveaways" };

export default async function CatalogPage() {
  const supabase = await createClient();
  const [viewer, { data: items }, { data: members }, { data: recent }] = await Promise.all([
    getViewer(),
    supabase.from("rewards_catalog").select("*").order("created_at"),
    supabase.from("rewards_members").select("id, name, phone, points").order("name").limit(2000),
    supabase.from("member_rewards").select("id, code, status, issued_at, expires_at, redeemed_at, reward_id, member_id").order("issued_at", { ascending: false }).limit(50),
  ]);
  return (
    <CatalogManager items={(items ?? []) as CatalogItem[]} members={(members ?? []) as { id: string; name: string; phone: string | null; points: number }[]}
      recent={(recent ?? []) as { id: string; code: string; status: string; issued_at: string; expires_at: string | null; redeemed_at: string | null; reward_id: string; member_id: string }[]}
      isAdmin={!!viewer && hasRole(viewer.role, "admin")} />
  );
}
