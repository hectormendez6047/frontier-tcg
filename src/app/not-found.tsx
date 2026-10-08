import Link from "next/link";

export default function NotFound() {
  return (
    <div className="wrap" style={{ padding: "60px 0" }}>
      <div className="empty">
        <h3>We couldn&apos;t find that page</h3>
        <p>It may have sold out or moved.</p>
        <p style={{ display: "flex", gap: 10, justifyContent: "center" }}><Link className="btn gold" href="/finder">Search the Card Finder</Link><Link className="btn" href="/">Home</Link></p>
      </div>
    </div>
  );
}
