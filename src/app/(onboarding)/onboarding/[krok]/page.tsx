import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { loadDraft } from "@/features/onboarding/load-draft";
import type { OnboardingDraft } from "@/features/onboarding/model";
import { createClient } from "@/lib/supabase/server";

// Tymczasowy zamiennik — Task 5 podmieni go na OnboardingWizard (te same propsy).
function OnboardingWizard({
  step,
}: {
  step: number;
  initialDraft: OnboardingDraft;
  avatarUrl: string | null;
}) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center p-6">
      <h1 className="text-lg font-medium">Krok {step} z 7</h1>
    </main>
  );
}

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
      step={step}
      initialDraft={loadDraft(profil, powiadomienia, undefined)}
      avatarUrl={null}
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
