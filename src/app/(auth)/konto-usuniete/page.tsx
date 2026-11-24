import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { AuthShell } from "@/components/auth/auth-shell";
import { RestoreAccount } from "@/features/settings/restore-account";
import { createClient } from "@/lib/supabase/server";
import { safeTimezone } from "@/lib/time/timezones";

export const metadata: Metadata = { title: "Konto czeka na usunięcie — rhytm" };

// Dane konta zależą od ciasteczek — czytamy je pod Suspense, ramka może zostać wstępnie wyrenderowana.
// Proxy wpuszcza tu tylko zalogowanego z prośbą o usunięcie; bez niej wracamy do aplikacji.
async function Ekran() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data: profil, error } = await supabase
    .from("profiles")
    .select("deletion_requested_at, timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  // Błąd odczytu: zostajemy na ekranie (bez daty), żeby nie odbijać się między proxy a /dzis
  if (!error && !profil?.deletion_requested_at) redirect("/dzis");

  return (
    <RestoreAccount
      email={user.email ?? ""}
      requestedAt={profil?.deletion_requested_at ?? ""}
      timeZone={safeTimezone(profil?.timezone)}
    />
  );
}

export default function KontoUsunietePage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <Ekran />
      </Suspense>
    </AuthShell>
  );
}
