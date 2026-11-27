import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { getAvatarUrl } from "@/features/profile/avatar-url";
import { loadToday } from "@/features/today/load-today";
import { QUICK_ACTIONS } from "@/features/today/quick-request";
import { TodayView } from "@/features/today/today-view";
import { createClient } from "@/lib/supabase/server";

// Zawartość zależy od ciasteczek (profil) → connection + Suspense
type Parametry = Promise<{ szybko?: string }>;

async function Dzis({ searchParams }: { searchParams: Parametry }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const dane = await loadToday(supabase, user.id);
  const name =
    dane.profile.displayName?.trim() ||
    (user.email ?? "").split("@")[0] ||
    "Konto";

  // Awatar na telefonie: podpisany adres zdjęcia z profilu (brak → inicjał)
  const avatarUrl = await getAvatarUrl(supabase, dane.profile.avatarPath);

  // ?szybko=… (⌘K, skróty, ekran Szukaj) — otwiera wybrane okno od razu
  const parametry = await searchParams;
  const szybko = QUICK_ACTIONS.find((a) => a === parametry.szybko) ?? null;

  return (
    <TodayView
      data={dane}
      name={name}
      avatarUrl={avatarUrl}
      openOnLoad={szybko}
    />
  );
}

export default function DzisPage({ searchParams }: { searchParams: Parametry }) {
  return (
    <Suspense fallback={<ModuleHeader title="Dziś" />}>
      <Dzis searchParams={searchParams} />
    </Suspense>
  );
}
