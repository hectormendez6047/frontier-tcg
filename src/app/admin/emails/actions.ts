"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkRole } from "@/lib/auth";
import { createAdminClient, hasAdminKey } from "@/lib/supabase/admin";
import { emailConfigured, sendCampaign, sendCampaignTest, type Campaign } from "@/lib/email";
import { EMAIL_TOPICS } from "@/lib/constants";
import { getSettings } from "@/lib/data";

type Result = { ok: true; sent?: number; failed?: number } | { ok: false; error: string };
const fail = (error: string): Result => ({ ok: false, error });

const Input = z.object({
  topic: z.enum(EMAIL_TOPICS.map(([k]) => k) as [string, ...string[]]),
  subject: z.string().trim().min(3, "Write a subject line.").max(150),
  heading: z.string().trim().max(150).default(""),
  body: z.string().trim().min(10, "Write the message.").max(10000),
  buttonLabel: z.string().trim().max(40).default(""),
  buttonUrl: z.string().trim().max(500).default("").refine((v) => !v || /^https:\/\//.test(v), "Button links must start with https://"),
});

async function address() {
  const st = await getSettings();
  return [st.storeName || "Frontier TCG", st.address].filter(Boolean).join(" · ");
}

export async function sendTest(raw: z.input<typeof Input>): Promise<Result> {
  const { viewer, error } = await checkRole("admin");
  if (error) return fail("Only owners and admins can send newsletters.");
  if (!emailConfigured()) return fail("Email isn't set up yet. Add RESEND_API_KEY in Vercel first.");
  const p = Input.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the email.");
  const ok = await sendCampaignTest(p.data as Campaign, viewer!.email, await address());
  return ok ? { ok: true, sent: 1 } : fail("Resend didn't accept the test email. Check that your domain is verified in Resend.");
}

export async function audienceCount(topic: string): Promise<number> {
  const { error } = await checkRole("admin");
  if (error || !hasAdminKey()) return 0;
  const { data } = await createAdminClient().rpc("email_audience", { p_topic: topic });
  return (data ?? []).length;
}

export async function sendNewsletter(raw: z.input<typeof Input>, expected: number): Promise<Result> {
  const { viewer, error } = await checkRole("admin");
  if (error) return fail("Only owners and admins can send newsletters.");
  if (!emailConfigured() || !hasAdminKey()) return fail("Email isn't set up yet. Add RESEND_API_KEY in Vercel first.");
  const p = Input.safeParse(raw);
  if (!p.success) return fail(p.error.issues[0]?.message ?? "Check the email.");
  const admin = createAdminClient();
  const { data } = await admin.rpc("email_audience", { p_topic: p.data.topic });
  const to = ((data ?? []) as { email: string }[]).map((r) => r.email);
  if (!to.length) return fail("Nobody has signed up for this topic yet.");
  if (Math.abs(to.length - expected) > 25) return fail("The number of subscribers changed. Review the count and send again.");
  const r = await sendCampaign(p.data as Campaign, to, await address());
  await admin.from("email_campaigns").insert({
    subject: p.data.subject, topic: p.data.topic, body: p.data.body, sent_count: r.sent, failed: r.failed,
    sent_by: viewer!.id, sent_by_email: viewer!.email,
  });
  revalidatePath("/admin/emails");
  return { ok: true, sent: r.sent, failed: r.failed };
}
