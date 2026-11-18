import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { loadToday } from "@/features/today/load-today";
import { TodayView } from "@/features/today/today-view";
import { createClient } from "@/lib/supabase/server";

// Zawartość zależy od ciasteczek (profil) → connection + Suspense
async function Dzis() {
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

  return <TodayView data={dane} name={name} />;
}

export default function DzisPage() {
  return (
    <Suspense fallback={<ModuleHeader title="Dziś" />}>
      <Dzis />
    </Suspense>
  );
}
