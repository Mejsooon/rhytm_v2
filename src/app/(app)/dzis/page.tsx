import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { Button } from "@/components/controls";
import { ModuleHeader } from "@/components/shell/module-header";
import { EmptyToday } from "@/features/today/empty-today";
import { firstSteps } from "@/features/today/first-steps";
import { createClient } from "@/lib/supabase/server";
import { safeTimezone } from "@/lib/time/timezones";

const NOWY_BLOK = (
  <Button asChild variant="primary" size="sm">
    <a href="/kalendarz">Nowy blok</a>
  </Button>
);

// Zawartość zależy od ciasteczek (profil) → connection + Suspense
async function Dzis() {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data: profil } = await supabase
    .from("profiles")
    .select("display_name, timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  const name = profil?.display_name?.trim() || (user.email ?? "").split("@")[0] || "Konto";
  const strefa = safeTimezone(profil?.timezone);

  // „Wtorek · 17 listopada”: dzień tygodnia z wielkiej litery, miesiąc w dopełniaczu, w strefie profilu
  const teraz = new Date();
  const dzienTygodnia = new Intl.DateTimeFormat("pl-PL", { weekday: "long", timeZone: strefa }).format(teraz);
  const dataKrotka = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long", timeZone: strefa }).format(teraz);
  const etykieta = `${dzienTygodnia.charAt(0).toUpperCase()}${dzienTygodnia.slice(1)} · ${dataKrotka}`;

  // Etap 1: brak tabel bloków, nawyków, treningów i snu — wszystkie liczniki to 0
  const kroki = firstSteps({ blocks: 0, habits: 0, workouts: 0, sleepLogs: 0 });

  return (
    <>
      <ModuleHeader title="Dziś" phoneLabel={etykieta} webAction={NOWY_BLOK} />
      <EmptyToday name={name} steps={kroki} />
    </>
  );
}

export default function DzisPage() {
  return (
    <Suspense fallback={<ModuleHeader title="Dziś" webAction={NOWY_BLOK} />}>
      <Dzis />
    </Suspense>
  );
}
