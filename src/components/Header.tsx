import Link from "next/link";
import Image from "next/image";
import { getViewer, hasRole } from "@/lib/auth";
import { HeaderSearch } from "./HeaderSearch";
import { NavLinks } from "./NavLinks";
import { CartCount } from "./CartCount";
import { AdminIcon, CartIcon, UserIcon } from "./Icons";

export async function Header() {
  const viewer = await getViewer().catch(() => null);
  const isStaff = !!viewer && hasRole(viewer.role, "staff");
  return (
    <header className="site">
      <div className="wrap hrow">
        <Link className="logo" href="/" aria-label="Frontier TCG home">
          <Image src="/logo.webp" alt="Frontier TCG" width={154} height={26} priority />
        </Link>
        <HeaderSearch />
        <div className="hutil">
          {isStaff && (
            <Link className="icon-btn" href="/admin" title="Store admin" aria-label="Store admin"><AdminIcon /></Link>
          )}
          <Link className="icon-btn" href="/account" title="Account" aria-label="Account"><UserIcon /></Link>
          <Link className="icon-btn" href="/cart" title="Cart" aria-label="Cart"><CartIcon /><CartCount /></Link>
        </div>
      </div>
      <nav className="cats" aria-label="Shop categories"><div className="wrap"><NavLinks /></div></nav>
    </header>
  );
}
