"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toggleFavorite } from "@/app/account/actions";

export function SaveButton({ productId, initial, path }: { productId: string; initial: boolean; path: string }) {
  const router = useRouter();
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <>
      <button className="btn" type="button" aria-pressed={saved} disabled={busy} onClick={async () => {
        setBusy(true); setErr("");
        const r = await toggleFavorite(productId);
        setBusy(false);
        if (!r.ok) { if (r.signIn) router.push(`/login?next=${encodeURIComponent(path)}`); else setErr(r.error); return; }
        setSaved(r.saved);
      }} style={saved ? { borderColor: "var(--gold)", color: "var(--gold)" } : undefined}>
        {saved ? "♥ Saved" : "♡ Save"}
      </button>
      {err && <span className="err">{err}</span>}
    </>
  );
}
