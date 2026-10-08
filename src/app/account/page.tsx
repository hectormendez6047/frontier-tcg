import Link from "next/link";
import { getViewer, hasRole } from "@/lib/auth";

export const metadata = { title: "My account", robots: { index: false } };

export default async function Account() {
  const viewer = await getViewer();
  return (
    <div className="wrap">
      <div className="page-head"><h1>My account</h1></div>
      <div style={{ padding: "24px 0 64px", maxWidth: 640 }}>
        <div className="empty" style={{ textAlign: "left" }}>
          {viewer ? (
            <>
              <h3>Signed in as {viewer.email}</h3>
              <p>Order history, saved cards, addresses and rewards will appear here when customer accounts launch.</p>
              <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {hasRole(viewer.role, "staff") && <Link className="btn gold" href="/admin">Open store admin</Link>}
                <a className="btn" href="/auth/signout">Sign out</a>
              </p>
            </>
          ) : (
            <>
              <h3>Customer accounts are coming soon</h3>
              <p>Order history, saved cards, addresses and Frontier Rewards will live here once customer sign-in launches.</p>
              <p><Link className="btn" href="/login">Staff sign in</Link></p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
