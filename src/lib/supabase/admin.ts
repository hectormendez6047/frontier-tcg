import { createClient } from "@supabase/supabase-js";

/**
 * Server-only database client with full access. Used only for checkout and refunds,
 * after the code has checked who is asking. Never import this into a "use client" file.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const hasAdminKey = () => !!process.env.SUPABASE_SERVICE_ROLE_KEY;
