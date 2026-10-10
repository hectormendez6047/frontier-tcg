"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { updateProfile } from "../actions";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm({ name, phone, email }: { name: string; phone: string; email: string }) {
  const router = useRouter();
  const [p, setP] = useState({ full_name: name, phone });
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  const [pw, setPw] = useState({ a: "", b: "" });
  const [pwMsg, setPwMsg] = useState<{ t: string; err?: boolean } | null>(null);
  return (
    <>
      <div className="panel">
        <h3>Profile</h3>
        <form className="form" onSubmit={async (e) => {
          e.preventDefault();
          const r = await updateProfile(p);
          setMsg(r.ok ? { t: "Saved." } : { t: r.error, err: true });
          if (r.ok) router.refresh();
        }}>
          <div className="fld s3"><label htmlFor="p-name">Name</label><input id="p-name" value={p.full_name} onChange={(e) => setP({ ...p, full_name: e.target.value })} autoComplete="name" /></div>
          <div className="fld s3"><label htmlFor="p-phone">Phone</label><input id="p-phone" value={p.phone} onChange={(e) => setP({ ...p, phone: e.target.value })} autoComplete="tel" /></div>
          <div className="fld"><label htmlFor="p-email">Email</label><input id="p-email" value={email} disabled /></div>
          <div className="fld" style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <button className="btn gold sm" type="submit">Save profile</button>
            {msg && <span className={msg.err ? "err" : ""} style={msg.err ? undefined : { color: "var(--ok)" }} role="status">{msg.t}</span>}
          </div>
        </form>
      </div>
      <div className="panel">
        <h3>Change password</h3>
        <form className="form" onSubmit={async (e) => {
          e.preventDefault();
          if (pw.a.length < 8) return setPwMsg({ t: "Use at least 8 characters.", err: true });
          if (pw.a !== pw.b) return setPwMsg({ t: "The two passwords don't match.", err: true });
          const { error } = await createClient().auth.updateUser({ password: pw.a });
          setPwMsg(error ? { t: /different/i.test(error.message) ? "Choose a password you haven't used here before." : "Couldn't change your password. Please try again.", err: true } : { t: "Password changed." });
          if (!error) setPw({ a: "", b: "" });
        }}>
          <div className="fld s3"><label htmlFor="pw-a">New password</label><input id="pw-a" type="password" autoComplete="new-password" value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} /></div>
          <div className="fld s3"><label htmlFor="pw-b">Confirm new password</label><input id="pw-b" type="password" autoComplete="new-password" value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} /></div>
          <div className="fld" style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <button className="btn sm" type="submit">Change password</button>
            {pwMsg && <span className={pwMsg.err ? "err" : ""} style={pwMsg.err ? undefined : { color: "var(--ok)" }} role="status">{pwMsg.t}</span>}
          </div>
        </form>
      </div>
    </>
  );
}
