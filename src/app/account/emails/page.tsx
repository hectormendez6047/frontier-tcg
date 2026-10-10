import { createClient } from "@/lib/supabase/server";
import { EmailPrefs } from "./EmailPrefs";

export const metadata = { title: "Email preferences", robots: { index: false } };

export default async function Emails() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("profiles").select("email_prefs, marketing_opt_in").eq("id", user!.id).maybeSingle();
  const prefs = (data?.email_prefs ?? {}) as Record<string, boolean>;
  // People who ticked "email me" at sign-up start with every topic on.
  const initial = Object.keys(prefs).length ? prefs : data?.marketing_opt_in
    ? { promotions: true, new_products: true, restocks: true, events: true, rewards: true, announcements: true } : {};
  return <EmailPrefs initial={initial} />;
}
