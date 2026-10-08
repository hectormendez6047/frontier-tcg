"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { PRODUCT_TYPES } from "@/lib/constants";

export function ProductsToolbar({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [q, setQ] = useState(sp.get("q") ?? "");
  const first = useRef(true);
  const go = (patch: Record<string, string | null>) => {
    const u = new URLSearchParams(sp.toString());
    Object.entries(patch).forEach(([k, v]) => (v ? u.set(k, v) : u.delete(k)));
    u.delete("page");
    router.replace(`${path}?${u}`, { scroll: false });
  };
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const h = setTimeout(() => go({ q: q.trim() || null }), 250);
    return () => clearTimeout(h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);
  return (
    <div className="tbar">
      <label className="sr" htmlFor="aq">Search products</label>
      <input type="search" id="aq" placeholder="Search name, SKU, set, player…" value={q} onChange={(e) => setQ(e.target.value)} />
      <label className="sr" htmlFor="aStatus">Status</label>
      <select id="aStatus" value={sp.get("low") === "1" ? "low" : sp.get("status") ?? "active"}
        onChange={(e) => e.target.value === "low" ? go({ low: "1", status: "active" }) : go({ status: e.target.value, low: null })}>
        <option value="active">Active</option>
        <option value="low">Low / out of stock</option>
        <option value="draft">Drafts</option>
        <option value="archived">Archived</option>
        <option value="all">All</option>
      </select>
      <label className="sr" htmlFor="aType">Type</label>
      <select id="aType" value={sp.get("type") ?? ""} onChange={(e) => go({ type: e.target.value || null })}>
        <option value="">All types</option>
        {Object.entries(PRODUCT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
      {isAdmin && <Link className="btn gold sm" href="/admin/products/new" style={{ height: 38 }}>Add product</Link>}
    </div>
  );
}
