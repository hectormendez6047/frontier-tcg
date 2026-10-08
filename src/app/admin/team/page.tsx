import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TeamForm } from "./TeamForm";

export const metadata = { title: "Team" };

export default async function Team() {
  await requireRole("owner");
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, email, role").in("role", ["owner", "admin", "staff"]).order("role");
  return (
    <>
      <div className="panel">
        <h3>Who can use the admin</h3>
        <table className="at" style={{ minWidth: 0 }}>
          <thead><tr><th>Email</th><th>Role</th></tr></thead>
          <tbody>{(data ?? []).map((p) => <tr key={p.id}><td>{p.email}</td><td><span className="pill">{p.role}</span></td></tr>)}</tbody>
        </table>
      </div>
      <div className="panel">
        <h3>Add or change a team member</h3>
        <p className="muted" style={{ margin: "0 0 14px", fontSize: 15 }}>
          First invite them in Supabase (Authentication → Users → Invite user). Once they&apos;ve set a password, enter their email here and pick a role.
          Staff can edit prices, stock, rewards and events. Admins can also add, import and delete products and change settings. Owners can also manage the team.
        </p>
        <TeamForm />
      </div>
    </>
  );
}
