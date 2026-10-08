"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setRole } from "../actions";

export function TeamForm() {
  const router = useRouter();
  const [msg, setMsg] = useState<{ t: string; err?: boolean } | null>(null);
  return (
    <form className="form" onSubmit={async (e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const r = await setRole(String(f.get("email") || ""), String(f.get("role")) as "owner" | "admin" | "staff" | "customer");
      setMsg(r.ok ? { t: "Role updated." } : { t: r.error, err: true });
      if (r.ok) router.refresh();
    }}>
      <div className="fld s3"><label htmlFor="tm-email">Email</label><input id="tm-email" name="email" type="email" required /></div>
      <div className="fld s2"><label htmlFor="tm-role">Role</label>
        <select id="tm-role" name="role" defaultValue="staff">
          <option value="staff">Staff</option><option value="admin">Admin</option><option value="owner">Owner</option><option value="customer">Remove access</option>
        </select></div>
      <div className="fld s1" style={{ justifyContent: "flex-end", gridColumn: "span 1" }}><button className="btn gold" type="submit">Save</button></div>
      {msg && <p className={msg.err ? "err" : ""} style={{ gridColumn: "span 6", margin: 0, color: msg.err ? undefined : "var(--ok)" }} role="status">{msg.t}</p>}
    </form>
  );
}
