"use client";

// Trening siłowy na telefonie wg CMGym.dc.html: nagłówek (Wstecz, nazwa, „x/y serii · czas”, Zakończ),
// pasek postępu, karty ćwiczeń (nazwa = link do szczegółów, wynik z ostatniego razu, „Usuń ćwiczenie”)
// z polami kg / powt. i checkboxem, „+ Dodaj serię”, „Dodaj ćwiczenie”, dopisek o masie ciała i „Zapisz jako szablon”.
// Bez minutnika przerwy (spec 9.1). Stan serii przychodzi z GymLog (ten sam use-gym-store co web).
// Czas: zakończony — od startu do end_local; dzisiejszy w trakcie — od startu do teraz (tyka co sekundę);
// inaczej bez czasu *[Claude]*.
import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Plus, Trash2 } from "lucide-react";

import {
  Button,
  Card,
  Checkbox,
  Progress,
  StatusBadge,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { ExercisePicker } from "../exercise-picker";
import type { WorkoutData } from "../load-sport";
import { formatDuration, formatKg, lastSetsSummary } from "../model";
import { isTempId, type GymStore } from "../use-gym-store";

const POLE =
  "box-border h-11 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-1.5 text-base font-medium text-foreground tabular-nums outline-none placeholder:text-faint-foreground focus:border-primary focus:bg-white disabled:opacity-60";
// .set-grid z CMGym: Seria · kg · Powt. · znacznik
const KOLUMNY = "grid grid-cols-[36px_1fr_1fr_44px] items-center gap-2 px-3.5";

export function MGym({
  data,
  store,
  finishing,
  onFinish,
  onSaveTemplate,
}: {
  data: WorkoutData;
  store: GymStore;
  // „Zakończ” w toku (wspólne z przyciskiem web)
  finishing: boolean;
  onFinish: () => void;
  // „Zapisz jako szablon” — to samo okno co na webie (nazwa szablonu, saveSessionAsTemplate)
  onSaveTemplate: () => void;
}) {
  const { session, profile } = data;
  const dataTreningu = session.start_local.slice(0, 10);
  const startS = Date.parse(`${session.start_local}Z`);

  // Teraz w strefie profilu ('YYYY-MM-DDTHH:MM:SS'); liczone dopiero po hydratacji, potem co sekundę.
  // Zegar tyka tylko dla niezakończonego treningu.
  const [teraz, setTeraz] = useState<string | null>(null);
  useEffect(() => {
    if (session.completed) return;
    const odczytaj = () =>
      setTeraz(
        new Intl.DateTimeFormat("sv-SE", {
          timeZone: profile.timezone,
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hourCycle: "h23",
        })
          .format(new Date())
          .replace(" ", "T"),
      );
    odczytaj();
    const zegar = setInterval(odczytaj, 1000);
    return () => clearInterval(zegar);
  }, [session.completed, profile.timezone]);

  let czas: string | null = null;
  if (session.completed && session.end_local) {
    czas = formatDuration(
      (Date.parse(`${session.end_local}Z`) - startS) / 1000,
    );
  } else if (
    !session.completed &&
    teraz !== null &&
    teraz.slice(0, 10) === dataTreningu
  ) {
    const minelo = (Date.parse(`${teraz}Z`) - startS) / 1000;
    if (minelo >= 0) czas = formatDuration(minelo);
  }

  const zMasaCiala = store.exercises.some((e) => e.bodyweight);

  return (
    <div className="flex flex-col">
      <header className="m-head px-2">
        <Button variant="ghost" icon asChild>
          <Link
            href={`/sport?miesiac=${dataTreningu.slice(0, 7)}`}
            aria-label="Wstecz"
          >
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="m-title truncate text-base">{session.title}</h1>
          <div
            data-testid="m-serie"
            className="text-xs text-muted-foreground tabular-nums"
          >
            {`${store.doneCount}/${store.totalCount} serii${czas ? ` · ${czas}` : ""}`}
          </div>
        </div>
        <Button
          variant="ghost"
          disabled={finishing}
          onClick={onFinish}
          className="text-success"
        >
          Zakończ
        </Button>
      </header>
      <Progress
        value={store.doneCount}
        max={store.totalCount}
        ariaLabel="Postęp serii"
        className="h-1 flex-none rounded-none"
      />

      <div className="flex flex-col gap-4 px-4 pt-3.5 pb-6">
        {store.exercises.map((cwiczenie) => {
          const tymczasowe = isTempId(cwiczenie.id);
          const naglowekId = `m-cwiczenie-${cwiczenie.id}`;
          const ostatnio = lastSetsSummary(
            data.history,
            session.id,
            cwiczenie.id,
            cwiczenie.bodyweight,
          );
          return (
            <Card key={cwiczenie.id} role="region" aria-labelledby={naglowekId}>
              <div className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
                {tymczasowe ? (
                  <span id={naglowekId} className="flex-1 font-semibold">
                    {cwiczenie.name}
                  </span>
                ) : (
                  <Link
                    id={naglowekId}
                    href={`/sport/cwiczenia/${cwiczenie.id}`}
                    className="flex-1 font-semibold text-foreground no-underline outline-none focus-visible:shadow-focus"
                  >
                    {cwiczenie.name}
                  </Link>
                )}
                {ostatnio && (
                  <StatusBadge tone="outline" className="tabular-nums">
                    {ostatnio}
                  </StatusBadge>
                )}
                <Button
                  variant="ghost"
                  icon
                  aria-label={`Usuń ćwiczenie ${cwiczenie.name}`}
                  disabled={tymczasowe}
                  onClick={() => void store.removeExercise(cwiczenie.id)}
                  className="-mr-2.5 text-muted-foreground"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </Button>
              </div>
              <div
                className={cn(
                  KOLUMNY,
                  "border-b border-border py-1.5 text-xs font-medium text-muted-foreground",
                )}
              >
                <span>Seria</span>
                <span>kg</span>
                <span>Powt.</span>
                <span />
              </div>
              {cwiczenie.sets.map((s, j) => {
                const etykieta = `${cwiczenie.name}, seria ${j + 1}`;
                const szkic = store.drafts.get(s.id);
                const zablokowana = isTempId(s.id);
                return (
                  <div
                    key={s.id}
                    className={cn(
                      KOLUMNY,
                      "min-h-12 border-b border-black/5",
                      s.done && "bg-success-soft",
                    )}
                  >
                    <StatusBadge tone="gray" className="w-6 tabular-nums">
                      {j + 1}
                    </StatusBadge>
                    {cwiczenie.bodyweight ? (
                      // Masa ciała: „mc” albo „mc + 5”; pole to dociążenie (puste = bez dociążenia)
                      <span className="flex min-w-0 items-center text-base font-medium text-foreground tabular-nums">
                        <span
                          title="Masa ciała z profilu"
                          className="flex-none whitespace-pre"
                        >
                          {(szkic?.kg ??
                            (s.weight_kg === null || s.weight_kg === 0
                              ? ""
                              : formatKg(s.weight_kg))) === ""
                            ? "mc"
                            : "mc + "}
                        </span>
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="+ kg"
                          aria-label={`${etykieta} — dociążenie (kg)`}
                          disabled={zablokowana}
                          value={
                            szkic?.kg ??
                            (s.weight_kg === null || s.weight_kg === 0
                              ? ""
                              : formatKg(s.weight_kg))
                          }
                          onChange={(e) =>
                            store.setDraft(s.id, "kg", e.target.value)
                          }
                          onBlur={() => void store.commitDraft(s.id, "kg")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                          className={POLE}
                        />
                      </span>
                    ) : (
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="mc"
                        aria-label={`${etykieta} — ciężar`}
                        disabled={zablokowana}
                        value={
                          szkic?.kg ??
                          (s.weight_kg === null ? "" : formatKg(s.weight_kg))
                        }
                        onChange={(e) =>
                          store.setDraft(s.id, "kg", e.target.value)
                        }
                        onBlur={() => void store.commitDraft(s.id, "kg")}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") e.currentTarget.blur();
                        }}
                        className={POLE}
                      />
                    )}
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="—"
                      aria-label={`${etykieta} — powtórzenia`}
                      disabled={zablokowana}
                      value={
                        szkic?.reps ?? (s.reps === null ? "" : String(s.reps))
                      }
                      onChange={(e) =>
                        store.setDraft(s.id, "reps", e.target.value)
                      }
                      onBlur={() => void store.commitDraft(s.id, "reps")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") e.currentTarget.blur();
                      }}
                      className={POLE}
                    />
                    <div className="justify-self-center">
                      <Checkbox
                        checked={s.done}
                        ariaLabel={etykieta}
                        disabled={zablokowana}
                        onChange={() => void store.toggleDone(s.id)}
                      />
                    </div>
                  </div>
                );
              })}
              <Button
                variant="ghost"
                disabled={tymczasowe}
                onClick={() => void store.addSet(cwiczenie.id)}
                className="w-full rounded-t-none rounded-b-[15px] border-0 border-t border-solid border-border"
              >
                + Dodaj serię
              </Button>
            </Card>
          );
        })}

        <ExercisePicker
          exercises={data.exercises}
          excludeNames={store.exercises.map((e) => e.name)}
          onPick={(name) => void store.addExercise(name)}
          trigger={
            <Button className="w-full border-dashed">
              <Plus size={18} aria-hidden="true" />
              Dodaj ćwiczenie
            </Button>
          }
        />

        {zMasaCiala && (
          <p className="-mt-1.5 mb-0 text-center text-xs text-muted-foreground">
            {profile.weightKg !== null ? (
              `mc = masa ciała ${formatKg(profile.weightKg)} kg z profilu · „+ kg” to dociążenie`
            ) : (
              <>
                Uzupełnij wagę w profilu (
                <Link
                  href="/ustawienia/ogolne"
                  className="text-foreground underline"
                >
                  Ustawienia → Profil
                </Link>
                ), żeby liczyć objętość i rekordy.
              </>
            )}
          </p>
        )}

        <Button className="w-full" onClick={onSaveTemplate}>
          Zapisz jako szablon
        </Button>
      </div>
    </div>
  );
}
