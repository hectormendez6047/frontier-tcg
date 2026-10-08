import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { Role } from "./types";

const RANK: Record<Role, number> = { customer: 0, staff: 1, admin: 2, owner: 3 };

export async function getViewer() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select("role, email, full_name").eq("id", user.id).maybeSingle();
  return { id: user.id, email: user.email ?? data?.email ?? "", name: data?.full_name ?? "", role: (data?.role ?? "customer") as Role };
}

export const hasRole = (role: Role, min: Role) => RANK[role] >= RANK[min];

/** Use at the top of every admin page and server action. Checks the role on the server. */
export async function requireRole(min: Role = "staff") {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/admin");
  if (!hasRole(viewer.role, min)) redirect("/no-access");
  return viewer;
}

/** For server actions: returns an error instead of redirecting. */
export async function checkRole(min: Role = "staff") {
  const viewer = await getViewer();
  if (!viewer || !hasRole(viewer.role, min)) return { viewer: null, error: "You don't have permission to do that." } as const;
  return { viewer, error: null } as const;
}
