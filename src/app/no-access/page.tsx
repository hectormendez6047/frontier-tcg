import Link from "next/link";

export const metadata = { title: "No access", robots: { index: false } };

export default function NoAccess() {
  return (
    <div className="wrap" style={{ padding: "60px 0", maxWidth: 640 }}>
      <div className="empty">
        <h3>This area is for Frontier TCG staff</h3>
        <p>Your account doesn&apos;t have access to this page. Ask the store owner to give you a staff role.</p>
        <p><Link className="btn" href="/">Back to the store</Link></p>
      </div>
    </div>
  );
}
