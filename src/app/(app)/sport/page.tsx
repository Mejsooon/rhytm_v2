import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";

import { ModuleHeader } from "@/components/shell/module-header";
import { loadSportAll,
  loadSportMonth, loadSportRun } from "@/features/sport/load-sport";
import { SportView } from "@/features/sport/sport-view";
import { createClient } from "@/lib/supabase/server";

type Parametry = Promise<{
  miesiac?: string;
  wybrany?: string;
  nowy?: string;
  data?: string;
  godzina?: string;
  bieg?: string;
}>;

const DATA = /^\d{4}-\d{2}-\d{2}$/;
const GODZINA = /^([01]\d|2[0-3]):[0-5]\d$/;

// Dane zależą od ciasteczek i adresu → connection + Suspense (jak /kalendarz)
async function Sport({ searchParams }: { searchParams: Parametry }) {
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parametry = await searchParams;
  // Nowy bieg z kalendarza głównego (/sport?nowy=bieg&data=…) nie niesie `miesiac` — bierzemy go z daty
  const nowaData =
    parametry.data && DATA.test(parametry.data) ? parametry.data : null;
  const miesiac =
    parametry.miesiac ??
    (parametry.nowy === "bieg" && nowaData ? nowaData.slice(0, 7) : "");
  // Zły albo brak `miesiac` → loader pokaże bieżący miesiąc
  const [dane, wszystkie] = await Promise.all([
    loadSportMonth(supabase, user.id, miesiac),
    loadSportAll(supabase, user.id),
  ]);

  // ?bieg={id}: bieg spoza wczytanych tygodni (np. stary) czytamy osobno
  const runId = parametry.bieg ?? null;
  const runItem =
    runId && !dane.items.some((i) => i.kind === "run" && i.sessionId === runId)
      ? await loadSportRun(supabase, user.id, runId)
      : null;
  // ?nowy=bieg&data&godzina — brak albo zła wartość → null, widok weźmie dziś i teraz
  const nowyBieg =
    !runId && parametry.nowy === "bieg"
      ? {
          date: nowaData,
          start:
            parametry.godzina && GODZINA.test(parametry.godzina)
              ? parametry.godzina
              : null,
        }
      : null;

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
      all={wszystkie}
      data={dane}
      selectedKey={parametry.wybrany ?? null}
      newGym={nowySilowy}
      runId={runId}
      newRun={nowyBieg}
      runItem={runItem}
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
