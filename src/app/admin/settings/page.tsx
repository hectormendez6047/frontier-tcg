import { requireRole } from "@/lib/auth";
import { getSettings } from "@/lib/data";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  await requireRole("admin");
  const st = await getSettings();
  return <SettingsForm initial={st} />;
}
