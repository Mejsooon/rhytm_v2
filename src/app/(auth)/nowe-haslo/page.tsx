import type { Metadata } from "next";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LinkExpired } from "@/features/auth/link-expired";
import { NewPasswordForm } from "@/features/auth/new-password-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nowe hasło — rhytm" };

// Sesję tworzy link recovery z /auth/confirm. Bez niej (link wygasł, wejście z palca) pokazujemy „Link wygasł”.
async function Ekran() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <AuthShell headerAction={{ href: "/logowanie", label: "Zaloguj się" }} width={362}>
        <LinkExpired type="recovery" />
      </AuthShell>
    );
  }
  return (
    <AuthShell headerNote="krok 3 / 3" width={322}>
      <NewPasswordForm />
    </AuthShell>
  );
}

export default function NoweHasloPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-white min-[800px]:bg-[#fafafa]" />}>
      <Ekran />
    </Suspense>
  );
}
