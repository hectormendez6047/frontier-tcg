"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AccountNav({ isStaff }: { isStaff: boolean }) {
  const path = usePathname();
  const items: [string, string][] = [
    ["/account", "Overview"], ["/account/orders", "Orders"], ["/account/saved", "Saved items"], ["/account/addresses", "Addresses"],
    ["/account/profile", "Profile & password"], ["/account/emails", "Email preferences"],
  ];
  return (
    <nav className="anav" aria-label="Account sections">
      {items.map(([href, label]) => (
        <Link key={href} href={href} className="anav-link" aria-current={(href === "/account" ? path === href : path.startsWith(href)) ? "page" : undefined}>{label}</Link>
      ))}
      {isStaff && <Link href="/admin" className="anav-link" style={{ color: "var(--gold)" }}>Store admin →</Link>}
    </nav>
  );
}
