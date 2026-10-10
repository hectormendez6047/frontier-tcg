"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [sentTo, setSentTo] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const name = String(f.get("name") || "").trim();
    const email = String(f.get("email") || "").trim();
    const password = String(f.get("password") || "");
    const confirm = String(f.get("confirm") || "");
    if (!name) return setErr("Enter your name.");
    if (password.length < 8) return setErr("Use at least 8 characters for your password.");
    if (password !== confirm) return setErr("The two passwords don't match.");
    setBusy(true); setErr("");
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback?next=/account`,
        data: { full_name: name, marketing_opt_in: f.get("marketing") === "on" },
      },
    });
    setBusy(false);
    if (error) {
      if (/registered|exists/i.test(error.message)) return setErr("There's already an account with that email. Try signing in instead.");
      if (/rate limit/i.test(error.message)) return setErr("Too many sign-ups right now. Please try again in a few minutes.");
      if (/password/i.test(error.message)) return setErr(error.message);
      return setErr("Couldn't create the account. Check your email address and try again.");
    }
    if (data.session) { router.replace("/account"); router.refresh(); return; }
    setSentTo(email);
  }

  if (sentTo) return (
    <div>
      <p style={{ marginTop: 0 }}>Almost done. We sent a confirmation link to <b>{sentTo}</b>. Open it to finish creating your account.</p>
      <p className="muted" style={{ fontSize: 14 }}>Don&apos;t see it after a few minutes? Check your spam folder.</p>
    </div>
  );
  return (
    <form onSubmit={onSubmit}>
      <div className="fld"><label htmlFor="name">Name</label><input id="name" name="name" required autoComplete="name" maxLength={120} /></div>
      <div className="fld"><label htmlFor="email">Email</label><input id="email" name="email" type="email" required autoComplete="email" /></div>
      <div className="fld"><label htmlFor="password">Password (8+ characters)</label><input id="password" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
      <div className="fld"><label htmlFor="confirm">Confirm password</label><input id="confirm" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></div>
      <label className="check" style={{ fontSize: 14.5, alignItems: "flex-start" }}>
        <input type="checkbox" name="marketing" style={{ marginTop: 3 }} />
        <span>Email me about restocks, new sets, events and deals. You can change this any time.</span>
      </label>
      {err && <p className="err" role="alert" style={{ margin: 0 }}>{err}</p>}
      <button className="btn gold" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
      <p className="muted" style={{ fontSize: 13, margin: 0 }}>By creating an account you agree to our <Link href="/policies/terms">Terms</Link> and <Link href="/policies/privacy">Privacy Policy</Link>.</p>
    </form>
  );
}
