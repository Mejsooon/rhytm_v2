import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { loadTemplates } from "@/features/sport/load-sport";
import { TemplatesList } from "@/features/sport/templates-list";
import { createClient } from "@/lib/supabase/server";

type Parametry = Promise<{ komunikat?: string; nazwa?: string }>;

// Dane zależą od ciasteczek i adresu → connection + Suspense (jak /sport)
async function Szablony({ searchParams }: { searchParams: Parametry }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const dane = await loadTemplates(supabase, user.id);

  // Zielony komunikat po zapisie / usunięciu z edytora (teksty z makiety); nieznany komunikat → brak
  // Nazwa z adresu przycięta do długości nazwy szablonu (60 znaków) — link można spreparować ręcznie
  const { komunikat, nazwa: nazwaZAdresu = "" } = await searchParams;
  const nazwa = nazwaZAdresu.slice(0, 60);
  const flash =
    komunikat === "dodano"
      ? `Dodano szablon „${nazwa}”.`
      : komunikat === "zapisano"
        ? `Zapisano zmiany w szablonie „${nazwa}”.`
        : komunikat === "usunieto"
          ? `Usunięto szablon „${nazwa}”.`
          : null;

  return <TemplatesList data={dane} flash={flash} />;
}

export default function SzablonyPage({
  searchParams,
}: {
  searchParams: Parametry;
}) {
  return (
    <Suspense fallback={<ModuleHeader title="Sport" />}>
      <Szablony searchParams={searchParams} />
    </Suspense>
  );
}
