"use client";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/** A thin gold bar at the top of the screen while a new page loads, so taps never feel ignored. */
export function NavProgress() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [loading, setLoading] = useState(false);

  useEffect(() => { setLoading(false); }, [pathname, search]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
      let url: URL;
      try { url = new URL(href, location.href); } catch { return; }
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      setLoading(true);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setLoading(false), 12000);
    return () => clearTimeout(t);
  }, [loading]);

  return <div className={`navbar${loading ? " on" : ""}`} aria-hidden="true" />;
}
