import { Suspense } from "react";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";

import { todayIso } from "@/components/controls/calendar-math";
import { ModuleHeader } from "@/components/shell/module-header";
import { AccountCard } from "@/features/settings/account-card";
import { loadCalendarSettings } from "@/features/calendar/settings";
import { CalendarSettingsCard } from "@/features/settings/calendar-card";
import { CategoriesCard } from "@/features/settings/categories-card";
import { DeleteAccountCard } from "@/features/settings/delete-account-card";
import { ExportCard } from "@/features/settings/export-card";
import { GoalsCard } from "@/features/settings/goals-card";
import { PasswordCard } from "@/features/settings/password-card";
import { ProfileCard } from "@/features/settings/profile-card";
import { SessionsCard } from "@/features/settings/sessions-card";
import { TrashCard } from "@/features/settings/trash-card";
import { VaultCard } from "@/features/settings/vault-card";
import { loadTrash } from "@/features/pages/actions";
import {
  SETTINGS_TABS,
  SettingsTabs,
  type SettingsTabSlug,
} from "@/features/settings/settings-tabs";
import { getAvatarUrl } from "@/features/profile/avatar-url";
import { mapHabits } from "@/features/habits/load-habits";
import { scheduleOn } from "@/features/habits/model";
import { describeSchedule } from "@/features/habits/text";
import { NotificationsTab } from "@/features/notifications/notifications-card";
import { describeUserAgent } from "@/lib/user-agent";
import { safeTimezone, timezoneOptions } from "@/lib/time/timezones";
import { createClient } from "@/lib/supabase/server";

// Karty Profil i Cele z zapisanymi wartościami (dane zależą od ciasteczek → connection + Suspense)
async function Ogolne({
  searchParams,
}: {
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  await connection();
  // ?email=potwierdzono dopisuje auth/confirm po kliknięciu linku ze zmiany adresu (czytane tu, w Suspense)
  const emailConfirmed = (await searchParams).email === "potwierdzono";
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
  // Czy konto ma hasło: z bazy (konto Google może ustawić hasło linkiem, bez tożsamości „email”);
  // stara baza bez funkcji → tożsamość „email” jak dotąd
  const { data: maHaslo, error: bladHasla } =
    await supabase.rpc("my_has_password");
  const hasPassword = bladHasla
    ? (user.identities ?? []).some((t) => t.provider === "email")
    : maHaslo === true;
  const zmianaHasla = user.user_metadata?.password_changed_at;
  const sesja = describeUserAgent((await headers()).get("user-agent"));
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
      <AccountCard
        email={user.email ?? ""}
        newEmail={user.new_email ?? null}
        hasPassword={hasPassword}
        passwordChangedAt={typeof zmianaHasla === "string" ? zmianaHasla : null}
        sessionLabel={sesja.label}
        emailConfirmed={emailConfirmed}
        timeZone={strefa}
      />
      <TrashCard
        pages={kosz.ok ? kosz.pages : []}
        rows={kosz.ok ? kosz.rows : []}
        timeZone={strefa}
        loadError={!kosz.ok}
      />
      <DeleteAccountCard />
    </>
  );
}

// Konto i bezpieczeństwo: hasło, sesje, eksport (dane zależą od ciasteczek → connection + Suspense)
async function Konto() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data: profil } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  // Czy konto ma hasło: z bazy (konto Google może ustawić hasło linkiem, bez tożsamości „email”);
  // stara baza bez funkcji → tożsamość „email” jak dotąd
  const { data: maHaslo, error: bladHasla } =
    await supabase.rpc("my_has_password");
  const hasPassword = bladHasla
    ? (user.identities ?? []).some((t) => t.provider === "email")
    : maHaslo === true;
  const biezaca = describeUserAgent((await headers()).get("user-agent"));

  // Lista sesji z bazy; stara baza bez funkcji albo błąd → sama bieżąca sesja z nagłówka
  const { data: sesje, error: bladSesji } =
    await supabase.rpc("list_my_sessions");
  const lista = (sesje ?? []).map((s) => {
    const opis = describeUserAgent(s.user_agent);
    return {
      id: s.id,
      label: opis.label,
      mobile: opis.mobile,
      lastActiveAt: s.last_active_at,
      current: s.is_current,
    };
  });

  return (
    <>
      <PasswordCard hasPassword={hasPassword} email={user.email ?? ""} />
      <SessionsCard
        sessions={bladSesji ? [] : lista}
        loadError={!!bladSesji}
        currentLabel={biezaca.label}
        currentMobile={biezaca.mobile}
        timeZone={safeTimezone(profil?.timezone)}
      />
      <ExportCard />
    </>
  );
}

