import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";
import { METHOD_LABEL, fmtDate } from "@/components/OrderView";
import { PrintButton } from "./PrintButton";

export const metadata = { title: "Packing slip" };

export default async function Slip({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const [{ data: o }, { data: items }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", id).order("bin", { nullsFirst: false }).order("name"),
  ]);
  if (!o) notFound();
  const pickup = o.fulfillment === "pickup";
  const th = { textAlign: "left" as const, borderBottom: "2px solid currentColor", padding: 6 };
  const td = { padding: 6, borderBottom: "1px solid #999" };
  return (
    <>
      <div className="no-print" style={{ marginBottom: 14 }}><PrintButton /></div>
      <div className="slip">
        {pickup && (
          <div style={{ border: "3px solid currentColor", padding: "14px 18px", marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 13, letterSpacing: ".14em", textTransform: "uppercase" }}>Online order · Pickup</div>
              <div style={{ fontSize: 34, fontWeight: 800, lineHeight: 1.1 }}>{o.full_name}</div>
            </div>
            <div style={{ fontSize: 44, fontWeight: 800 }}>#{o.number}</div>
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 20, flexWrap: "wrap" }}>
          <div><b style={{ fontSize: 22 }}>FRONTIER TCG</b><div>Laredo, Texas · frontiertcgshop.com</div></div>
          <div style={{ textAlign: "right" }}><b style={{ fontSize: 22 }}>Order #{o.number}</b><div>{fmtDate(o.paid_at ?? o.created_at)}</div><div>{METHOD_LABEL[o.fulfillment]}</div></div>
        </div>
        {!pickup ? (
          <div style={{ margin: "22px 0", fontSize: 17, lineHeight: 1.5 }}>
            <div style={{ fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase" }}>Ship to</div>
            <b>{o.full_name}</b><br />{o.ship_line1}{o.ship_line2 ? <><br />{o.ship_line2}</> : null}<br />{o.ship_city}, {o.ship_state} {o.ship_zip}
          </div>
        ) : <div style={{ margin: "22px 0", fontSize: 16 }}>Pickup for <b>{o.full_name}</b> · {o.phone ?? o.email}. Customer shows their confirmation email or order number.</div>}
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 15 }}>
          <thead><tr><th style={th}>✓</th><th style={th}>Bin</th><th style={th}>Qty</th><th style={th}>Item</th><th style={th}>SKU</th><th style={{ ...th, textAlign: "right" }}>Price</th></tr></thead>
          <tbody>{(items ?? []).map((i: { id: string; quantity: number; name: string; details: string | null; sku: string | null; bin: string | null; line_total: number }) => (
            <tr key={i.id}>
              <td style={td}>☐</td>
              <td style={{ ...td, fontFamily: "monospace", fontSize: 16, fontWeight: 700 }}>{i.bin ?? "—"}</td>
              <td style={{ ...td, fontWeight: 700 }}>{i.quantity}</td>
              <td style={td}>{i.name}<div style={{ fontSize: 13 }}>{i.details}</div></td>
              <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{i.sku}</td>
              <td style={{ ...td, textAlign: "right" }}>{money(i.line_total)}</td>
            </tr>
          ))}</tbody>
        </table>
        <p style={{ textAlign: "right", fontSize: 16 }}>Total paid: <b>{money(o.total)}</b></p>
        {o.customer_note && <p><b>Customer note:</b> {o.customer_note}</p>}
        <p style={{ marginTop: 30 }}>Thanks for shopping with Frontier TCG! Please check your items before you leave. Questions? Reply to your confirmation email.</p>
      </div>
    </>
  );
}
