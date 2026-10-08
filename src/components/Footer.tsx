import Link from "next/link";
import Image from "next/image";
import { getSettings } from "@/lib/data";

export async function Footer() {
  const st = await getSettings();
  const socials = ([["instagram", "Instagram"], ["facebook", "Facebook"], ["tiktok", "TikTok"]] as const).filter(([k]) => st[k]);
  return (
    <footer className="site">
      <div className="wrap">
        <div className="fgrid">
          <div>
            <Image src="/logo.webp" alt="Frontier TCG" width={130} height={22} />
            <p className="muted" style={{ fontSize: 14.5, margin: "14px 0 0", maxWidth: "34ch" }}>
              Trading • Collectibles • Gaming<br />{st.address}
            </p>
            {(st.email || st.phone) && (
              <p style={{ fontSize: 14.5, margin: "10px 0 0" }}>{[st.email, st.phone].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <div>
            <h4>Shop</h4>
            <ul>
              <li><Link href="/finder">Card Finder</Link></li>
              <li><Link href="/shop/pokemon">Pokémon</Link></li>
              <li><Link href="/shop/sports">Sports Cards</Link></li>
              <li><Link href="/shop/sealed">Sealed</Link></li>
              <li><Link href="/bulk">Bulk</Link></li>
              <li><Link href="/shop/accessories">Accessories</Link></li>
            </ul>
          </div>
          <div>
            <h4>Store</h4>
            <ul>
              <li><Link href="/events">Events</Link></li>
              <li><Link href="/rewards">Rewards</Link></li>
              <li><Link href="/about">About &amp; contact</Link></li>
              {socials.map(([k, l]) => (
                <li key={k}><a href={st[k]} target="_blank" rel="noopener noreferrer">{l}</a></li>
              ))}
            </ul>
          </div>
          <div>
            <h4>Policies</h4>
            <ul>
              <li><Link href="/policies/privacy">Privacy</Link></li>
              <li><Link href="/policies/terms">Terms</Link></li>
              <li><Link href="/policies/shipping">Shipping</Link></li>
              <li><Link href="/policies/returns">Returns</Link></li>
            </ul>
          </div>
        </div>
        <div className="fine">
          <span>© {new Date().getFullYear()} Frontier TCG · Laredo, Texas</span>
          <span>frontiertcgshop.com</span>
        </div>
      </div>
    </footer>
  );
}
