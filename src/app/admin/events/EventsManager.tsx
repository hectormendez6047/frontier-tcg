"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteEvent, saveEvent } from "../actions";
import { money } from "@/lib/format";
import type { StoreEvent } from "@/lib/types";

const REG: Record<string, string> = { walkin: "Walk-in", open: "Register in store", full: "Full", closed: "Closed" };
type Draft = { id?: string; name: string; starts_on: string; start_time: string; entry_fee: string; capacity: string; registration: string; description: string };
const blank: Draft = { name: "", starts_on: "", start_time: "", entry_fee: "0", capacity: "", registration: "walkin", description: "" };

export function EventsManager({ events }: { events: StoreEvent[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Draft | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const set = (k: keyof Draft, v: string) => setEdit((e) => (e ? { ...e, [k]: v } : e));

  return (
    <>
      {edit ? (
        <div className="panel">
          <h3>{edit.id ? "Edit event" : "New event"}</h3>
          <form className="form" onSubmit={async (e) => {
            e.preventDefault(); setBusy(true); setErr("");
            const r = await saveEvent({ ...edit });
            setBusy(false);
            if (!r.ok) return setErr(r.error);
            setEdit(null); router.refresh();
          }}>
            <div className="fld"><label htmlFor="ev-name">Event name *</label><input id="ev-name" required value={edit.name} onChange={(e) => set("name", e.target.value)} /></div>
            <div className="fld s2"><label htmlFor="ev-date">Date *</label><input id="ev-date" type="date" required value={edit.starts_on} onChange={(e) => set("starts_on", e.target.value)} /></div>
            <div className="fld s2"><label htmlFor="ev-time">Time</label><input id="ev-time" placeholder="6:30 PM" value={edit.start_time} onChange={(e) => set("start_time", e.target.value)} /></div>
            <div className="fld s2"><label htmlFor="ev-fee">Entry fee $</label><input id="ev-fee" type="number" step="0.01" min={0} value={edit.entry_fee} onChange={(e) => set("entry_fee", e.target.value)} /></div>
            <div className="fld s2"><label htmlFor="ev-cap">Capacity</label><input id="ev-cap" type="number" min={0} value={edit.capacity} onChange={(e) => set("capacity", e.target.value)} /></div>
            <div className="fld s4"><label htmlFor="ev-reg">Registration</label>
              <select id="ev-reg" value={edit.registration} onChange={(e) => set("registration", e.target.value)}>
                {Object.entries(REG).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
              </select></div>
            <div className="fld"><label htmlFor="ev-desc">Description</label><textarea id="ev-desc" value={edit.description} onChange={(e) => set("description", e.target.value)} /></div>
            {err && <p className="err" role="alert" style={{ gridColumn: "span 6", margin: 0 }}>{err}</p>}
            <div className="fld" style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
              <button className="btn gold" type="submit" disabled={busy}>{busy ? "Saving…" : "Save event"}</button>
              <button className="btn" type="button" onClick={() => setEdit(null)}>Cancel</button>
              {edit.id && <button className="btn danger" type="button" onClick={async () => { const r = await deleteEvent(edit.id!); if (!r.ok) return setErr(r.error); setEdit(null); router.refresh(); }}>Delete</button>}
            </div>
          </form>
        </div>
      ) : (
        <div className="tbar"><button className="btn gold sm" type="button" style={{ height: 38 }} onClick={() => setEdit({ ...blank })}>Add event</button></div>
      )}
      {events.length ? (
        <div className="tscroll"><table className="at" style={{ minWidth: 560 }}>
          <thead><tr><th>Date</th><th>Event</th><th>Fee</th><th>Registration</th><th></th></tr></thead>
          <tbody>{events.map((x) => (
            <tr key={x.id} style={x.starts_on < today ? { opacity: .55 } : undefined}>
              <td className="mono">{x.starts_on} {x.start_time ?? ""}</td>
              <td>{x.name}</td>
              <td className="mono">{Number(x.entry_fee) ? money(x.entry_fee) : "Free"}</td>
              <td>{REG[x.registration]}</td>
              <td><button className="btn sm" type="button" onClick={() => setEdit({
                id: x.id, name: x.name, starts_on: x.starts_on, start_time: x.start_time ?? "", entry_fee: String(x.entry_fee ?? 0),
                capacity: x.capacity == null ? "" : String(x.capacity), registration: x.registration, description: x.description ?? "",
              })}>Edit</button></td>
            </tr>
          ))}</tbody>
        </table></div>
      ) : <div className="empty"><h3>No events yet</h3><p>Add league nights and tournaments to show them on the homepage.</p></div>}
    </>
  );
}
