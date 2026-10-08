import type { Metadata } from "next";
import { getSettings } from "@/lib/data";
import { money } from "@/lib/format";
import { rewardExplainer } from "@/lib/settings";

export const metadata: Metadata = { title: "Frontier Rewards", description: "Earn points on every purchase at Frontier TCG.", alternates: { canonical: "/rewards" } };

export default async function Rewards() {
  const st = await getSettings();
  return (
    <div className="wrap">
      <div className="page-head"><div className="eyebrow">Loyalty</div><h1>Frontier Rewards</h1><p>Points on every purchase in the shop.</p></div>
      <div style={{ padding: "28px 0 64px" }}>
        <div className="kpis" style={{ maxWidth: 860 }}>
          <div className="kpi"><div className="k">Earn</div><div className="v">{st.pointsPerDollar} pt</div><div className="s">for every $1 spent</div></div>
          <div className="kpi"><div className="k">Reach</div><div className="v">{st.rewardThreshold} pts</div><div className="s">to unlock a reward</div></div>
          <div className="kpi"><div className="k">Get</div><div className="v">{money(st.rewardAmount)}</div><div className="s">off a purchase</div></div>
        </div>
        <div className="prose">
          <p>{rewardExplainer(st)}</p>
          <p>Join at the register: give us your name and phone number and we&apos;ll start tracking your points. Ask staff for your balance any time. Points on online orders arrive with customer accounts.</p>
        </div>
      </div>
    </div>
  );
}
