import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { money } from "@/lib/format";

export const metadata = { title: "Activity log" };
const MONEY = new Set(["price", "sale_price", "cost", "pickupFee", "shippingFlat", "freeShippingOver", "rewardAmount"]);
const LABEL: Record<string, string> = { sale_price: "sale price", reserved_quantity: "reserved", product_type: "type" };

export default async function Activity() {
  await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(300);
  type Log = { id: number; created_at: string; actor_email: string | null; action: string; entity_name: string | null; field: string | null; old_value: string | null; new_value: string | null };
  const rows = (data ?? []) as Log[];
  if (!rows.length) return <div className="empty"><h3>No activity yet</h3><p>Price, stock, product and settings changes are recorded here with who made them.</p></div>;
  const fmt = (f: string | null, v: string | null) => (v == null || v === "" ? "—" : f && MONEY.has(f) && !isNaN(Number(v)) ? money(v) : v);
  return (
    <ul className="log" style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {rows.map((x: Log) => (
        <li key={x.id}>
          <time>{new Date(x.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Chicago" })}</time>
          <span>
            <b style={{ fontWeight: 500 }}>{x.actor_email || "System"}</b>{" "}
            {x.field
              ? <>changed <b>{x.entity_name}</b> {LABEL[x.field] ?? x.field} from {fmt(x.field, x.old_value)} to {fmt(x.field, x.new_value)}</>
              : <>{x.action} <b>{x.entity_name}</b></>}
          </span>
        </li>
      ))}
    </ul>
  );
}
