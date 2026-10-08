import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in", robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/admin";
  return (
    <div className="wrap">
      <div className="login">
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>Staff sign in</h1>
        <p className="muted" style={{ margin: "0 0 20px", fontSize: 15 }}>For Frontier TCG owners and staff.</p>
        <LoginForm next={safeNext} />
      </div>
    </div>
  );
}
