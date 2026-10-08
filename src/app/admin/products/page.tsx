import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { getViewer, hasRole } from "@/lib/auth";
import { PRODUCT_TYPES } from "@/lib/constants";
import type { AdminProduct } from "@/lib/types";
import { ProductsTable } from "./ProductsTable";
import { ProductsToolbar } from "./ProductsToolbar";

export const metadata = { title: "Products" };
const PER = 50;

export default async function Products({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const status = ["active", "draft", "archived", "all"].includes(sp.status ?? "") ? sp.status! : "active";
  const type = sp.type && sp.type in PRODUCT_TYPES ? sp.type : null;
  const settings = await getSettings();
  const supabase = await createClient();
  const viewer = await getViewer();
  const { data, error } = await supabase.rpc("admin_search_products", {
    q: (sp.q ?? "").slice(0, 120), p_status: status, p_type: type,
    p_low: sp.low === "1" ? Number(settings.lowStock) || 3 : null, p_limit: PER, p_offset: (page - 1) * PER,
  });
  const rows = ((data ?? []) as { product: AdminProduct; total: number }[]);
  const total = rows[0]?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PER));
  const qs = (n: number) => { const u = new URLSearchParams(Object.entries(sp).filter(([, v]) => v) as [string, string][]); u.set("page", String(n)); return `/admin/products?${u}`; };
  const isAdmin = !!viewer && hasRole(viewer.role, "admin");

  return (
    <>
      <Suspense><ProductsToolbar isAdmin={isAdmin} /></Suspense>
      {error && <p className="err">Couldn&apos;t load products. Refresh to try again.</p>}
      <ProductsTable products={rows.map((r) => r.product)} isAdmin={isAdmin} />
      <div className="pager">
        <span className="num">{total} product{total === 1 ? "" : "s"} · Price and Qty save when you press Enter or click away</span>
        {pages > 1 && (
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {page > 1 && <Link className="btn sm" href={qs(page - 1)}>Previous</Link>}
            <span className="num">{page} / {pages}</span>
            {page < pages && <Link className="btn sm" href={qs(page + 1)}>Next</Link>}
          </span>
        )}
      </div>
    </>
  );
}
