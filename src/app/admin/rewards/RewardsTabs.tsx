"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function RewardsTabs() {
  const path = usePathname();
  const tabs: [string, string][] = [["/admin/rewards", "Members"], ["/admin/rewards/catalog", "Rewards & giveaways"]];
  return (
    <div style={{ display: "flex", gap: 6, marginBottom: 18, borderBottom: "1px solid var(--line)", flexWrap: "wrap" }}>
      {tabs.map(([h, l]) => {
        const on = h === "/admin/rewards" ? path === h || /^\/admin\/rewards\/[0-9a-f-]{36}$/.test(path) : path.startsWith(h);
        return (
          <Link key={h} href={h} style={{ padding: "10px 12px", textDecoration: "none", font: "600 14px/1 var(--display)", letterSpacing: ".09em", textTransform: "uppercase",
            color: on ? "var(--fg)" : "var(--muted)", borderBottom: `2px solid ${on ? "var(--gold)" : "transparent"}`, marginBottom: -1 }}>{l}</Link>
        );
      })}
    </div>
  );
}
