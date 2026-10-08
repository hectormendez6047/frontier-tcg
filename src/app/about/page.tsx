import type { Metadata } from "next";
import { getSettings } from "@/lib/data";

export const metadata: Metadata = { title: "About", description: "Frontier TCG is a trading card shop in Laredo, Texas.", alternates: { canonical: "/about" } };

export default async function About() {
  const st = await getSettings();
  const rows = ([["Location", st.address], ["Email", st.email], ["Phone", st.phone]] as const).filter(([, v]) => v);
  return (
    <div className="wrap">
      <div className="page-head"><div className="eyebrow">About</div><h1>About Frontier TCG</h1></div>
      <div className="prose" style={{ padding: "24px 0 64px" }}>
        {st.aboutText.split(/\n\s*\n/).map((p, i) => <p key={i}>{p}</p>)}
        <dl className="spec">{rows.map(([k, v]) => (<div key={k} style={{ display: "contents" }}><dt>{k}</dt><dd>{v}</dd></div>))}</dl>
      </div>
    </div>
  );
}
