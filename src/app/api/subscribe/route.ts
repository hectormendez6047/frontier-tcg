import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";

const Body = z.object({ email: z.string().trim().toLowerCase().email().max(200), source: z.string().max(40).optional(), website: z.string().optional() });

/** Newsletter sign-up from the homepage or coming-soon page. */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
  if (parsed.data.website) return NextResponse.json({ ok: true }); // bot trap
  if (!hasAdminKey()) return NextResponse.json({ ok: false, error: "Sign-ups aren't open yet." }, { status: 503 });
  const admin = createAdminClient();
  const { error } = await admin.from("newsletter_subscribers")
    .upsert({ email: parsed.data.email, source: parsed.data.source ?? "site", unsubscribed_at: null }, { onConflict: "email" });
  if (error) return NextResponse.json({ ok: false, error: "Couldn't sign you up. Please try again." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
