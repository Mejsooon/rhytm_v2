import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { loadDraft } from "@/features/onboarding/load-draft";
import { OnboardingWizard } from "@/features/onboarding/wizard";
import { createClient } from "@/lib/supabase/server";

async function Krok({ params }: { params: Promise<{ krok: string }> }) {
  // Dane zależą od ciasteczek (cacheComponents) — czekamy na żądanie
  await connection();
  const { krok } = await params;
  const step = /^[1-7]$/.test(krok) ? Number(krok) : null;
  if (step === null) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const [{ data: profil }, { data: powiadomienia }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("notification_settings").select("*").eq("user_id", user.id).maybeSingle(),
  ]);
  if (!profil) redirect("/onboarding");

  // Nie wolno przeskoczyć kroków, których użytkownik jeszcze nie zapisał
  if (step > profil.onboarding_step) redirect(`/onboarding/${profil.onboarding_step}`);

  return (
    <OnboardingWizard
      step={step as 1 | 2 | 3 | 4 | 5 | 6 | 7}
      now={new Date()}
      initialDraft={loadDraft(profil, powiadomienia, undefined)}
      avatarUrl={null}
      userId={user.id}
      firstVisit={profil.onboarding_step === 1}
    />
  );
}

export default function KrokPage({ params }: { params: Promise<{ krok: string }> }) {
  return (
    <Suspense fallback={null}>
      <Krok params={params} />
    </Suspense>
  );
}