// Powiadomienia: ustawienia, urządzenia push i przypomnienia nawyków (dane zależą od ciasteczek → connection + Suspense)
async function Powiadomienia() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const [profilRes, ustawieniaRes, urzadzeniaRes, nawykiRes, wersjeRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("timezone")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("notification_settings")
        .select(
          "habits_enabled, before_block_min, renewals_enabled, quiet_enabled, quiet_from, quiet_to",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      // Bez kluczy urządzenia (p256dh, auth); endpoint tylko do rozpoznania tej przeglądarki („TO”)
      supabase
        .from("push_subscriptions")
        .select("id, endpoint, label, enabled, created_at, last_seen_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
      // Nawyki w kolejności modułu Nawyki
      supabase
        .from("habits")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }),
      supabase
        .from("habit_schedules")
        .select("*")
        .eq("user_id", user.id)
        .order("valid_from", { ascending: true }),
    ]);
  // Błąd odczytu nawyków ma trafić do granicy błędu trasy (jak w module Nawyki), a nie pokazać pustą listę
  if (nawykiRes.error) throw new Error(nawykiRes.error.message);
  if (wersjeRes.error) throw new Error(wersjeRes.error.message);

  const strefa = safeTimezone(profilRes.data?.timezone);
  const dzis = todayIso(strefa);
  // Brak wiersza ustawień = wartości domyślne kolumn (nawyki wył., blok 5 min, odnowienia wł., cisza 23:00–07:00)
  const u = ustawieniaRes.data;
  const nawyki = mapHabits(nawykiRes.data ?? [], wersjeRes.data ?? []).map(
    (h) => {
      // Obowiązująca dziś wersja; gdy wszystkie są w przyszłości — pierwsza
      const wersja = scheduleOn(h, dzis) ?? h.schedules[0];
      return {
        id: h.id,
        name: h.name,
        schedule: wersja ? describeSchedule(wersja) : "",
        remindAt: h.remindAt,
      };
    },
  );
  // Stara baza bez tabeli push_subscriptions → komunikat w karcie „Urządzenia”, reszta działa
  const urzadzenia = (urzadzeniaRes.data ?? []).map((d) => ({
    id: d.id,
    endpoint: d.endpoint,
    label: d.label,
    // Etykieta „{Przeglądarka} · {System}” z describeUserAgent: telefony i tablety po nazwie systemu
    mobile: /· (iPhone|iPad|Android)$/.test(d.label),
    enabled: d.enabled,
    lastSeenAt: d.last_seen_at,
    createdAt: d.created_at,
  }));

  return (
    <NotificationsTab
      settings={{
        habits: u?.habits_enabled ?? false,
        block: u ? u.before_block_min !== null : true,
        renewals: u?.renewals_enabled ?? true,
        quiet: u?.quiet_enabled ?? false,
        // kolumny time wracają jako 'HH:MM:SS'
        quietFrom: u?.quiet_from?.slice(0, 5) ?? "23:00",
        quietTo: u?.quiet_to?.slice(0, 5) ?? "07:00",
      }}
      devices={urzadzenia}
      devicesLoadError={!!urzadzeniaRes.error}
      habits={nawyki}
      timeZone={strefa}
    />
  );
}

// Karty Widok i Kategorie (kategorie w kolejności z bazy) (dane zależą od ciasteczek → connection + Suspense)
async function Kalendarz() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const [{ data }, ustawienia] = await Promise.all([
    supabase
      .from("categories")
      .select("id, name, color, position, is_system, hidden")
      .eq("user_id", user.id)
      .order("position", { ascending: true }),
    loadCalendarSettings(supabase, user.id),
  ]);
  return (
    <>
      <CalendarSettingsCard settings={ustawienia} />
      <CategoriesCard categories={data ?? []} />
    </>
  );
}

export default async function ZakladkaPage({
  params,
  searchParams,
}: {
  params: Promise<{ zakladka: string }>;
  searchParams: Promise<{ email?: string | string[] }>;
}) {
  const { zakladka } = await params;
  const tab = SETTINGS_TABS.find((t) => t.slug === zakladka);
  if (!tab) notFound();

  return (
    <>
      {/* Telefon (CMSettings*): „Wstecz” → indeks /ustawienia i nazwa zakładki na środku; web: okruszki */}
      <ModuleHeader
        title={tab.label}
        webParent="Ustawienia"
        phoneBack={{ href: "/ustawienia", label: "Wstecz" }}
        phoneCenterTitle
      />
      <div className="flex w-full max-w-[1100px] items-start gap-8 px-6 py-7 max-[799px]:flex-col max-[799px]:items-stretch max-[799px]:gap-4 max-[799px]:px-4 max-[799px]:pt-4 max-[799px]:pb-6">
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
              <Ogolne searchParams={searchParams} />
            </Suspense>
          ) : tab.slug === "konto" ? (
            <Suspense fallback={null}>
              <Konto />
            </Suspense>
          ) : tab.slug === "kalendarz" ? (
            <Suspense fallback={null}>
              <Kalendarz />
            </Suspense>
          ) : tab.slug === "sejf" ? (
            <VaultCard />
          ) : (
            <Suspense fallback={null}>
              <Powiadomienia />
            </Suspense>
          )}
        </div>
      </div>
    </>
  );
}
