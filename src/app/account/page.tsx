import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";

export const metadata = { title: "My account", robots: { index: false } };

export default async function AccountHome() {
  const supabase = await createClient();
  const [st, { count: saved }, { count: addresses }] = await Promise.all([
    getSettings(),
    supabase.from("favorites").select("product_id", { count: "exact", head: true }),
    supabase.from("addresses").select("id", { count: "exact", head: true }),
  ]);
  const tiles: [string, string, string][] = [
    ["/account/orders", "Orders", "Online ordering opens soon"],
    ["/account/saved", "Saved items", `${saved ?? 0} saved`],
    ["/account/addresses", "Addresses", `${addresses ?? 0} saved`],
  ];
  return (
    <>
      <div className="kpis">
        {tiles.map(([h, k, v]) => (
          <Link key={h} href={h} className="kpi" style={{ textDecoration: "none" }}><div className="k">{k}</div><div style={{ marginTop: 10, fontSize: 17 }}>{v}</div></Link>
        ))}
      </div>
      <div className="panel">
        <h3>Frontier Rewards</h3>
        {st.rewardsLive
          ? <p className="muted" style={{ margin: 0 }}>Ask staff for your points balance at the store. Online balances are on the way.</p>
          : <p className="muted" style={{ margin: 0 }}>Rewards are coming soon. Your account is ready, so you&apos;ll be set up the day they launch.</p>}
      </div>
      <div className="panel">
        <h3>Looking for something?</h3>
        <p className="muted" style={{ margin: "0 0 14px" }}>Tap the ♡ Save button on any product to keep a list of cards you&apos;re hunting for.</p>
        <Link className="btn gold" href="/finder">Open the Card Finder</Link>
      </div>
    </>
  );
}
