"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV } from "@/lib/constants";

export function NavLinks() {
  const path = usePathname();
  return (
    <ul>
      {NAV.map(([href, label]) => {
        const active = href === "/" ? path === "/" : path === href || (href !== "/shop" && path.startsWith(href + "/"));
        return (
          <li key={href}>
            <Link href={href} className={href === "/finder" ? "finder" : undefined} aria-current={active ? "page" : undefined}>{label}</Link>
          </li>
        );
      })}
    </ul>
  );
}
