"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordReset() {
  const router = useRouter();
  const [a, setA] = useState(""), [b, setB] = useState("");
  const [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  return (
    <div className="panel" style={{ maxWidth: 520 }}>
      <h3>Set a new password</h3>
      <form style={{ display: "grid", gap: 14 }} onSubmit={async (e) => {
        e.preventDefault(); setErr("");
        if (a.length < 8) return setErr("Use at least 8 characters.");
        if (a !== b) return setErr("The two passwords don't match.");
        setBusy(true);
        const { error } = await createClient().auth.updateUser({ password: a });
        setBusy(false);
        if (error) return setErr("Couldn't set your password. The reset link may have expired. Request a new one from the sign-in page.");
        router.replace("/account"); router.refresh();
      }}>
        <div className="fld"><label htmlFor="np-a">New password</label><input id="np-a" type="password" autoComplete="new-password" value={a} onChange={(e) => setA(e.target.value)} /></div>
        <div className="fld"><label htmlFor="np-b">Confirm new password</label><input id="np-b" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} /></div>
        {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
        <button className="btn gold" type="submit" disabled={busy}>{busy ? "Saving…" : "Save password"}</button>
      </form>
    </div>
  );
}
