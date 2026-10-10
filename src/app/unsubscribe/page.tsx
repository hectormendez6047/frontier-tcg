import Link from "next/link";
import type { Metadata } from "next";
import { verifyUnsubscribe } from "@/lib/email";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false } };

export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ e?: string; s?: string; done?: string }> }) {
  const { e = "", s = "", done } = await searchParams;
  const valid = !!e && verifyUnsubscribe(e, s);
  return (
    <div className="wrap">
      <div className="login">
        {done ? (<>
          <h1 style={{ fontSize: 30, marginBottom: 8 }}>You&apos;re unsubscribed</h1>
          <p className="muted">You won&apos;t get any more marketing emails from us. You&apos;ll still get receipts and shipping updates for orders you place.</p>
          <p><Link className="btn" href="/">Back to Frontier TCG</Link></p>
        </>) : valid ? (<>
          <h1 style={{ fontSize: 30, marginBottom: 8 }}>Unsubscribe</h1>
          <p className="muted">Stop all marketing emails to <b>{e}</b>?</p>
          <form method="post" action={`/api/unsubscribe?e=${encodeURIComponent(e)}&s=${encodeURIComponent(s)}`}>
            <button className="btn gold" type="submit">Unsubscribe</button>
          </form>
          <p className="muted" style={{ fontSize: 14 }}>Want fewer emails instead? <Link href="/account/emails">Choose topics</Link> in your account.</p>
        </>) : (<>
          <h1 style={{ fontSize: 30, marginBottom: 8 }}>Link not valid</h1>
          <p className="muted">This unsubscribe link is incomplete. Use the link at the bottom of one of our emails, or sign in and change your email preferences.</p>
          <p><Link className="btn" href="/account/emails">Email preferences</Link></p>
        </>)}
      </div>
    </div>
  );
}
