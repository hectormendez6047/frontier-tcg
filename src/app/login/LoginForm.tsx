"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);
  const [mode, setMode] = useState<"password" | "reset">("password");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") || "").trim();
    const password = String(f.get("password") || "");
    setBusy(true); setErr("");
    const supabase = createClient();
    if (mode === "reset") {
      const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/login` });
      setBusy(false);
      if (error) setErr("Couldn't send the reset email. Check the address and try again.");
      else setSent(true);
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setErr("That email and password don't match. Try again or reset your password."); return; }
    router.replace(next);
    router.refresh();
  }

  if (sent) return <p>Check your email for a link to set a new password.</p>;
  return (
    <form onSubmit={onSubmit}>
      <div className="fld"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
      {mode === "password" && (
        <div className="fld"><label htmlFor="password">Password</label><input id="password" name="password" type="password" required autoComplete="current-password" /></div>
      )}
      {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button className="btn gold" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "password" ? "Sign in" : "Send reset link"}</button>
      <button className="btn-link muted" type="button" style={{ fontSize: 14 }} onClick={() => { setMode(mode === "password" ? "reset" : "password"); setErr(""); }}>
        {mode === "password" ? "Forgot your password?" : "Back to sign in"}
      </button>
    </form>
  );
}
