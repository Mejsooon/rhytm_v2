import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { LinkExpired } from "@/features/auth/link-expired";
import { NewPasswordForm } from "@/features/auth/new-password-form";
import { sesjaZLinkuResetu } from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nowe hasło — rhytm" };

// Formularz tylko dla sesji z linku resetu (wpis „recovery” w podpisanym claimie amr, najwyżej 15 minut).
// Bez niej (link wygasł, wejście z palca, zwykła zalogowana sesja) pokazujemy „Link wygasł”.
async function Ekran() {
  // Odczyt sesji Supabase używa Date.now() — czekamy na żądanie, żeby Next nie traktował go jako prerenderu
  await connection();
  const supabase = await createClient();
  const zResetu = await sesjaZLinkuResetu(supabase);

  if (!zResetu) {
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
