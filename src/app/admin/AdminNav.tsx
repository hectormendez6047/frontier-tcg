"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ isAdmin, isOwner }: { isAdmin: boolean; isOwner: boolean }) {
  const path = usePathname();
  const items: [string, string, boolean][] = [
    ["/admin", "Dashboard", true],
    ["/admin/products", "Products", true],
    ["/admin/import", "Import / Export", isAdmin],
    ["/admin/rewards", "Rewards", true],
    ["/admin/customers", "Customers", isAdmin],
    ["/admin/events", "Events", true],
    ["/admin/settings", "Settings", isAdmin],
    ["/admin/team", "Team", isOwner],
    ["/admin/activity", "Activity log", isAdmin],
  ];
  return (
    <nav className="anav" aria-label="Admin sections">
      {items.filter(([, , show]) => show).map(([href, label]) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return <Link key={href} href={href} className="anav-link" aria-current={active ? "page" : undefined}>{label}</Link>;
      })}
    </nav>
  );
}
