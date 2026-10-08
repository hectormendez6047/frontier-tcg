import { money } from "@/lib/format";
import type { StoreEvent } from "@/lib/types";

const REG: Record<string, string> = { walkin: "Walk-in", open: "Register in store", full: "Full", closed: "Closed" };

export function EventRow({ e }: { e: StoreEvent }) {
  const d = new Date(e.starts_on + "T12:00:00");
  return (
    <div className="ev">
      <div className="d">
        <span>{d.toLocaleString("en-US", { month: "short" }).toUpperCase()}</span>
        <b>{d.getDate()}</b>
      </div>
      <div style={{ minWidth: 0 }}>
        <h3>{e.name}</h3>
        <div className="muted" style={{ fontSize: 14 }}>
          {[d.toLocaleDateString("en-US", { weekday: "long" }), e.start_time, Number(e.entry_fee) ? `${money(e.entry_fee)} entry` : "Free entry", e.capacity ? `${e.capacity} seats` : ""].filter(Boolean).join(" · ")}
        </div>
        {e.description && <div style={{ fontSize: 14.5, marginTop: 4, color: "#cfc9bd" }}>{e.description}</div>}
      </div>
      <div className="r"><span className="pill">{REG[e.registration] ?? ""}</span></div>
    </div>
  );
}
