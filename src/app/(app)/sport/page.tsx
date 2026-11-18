import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { loadSportMonth } from "@/features/sport/load-sport";
import { SportView } from "@/features/sport/sport-view";
import { createClient } from "@/lib/supabase/server";

type Parametry = Promise<{
  miesiac?: string;
  wybrany?: string;
  nowy?: string;
  data?: string;
  godzina?: string;
}>;

// Dane zależą od ciasteczek i adresu → connection + Suspense (jak /kalendarz)
async function Sport({ searchParams }: { searchParams: Parametry }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parametry = await searchParams;
  // Zły albo brak `miesiac` → loader pokaże bieżący miesiąc
  const dane = await loadSportMonth(supabase, user.id, parametry.miesiac ?? "");

  // ?nowy=silownia&data=YYYY-MM-DD&godzina=HH:MM (z kalendarza głównego) → pusty trening siłowy.
  // Brak albo zła data / godzina → null, widok weźmie dziś i teraz zaokrąglone do 15 min.
  const nowySilowy =
    parametry.nowy === "silownia"
      ? {
          date:
            parametry.data && /^\d{4}-\d{2}-\d{2}$/.test(parametry.data)
              ? parametry.data
              : null,
          start:
            parametry.godzina &&
            /^([01]\d|2[0-3]):[0-5]\d$/.test(parametry.godzina)
              ? parametry.godzina
              : null,
        }
      : null;

  return (
    <SportView
      data={dane}
      selectedKey={parametry.wybrany ?? null}
      newGym={nowySilowy}
    />
  );
}

export default function SportPage({
  searchParams,
}: {
  searchParams: Parametry;
}) {
  return (
    <Suspense fallback={<ModuleHeader title="Sport" />}>
      <Sport searchParams={searchParams} />
    </Suspense>
  );
}
