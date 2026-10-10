import Link from "next/link";
import { getFacets, getFeatured, getNewArrivals, getNewSealed, getSettings, getUpcomingEvents } from "@/lib/data";
import { ProductGrid } from "@/components/ProductCard";
import { HeroFinder } from "@/components/HeroFinder";
import { CategoryTiles } from "@/components/CategoryTiles";
import { EventRow } from "@/components/EventRow";
import { EmptyState } from "@/components/EmptyState";
import { money } from "@/lib/format";

export default async function Home() {
  const [st, facets, featured, newest, sealed, events] = await Promise.all([
    getSettings(), getFacets(), getFeatured(8), getNewArrivals(8), getNewSealed(4), getUpcomingEvents(3),
  ]);
  const lowAt = Number(st.lowStock) || 3;
  return (
    <>
      {st.announcement && <div className="wrap" style={{ paddingTop: 14 }}><div className="notice">{st.announcement}</div></div>}

      <section className="hero">
        <div className="wrap grid">
          <div>
            <h1>Frontier <span className="tcg">TCG</span></h1>
            <div className="tag">{st.heroHeadline}</div>
            <p className="lede">{st.heroCopy}</p>
            <div className="ctas">
              <Link className="btn gold" href="/shop">Shop now</Link>
              <Link className="btn" href="/finder">Find a card</Link>
            </div>
          </div>
          <HeroFinder />
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="sec-head"><h2>Shop by category</h2><Link href="/shop">All products →</Link></div>
          <CategoryTiles counts={facets.counts ?? {}} />
        </div>
      </section>

      <section className="band">
        <div className="wrap inner">
          <div>
            <div className="eyebrow">Card Finder</div>
            <h2 style={{ marginTop: 10 }}>Looking for a <span>specific card?</span></h2>
            <p className="muted" style={{ margin: "10px 0 0", maxWidth: "52ch" }}>Search our inventory by name, set, card number or player and see what&apos;s in stock right now.</p>
          </div>
          <Link className="btn gold" href="/finder">Find a card</Link>
        </div>
      </section>

      {featured.length > 0 && (
        <section className="block">
          <div className="wrap">
            <div className="sec-head"><h2>Featured</h2><Link href="/shop">Shop all →</Link></div>
            <ProductGrid products={featured} lowAt={lowAt} />
          </div>
        </section>
      )}

      {sealed.length > 0 && (
        <section className="block" style={featured.length ? { paddingTop: 0 } : undefined}>
          <div className="wrap">
            <div className="sec-head">
              <div><div className="eyebrow" style={{ marginBottom: 8 }}>Booster boxes · ETBs · Bundles · Hobby boxes</div><h2>Sealed product</h2></div>
              <Link href="/shop/sealed">All sealed →</Link>
            </div>
            <ProductGrid products={sealed} lowAt={lowAt} />
          </div>
        </section>
      )}

      <section className="block" style={featured.length || sealed.length ? { paddingTop: 0 } : undefined}>
        <div className="wrap">
          <div className="sec-head"><h2>New arrivals</h2><Link href="/shop?sort=new">Shop all →</Link></div>
          {newest.length ? <ProductGrid products={newest} lowAt={lowAt} /> : (
            <EmptyState title="New stock is on the way"><p>Products added in the admin show up here automatically.</p></EmptyState>
          )}
        </div>
      </section>

      <section className="block" style={{ paddingTop: 0 }}>
        <div className="wrap split">
          <div>
            <div className="eyebrow">Upcoming events</div>
            {events.length ? <div>{events.map((e) => <EventRow key={e.id} e={e} />)}</div> : <p className="muted" style={{ margin: 0 }}>League nights and tournaments will be posted here.</p>}
            <Link href="/events" className="btn sm" style={{ alignSelf: "flex-start" }}>All events</Link>
          </div>
          <div>
            <div className="eyebrow">Frontier Rewards</div>
            {st.rewardsLive ? (<>
              <h3 style={{ fontSize: 28 }}>Earn on every purchase</h3>
              <p className="muted" style={{ margin: 0 }}>
                Get {st.pointsPerDollar} point{Number(st.pointsPerDollar) === 1 ? "" : "s"} for every dollar you spend. Every {st.rewardThreshold} points is {money(st.rewardAmount)} off a future purchase.
              </p>
              <Link href="/rewards" className="btn sm" style={{ alignSelf: "flex-start" }}>How it works</Link>
            </>) : (<>
              <h3 style={{ fontSize: 28 }}>Rewards are coming soon</h3>
              <p className="muted" style={{ margin: 0 }}>Points, coupons and member-only rewards are on the way. Create an account now and you&apos;ll be ready when they launch.</p>
              <Link href="/signup" className="btn sm" style={{ alignSelf: "flex-start" }}>Create an account</Link>
            </>)}
          </div>
        </div>
      </section>
    </>
  );
}
