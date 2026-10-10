import { NextResponse } from "next/server";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import { verifyUnsubscribe } from "@/lib/email";

/** Unsubscribe from all marketing email. Used by the button on /unsubscribe and by email apps' one-click unsubscribe. */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const email = (url.searchParams.get("e") ?? "").trim().toLowerCase();
  const sig = url.searchParams.get("s") ?? "";
  if (!email || !verifyUnsubscribe(email, sig) || !hasAdminKey()) {
    return NextResponse.json({ ok: false, error: "This unsubscribe link isn't valid." }, { status: 400 });
  }
  await createAdminClient().rpc("email_unsubscribe", { p_email: email });
  const fromForm = (req.headers.get("content-type") ?? "").includes("form") && !(await req.clone().text()).includes("List-Unsubscribe=One-Click");
  if (fromForm) return NextResponse.redirect(new URL(`/unsubscribe?done=1`, url.origin), { status: 303 });
  return NextResponse.json({ ok: true });
}
