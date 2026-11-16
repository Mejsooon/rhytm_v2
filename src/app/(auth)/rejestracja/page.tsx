import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/features/auth/register-form";

export const metadata: Metadata = { title: "Rejestracja — rhytm" };

export default function RejestracjaPage() {
  return (
    <AuthShell headerAction={{ href: "/logowanie", label: "Zaloguj się" }} width={400} phoneBack="/logowanie">
      <RegisterForm />
    </AuthShell>
  );
}
