import type { Metadata } from "next";
import Link from "next/link";
import { getSettings } from "@/lib/data";
import { money } from "@/lib/format";
import { rewardExplainer } from "@/lib/settings";

export const metadata: Metadata = { title: "Frontier Rewards", description: "Frontier Rewards: points, coupons and member rewards at Frontier TCG.", alternates: { canonical: "/rewards" } };

export default async function Rewards() {
  const st = await getSettings();
  if (!st.rewardsLive) {
    return (
      <div className="wrap">
        <div className="page-head"><div className="eyebrow">Loyalty</div><h1>Frontier Rewards</h1><p>Coming soon.</p></div>
        <div className="prose" style={{ padding: "24px 0 64px" }}>
          <p>We&apos;re building a rewards program for our regulars: points on purchases, money-off coupons and member-only rewards like free packs.</p>
          <p>It isn&apos;t live yet, so purchases don&apos;t earn points today. Create a free account now and you&apos;ll be first in line when it launches.</p>
          <p style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><Link className="btn gold" href="/signup">Create an account</Link><Link className="btn" href="/finder">Find a card</Link></p>
        </div>
      </div>
    );
  }
  return (
    <div className="wrap">
      <div className="page-head"><div className="eyebrow">Loyalty</div><h1>Frontier Rewards</h1><p>Points on every purchase.</p></div>
      <div style={{ padding: "28px 0 64px" }}>
        <div className="kpis" style={{ maxWidth: 860 }}>
          <div className="kpi"><div className="k">Earn</div><div className="v">{st.pointsPerDollar} pt</div><div className="s">for every $1 spent</div></div>
          <div className="kpi"><div className="k">Reach</div><div className="v">{st.rewardThreshold} pts</div><div className="s">to unlock a reward</div></div>
          <div className="kpi"><div className="k">Get</div><div className="v">{money(st.rewardAmount)}</div><div className="s">off a purchase</div></div>
        </div>
        <div className="prose"><p>{rewardExplainer(st)}</p><p>Ask staff for your balance any time. We also send members special rewards from time to time.</p></div>
      </div>
    </div>
  );
}
