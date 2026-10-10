import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/account";
  return (
    <div className="wrap">
      <div className="login">
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>Sign in</h1>
        <p className="muted" style={{ margin: "0 0 20px", fontSize: 15 }}>Customers and Frontier TCG staff sign in here.</p>
        {error === "link" && <p className="err" role="alert">That link has expired or was already used. Sign in, or request a new password-reset link.</p>}
        <LoginForm next={safeNext} />
        <p className="muted" style={{ fontSize: 14, margin: "18px 0 0" }}>New here? <Link href="/signup">Create an account</Link></p>
      </div>
    </div>
  );
}
