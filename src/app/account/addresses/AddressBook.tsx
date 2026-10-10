"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deleteAddress, saveAddress } from "../actions";

export type Address = { id: string; full_name: string; line1: string; line2: string | null; city: string; state: string; zip: string; phone: string | null; is_default: boolean };
const blank = { full_name: "", line1: "", line2: "", city: "Laredo", state: "TX", zip: "", phone: "", is_default: false };

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const router = useRouter();
  const [edit, setEdit] = useState<Record<string, unknown> | null>(addresses.length ? null : { ...blank });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const v = (k: string) => (edit?.[k] == null ? "" : String(edit[k]));
  const set = (k: string, val: unknown) => setEdit((e) => (e ? { ...e, [k]: val } : e));
  const f = (k: string, label: string, span: number, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className={`fld${span === 6 ? "" : " s" + span}`}><label htmlFor={`a-${k}`}>{label}</label><input id={`a-${k}`} value={v(k)} onChange={(e) => set(k, e.target.value)} {...extra} /></div>
  );
  return (
    <>
      {addresses.map((a) => (
        <div key={a.id} className="panel" style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
          <div style={{ lineHeight: 1.6 }}>
            <b>{a.full_name}</b> {a.is_default && <span className="pill" style={{ marginLeft: 6, color: "var(--gold)" }}>Default</span>}<br />
            {a.line1}{a.line2 ? `, ${a.line2}` : ""}<br />{a.city}, {a.state} {a.zip}{a.phone ? <><br />{a.phone}</> : null}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <button className="btn sm" type="button" onClick={() => { setErr(""); setEdit({ ...a, line2: a.line2 ?? "", phone: a.phone ?? "" }); }}>Edit</button>
            <button className="btn sm danger" type="button" onClick={async () => { const r = await deleteAddress(a.id); if (!r.ok) setErr(r.error); router.refresh(); }}>Delete</button>
          </div>
        </div>
      ))}
      {edit ? (
        <div className="panel">
          <h3>{edit.id ? "Edit address" : "Add an address"}</h3>
          <form className="form" onSubmit={async (e) => {
            e.preventDefault(); setBusy(true); setErr("");
            const r = await saveAddress(edit); setBusy(false);
            if (!r.ok) return setErr(r.error);
            setEdit(null); router.refresh();
          }}>
            {f("full_name", "Full name", 6, { autoComplete: "name", required: true })}
            {f("line1", "Street address", 6, { autoComplete: "address-line1", required: true })}
            {f("line2", "Apt, suite (optional)", 6, { autoComplete: "address-line2" })}
            {f("city", "City", 2, { autoComplete: "address-level2", required: true })}
            {f("state", "State", 2, { autoComplete: "address-level1", required: true })}
            {f("zip", "ZIP", 2, { autoComplete: "postal-code", inputMode: "numeric", required: true })}
            {f("phone", "Phone (optional)", 3, { autoComplete: "tel" })}
            <div className="fld s3" style={{ justifyContent: "flex-end" }}>
              <label className="check" style={{ font: "inherit", textTransform: "none", letterSpacing: 0, color: "var(--fg)", minHeight: 42 }}>
                <input type="checkbox" checked={!!edit.is_default} onChange={(e) => set("is_default", e.target.checked)} /> Use as my default address
              </label></div>
            {err && <p className="err" role="alert" style={{ gridColumn: "span 6", margin: 0 }}>{err}</p>}
            <div className="fld" style={{ flexDirection: "row", gap: 10 }}>
              <button className="btn gold" type="submit" disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
              {addresses.length > 0 && <button className="btn" type="button" onClick={() => setEdit(null)}>Cancel</button>}
            </div>
          </form>
        </div>
      ) : (
        <>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn gold" type="button" onClick={() => { setErr(""); setEdit({ ...blank }); }}>Add an address</button>
        </>
      )}
    </>
  );
}
