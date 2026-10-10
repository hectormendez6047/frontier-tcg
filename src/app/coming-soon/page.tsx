import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = {
  title: "Frontier TCG",
  description: "Frontier TCG's online store is coming soon. Trading cards, collectibles and gaming in Laredo, Texas.",
  robots: { index: false, follow: false },
};

export default async function ComingSoon() {
  const st = await getSettings();
  const maint = st.siteMode === "maintenance";
  const socials = ([["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"]] as const).filter(([k]) => st[k]);
  return (
    <main className="soon">
      <div className="soon-inner">
        <Image src="/logo.webp" alt="Frontier TCG" width={320} height={54} priority className="soon-logo" />
        <div className="soon-rule" aria-hidden="true" />
        <p className="eyebrow">Trading • Collectibles • Gaming</p>
        <h1>{maint ? "Be right back" : "Coming soon"}</h1>
        <p className="soon-msg">{maint ? st.maintenanceMessage : st.comingSoonMessage}</p>
        {!maint && <p style={{ margin: 0 }}><Link className="btn" href="/signup">Create your account early</Link></p>}
        <dl className="soon-info">
          {st.address && (<div><dt>Shop</dt><dd>{st.address}</dd></div>)}
          {st.email && (<div><dt>Email</dt><dd>{st.email}</dd></div>)}
          {st.phone && (<div><dt>Phone</dt><dd>{st.phone}</dd></div>)}
        </dl>
        {socials.length > 0 && (
          <p className="soon-social">
            {socials.map(([k, l]) => <a key={k} href={st[k]} target="_blank" rel="noopener noreferrer">{l}</a>)}
          </p>
        )}
      </div>
      <footer className="soon-foot">
        <span>© {new Date().getFullYear()} Frontier TCG · frontiertcgshop.com</span>
        <Link href="/login">Staff sign in</Link>
      </footer>
    </main>
  );
}
