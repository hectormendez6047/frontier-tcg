import type { Metadata } from "next";
import { requireRole, hasRole } from "@/lib/auth";
import { AdminNav } from "./AdminNav";

export const metadata: Metadata = { title: { default: "Store admin", template: "%s · Admin" }, robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireRole("staff");
  return (
    <div className="wrap">
      <div className="page-head no-print" style={{ paddingBottom: 0, display: "flex", justifyContent: "space-between", alignItems: "end", gap: 16, flexWrap: "wrap" }}>
        <div><div className="eyebrow">Frontier TCG</div><h1>Store admin</h1></div>
        <div className="muted" style={{ fontSize: 14 }}>
          {viewer.email} · <span className="pill">{viewer.role}</span> · <a href="/auth/signout">Sign out</a>
        </div>
      </div>
      <div className="admin">
        <AdminNav isAdmin={hasRole(viewer.role, "admin")} isOwner={viewer.role === "owner"} />
        <div style={{ minWidth: 0 }}>{children}</div>
      </div>
    </div>
  );
}
