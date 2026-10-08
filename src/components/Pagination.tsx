import Link from "next/link";

export function Pagination({ basePath, params, page, total, pageSize }: {
  basePath: string; params: Record<string, string | undefined>; page: number; total: number; pageSize: number;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const href = (n: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && k !== "page" && sp.set(k, v));
    if (n > 1) sp.set("page", String(n));
    const s = sp.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  return (
    <nav className="pager" aria-label="Pages">
      <span className="num">Page {page} of {pages}</span>
      <span style={{ display: "flex", gap: 8 }}>
        {page > 1 ? <Link className="btn sm" href={href(page - 1)} scroll={false}>Previous</Link> : <span className="btn sm" aria-disabled="true" style={{ opacity: .4 }}>Previous</span>}
        {page < pages ? <Link className="btn sm" href={href(page + 1)} scroll={false}>Next</Link> : <span className="btn sm" aria-disabled="true" style={{ opacity: .4 }}>Next</span>}
      </span>
    </nav>
  );
}
