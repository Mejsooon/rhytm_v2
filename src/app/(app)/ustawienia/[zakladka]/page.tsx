import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { Card, CardContent } from "@/components/controls";
import { ModuleHeader } from "@/components/shell/module-header";
import { CategoriesCard } from "@/features/settings/categories-card";
import { GoalsCard } from "@/features/settings/goals-card";
import { ProfileCard } from "@/features/settings/profile-card";
import { TrashCard } from "@/features/settings/trash-card";
import { VaultCard } from "@/features/settings/vault-card";
import { loadTrash } from "@/features/pages/actions";
import {
  SETTINGS_TABS,
  SettingsTabs,
  type SettingsTabSlug,
} from "@/features/settings/settings-tabs";
import { getAvatarUrl } from "@/features/profile/avatar-url";
import { safeTimezone, timezoneOptions } from "@/lib/time/timezones";
import { createClient } from "@/lib/supabase/server";

// Karty Profil i Cele z zapisanymi wartościami (dane zależą od ciasteczek → connection + Suspense)
async function Ogolne() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data: profil } = await supabase
    .from("profiles")
    .select(
      "display_name, avatar_path, timezone, weight_kg, height_cm, sleep_goal_min, workouts_goal_on, km_goal_on, weekly_workouts_goal, weekly_km_goal, currency, week_start",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  // Podpisany adres zdjęcia (null → inicjały)
  const avatarUrl = await getAvatarUrl(supabase, profil?.avatar_path);
  const strefa = safeTimezone(profil?.timezone);
  // Kosz: usunięte strony i wiersze z ostatnich 30 dni (błąd odczytu = komunikat w karcie)
  const kosz = await loadTrash();
  const waluta = profil?.currency;
  return (
    <>
      <ProfileCard
        userId={user.id}
        avatarUrl={avatarUrl}
        saved={{
          name: profil?.display_name ?? "",
          tz: strefa,
          kg: profil?.weight_kg != null ? String(profil.weight_kg) : "",
          cm: profil?.height_cm != null ? String(profil.height_cm) : "",
        }}
        // Zapisana strefa spoza 6 podstawowych też trafia na listę
        timezones={timezoneOptions(new Date(), strefa)}
      />
      <GoalsCard
        saved={{
          sleep: profil?.sleep_goal_min ?? 480,
          // Brak liczby treningów (konta sprzed celu treningowego) = 3
          trOn: profil?.workouts_goal_on ?? true,
          kmOn: profil?.km_goal_on ?? true,
          tr:
            profil?.weekly_workouts_goal != null
              ? String(profil.weekly_workouts_goal)
              : "3",
          // Ułamek kilometrów z polskim przecinkiem (22.5 -> "22,5")
          km:
            profil?.weekly_km_goal != null
              ? String(profil.weekly_km_goal).replace(".", ",")
              : "25",
          cur:
            waluta === "EUR" || waluta === "USD" || waluta === "GBP"
              ? waluta
              : "PLN",
          week: profil?.week_start === "sun" ? "sun" : "mon",
        }}
      />
      <TrashCard
        pages={kosz.ok ? kosz.pages : []}
        rows={kosz.ok ? kosz.rows : []}
        timeZone={strefa}
        loadError={!kosz.ok}
      />
    </>
  );
}

// Karta Kategorie kalendarza z listą w kolejności z bazy (dane zależą od ciasteczek → connection + Suspense)
async function Kategorie() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data } = await supabase
    .from("categories")
    .select("id, name, color, position, is_system, hidden")
    .eq("user_id", user.id)
    .order("position", { ascending: true });
  return <CategoriesCard categories={data ?? []} />;
}

export default async function ZakladkaPage({
  params,
}: {
  params: Promise<{ zakladka: string }>;
}) {
  const { zakladka } = await params;
  const tab = SETTINGS_TABS.find((t) => t.slug === zakladka);
  if (!tab) notFound();

  return (
    <>
      <ModuleHeader
        title={tab.label}
        webParent="Ustawienia"
        phoneTitle="Ustawienia"
      />
      <div className="flex w-full max-w-[1100px] items-start gap-8 px-6 py-7 max-[799px]:flex-col max-[799px]:items-stretch max-[799px]:gap-4 max-[799px]:py-2">
        <SettingsTabs active={tab.slug as SettingsTabSlug} />
        <div className="flex min-w-0 max-w-[840px] flex-1 flex-col gap-6 max-[799px]:w-full max-[799px]:gap-4">
          <div className="max-[799px]:hidden">
            <h2 className="m-0 text-2xl font-semibold tracking-[-0.02em]">
              {tab.label}
            </h2>
            {tab.description ? (
              <p className="m-0 mt-1 text-muted-foreground">
                {tab.description}
              </p>
            ) : null}
          </div>
          {tab.slug === "ogolne" ? (
            <Suspense fallback={null}>
              <Ogolne />
            </Suspense>
          ) : tab.slug === "kategorie" ? (
            <Suspense fallback={null}>
              <Kategorie />
            </Suspense>
          ) : tab.slug === "sejf" ? (
            <VaultCard />
          ) : (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                Ta zakładka powstanie w kolejnym etapie.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
