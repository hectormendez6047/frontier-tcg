import type { Metadata } from "next";
import { notFound } from "next/navigation";

const TITLES: Record<string, string> = { privacy: "Privacy Policy", terms: "Terms of Service", shipping: "Shipping Policy", returns: "Return Policy" };
type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  return { title: TITLES[slug] ?? "Policy" };
}

export default async function Policy({ params }: Props) {
  const { slug } = await params;
  const t = TITLES[slug];
  if (!t) notFound();
  return (
    <div className="wrap">
      <div className="page-head"><h1>{t}</h1></div>
      <div className="prose" style={{ padding: "24px 0 64px" }}>
        <p>Our {t.toLowerCase()} will be published here before the store takes its first online order.</p>
      </div>
    </div>
  );
}
