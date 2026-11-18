import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { HabitsView } from "@/features/habits/habits-view";
import { loadHabitsPage } from "@/features/habits/load-habits";
import { createClient } from "@/lib/supabase/server";

type Parametry = Promise<{ tab?: string; nowy?: string }>;

// Dane zależą od ciasteczek → connection + Suspense (jak /kalendarz)
async function Nawyki({ searchParams }: { searchParams: Parametry }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const dane = await loadHabitsPage(supabase, user.id);
  const parametry = await searchParams;
  // ?tab=sen — zakładka Sen na telefonie; ?nowy=nawyk|sen — okno do otwarcia od razu (Task 5)
  const zakladka = parametry.tab === "sen" ? "sen" : null;
  const nowy =
    parametry.nowy === "nawyk" || parametry.nowy === "sen"
      ? parametry.nowy
      : null;

  return <HabitsView data={dane} initialTab={zakladka} openOnLoad={nowy} />;
}

export default function NawykiPage({
  searchParams,
}: {
  searchParams: Parametry;
}) {
  return (
    <Suspense fallback={<ModuleHeader title="Nawyki i sen" />}>
      <Nawyki searchParams={searchParams} />
    </Suspense>
  );
}
