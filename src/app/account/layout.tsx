import { redirect } from "next/navigation";
import { getViewer, hasRole } from "@/lib/auth";
import { AccountNav } from "./AccountNav";

export const dynamic = "force-dynamic";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login?next=/account");
  return (
    <div className="wrap">
      <div className="page-head" style={{ paddingBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap" }}>
        <div><div className="eyebrow">My account</div><h1>{viewer.name ? `Hi, ${viewer.name.split(" ")[0]}` : "My account"}</h1></div>
        <div className="muted" style={{ fontSize: 14 }}>{viewer.email} · <a href="/auth/signout">Sign out</a></div>
      </div>
      <div className="admin">
        <AccountNav isStaff={hasRole(viewer.role, "staff")} />
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
