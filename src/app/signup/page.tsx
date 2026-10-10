import Link from "next/link";
import { redirect } from "next/navigation";
import { getViewer } from "@/lib/auth";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Create an account", robots: { index: false } };

export default async function Signup() {
  if (await getViewer()) redirect("/account");
  return (
    <div className="wrap">
      <div className="login">
        <h1 style={{ fontSize: 32, marginBottom: 6 }}>Create an account</h1>
        <p className="muted" style={{ margin: "0 0 20px", fontSize: 15 }}>Save cards you&apos;re hunting for, store your shipping address and track orders. Free.</p>
        <SignupForm />
        <p className="muted" style={{ fontSize: 14, margin: "18px 0 0" }}>Already have an account? <Link href="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
