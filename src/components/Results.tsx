import { Suspense } from "react";
import { ProductGrid } from "./ProductCard";
import { ProductRow } from "./ProductRow";
import { Pagination } from "./Pagination";
import { SortSelect } from "./Filters";
import { EmptyState } from "./EmptyState";
import type { Product } from "@/lib/types";

export function Results({ products, total, page, pageSize, lowAt, mode, basePath, params, error, defaultSort }: {
  products: Product[]; total: number; page: number; pageSize: number; lowAt: number;
  mode: "grid" | "list"; basePath: string; params: Record<string, string | undefined>; error?: boolean; defaultSort?: string;
}) {
  return (
    <div>
      <div className="resbar">
        <span className="num">{total} result{total === 1 ? "" : "s"}</span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}><Suspense><SortSelect fallback={defaultSort} /></Suspense></span>
      </div>
      {error ? (
        <EmptyState title="Search is unavailable right now"><p>Please try again in a moment.</p></EmptyState>
      ) : products.length === 0 ? (
        <EmptyState title="We couldn't find that card.">
          <p>Try a shorter search, a different spelling, or turn off “In stock only”.</p>
        </EmptyState>
      ) : mode === "grid" ? (
        <ProductGrid products={products} lowAt={lowAt} />
      ) : (
        <div className="rows">{products.map((p) => <ProductRow key={p.id} p={p} lowAt={lowAt} />)}</div>
      )}
      <Pagination basePath={basePath} params={params} page={page} total={total} pageSize={pageSize} />
    </div>
  );
}
