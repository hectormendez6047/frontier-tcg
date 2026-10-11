import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { getSettings } from "@/lib/data";
import { POLICY_DEFAULTS, POLICY_SLUGS, fillPolicy, type PolicySlug } from "@/lib/policies";

type Props = { params: Promise<{ slug: string }> };
const isSlug = (s: string): s is PolicySlug => s in POLICY_SLUGS;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: isSlug(slug) ? POLICY_SLUGS[slug].title : "Policy" };
}

function inline(s: string): ReactNode[] {
  return s.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <b key={i}>{part.slice(2, -2)}</b> : part);
}

function render(text: string) {
  const out: ReactNode[] = [];
  text.replace(/\r\n/g, "\n").split(/\n\s*\n/).forEach((block, i) => {
    const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    const parts: ReactNode[] = [];
    let bullets: string[] = [];
    const flush = () => {
      if (bullets.length) parts.push(<ul key={`u${parts.length}`}>{bullets.map((b, j) => <li key={j}>{inline(b)}</li>)}</ul>);
      bullets = [];
    };
    let para: string[] = [];
    const flushP = () => { if (para.length) parts.push(<p key={`p${parts.length}`}>{inline(para.join(" "))}</p>); para = []; };
    for (const l of lines) {
      if (l.startsWith("## ")) { flushP(); flush(); parts.push(<h2 key={`h${parts.length}`}>{inline(l.slice(3))}</h2>); }
      else if (l.startsWith("- ")) { flushP(); bullets.push(l.slice(2)); }
      else { flush(); para.push(l); }
    }
    flushP(); flush();
    out.push(<div key={i}>{parts}</div>);
  });
  return out;
}

export default async function Policy({ params }: Props) {
  const { slug } = await params;
  if (!isSlug(slug)) notFound();
  const st = await getSettings();
  const { key, title } = POLICY_SLUGS[slug];
  const raw = String(st[key] ?? "").trim() || POLICY_DEFAULTS[key];
  return (
    <div className="wrap">
      <div className="page-head"><h1>{title}</h1></div>
      <div className="prose policy" style={{ padding: "24px 0 64px", maxWidth: "72ch" }}>
        {render(fillPolicy(raw, st))}
        {st.email && <p className="muted" style={{ marginTop: 32 }}>Questions? Email <a href={`mailto:${st.email}`}>{st.email}</a>.</p>}
      </div>
    </div>
  );
}
