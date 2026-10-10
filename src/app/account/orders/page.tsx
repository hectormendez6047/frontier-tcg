import Link from "next/link";

export const metadata = { title: "Orders", robots: { index: false } };

export default function Orders() {
  return (
    <div className="empty" style={{ textAlign: "left" }}>
      <h3>No orders yet</h3>
      <p>Online ordering with shipping opens soon. Once it does, every order you place shows up here with its status and tracking number.</p>
      <p><Link className="btn" href="/finder">Browse the Card Finder</Link></p>
    </div>
  );
}
