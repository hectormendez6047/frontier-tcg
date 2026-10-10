import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./ProfileForm";

export const metadata = { title: "Profile", robots: { index: false } };

export default async function Profile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data } = await supabase.from("profiles").select("full_name, phone, email").eq("id", user!.id).maybeSingle();
  return <ProfileForm name={data?.full_name ?? ""} phone={data?.phone ?? ""} email={user?.email ?? ""} />;
}
