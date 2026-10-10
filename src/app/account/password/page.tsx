import { PasswordReset } from "./PasswordReset";

export const metadata = { title: "Set a new password", robots: { index: false } };

export default function Page() {
  return <PasswordReset />;
}
