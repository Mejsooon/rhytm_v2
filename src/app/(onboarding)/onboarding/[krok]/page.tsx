import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { getAvatarUrl } from "@/features/profile/avatar-url";
import { todayIso } from "@/components/controls/calendar-math";
import { loadDraft } from "@/features/onboarding/load-draft";
import type { CategoryName, DraftBlock, Step } from "@/features/onboarding/model";
import { OnboardingWizard } from "@/features/onboarding/wizard";
import { createClient } from "@/lib/supabase/server";
import { safeTimezone } from "@/lib/time/timezones";

async function Krok({ params }: { params: Promise<{ krok: string }> }) {
  // Dane zależą od ciasteczek (cacheComponents) — czekamy na żądanie
  await connection();
  const { krok } = await params;
  const step = /^[1-4]$/.test(krok) ? (Number(krok) as Step) : null;
  if (step === null) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const [{ data: profil }, { data: powiadomienia }] = await Promise.all([
    supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase
      .from("notification_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);
  if (!profil) redirect("/onboarding");

  // Konto po onboardingu nie wraca do kreatora (zapis kroków zmieniłby mu cele i strony)
  if (profil.onboarded_at) redirect("/dzis");

  // Nie wolno przeskoczyć kroków, których użytkownik jeszcze nie zapisał.
  // Konto w połowie starego, dłuższego kreatora zaczyna najdalej od kroku 4.
  const postep = Math.min(profil.onboarding_step, 4);
  if (step > postep) redirect(`/onboarding/${postep}`);

  const avatarUrl = await getAvatarUrl(supabase, profil.avatar_path);

  // Dzisiejsze bloki: krok 3 pokazuje je jako dodane
  const dzis = todayIso(safeTimezone(profil.timezone));
  const { data: bloki } = await supabase
    .from("blocks")
    .select("title, start_local, duration_min, categories(name)")
    .eq("user_id", user.id)
    .gte("start_local", `${dzis}T00:00:00`)
    .lte("start_local", `${dzis}T23:59:59`)
    .order("start_local");
  const gg = (min: number) =>
    `${String(Math.floor(min / 60) % 24).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
  const zapisane: DraftBlock[] = (bloki ?? []).map((b) => {
    const od = Number(b.start_local.slice(11, 13)) * 60 + Number(b.start_local.slice(14, 16));
    return {
      title: b.title,
      start: gg(od),
      end: gg(od + b.duration_min),
      category: (b.categories?.name ?? "Dom") as CategoryName,
      saved: true,
    };
  });

  return (
    <OnboardingWizard
      step={step}
      reached={postep as Step}
      now={new Date()}
      initialDraft={loadDraft(profil, powiadomienia, zapisane)}
      avatarUrl={avatarUrl}
      userId={user.id}
      firstVisit={profil.onboarding_step === 1}
    />
  );
}

export default function KrokPage({
  params,
}: {
  params: Promise<{ krok: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <Krok params={params} />
    </Suspense>
  );
}
