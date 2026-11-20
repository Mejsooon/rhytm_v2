"use client";

// Trening siłowy na telefonie wg MGym.dc.html: nagłówek (Wstecz, nazwa, „x/y serii · czas”, Zakończ),
// pasek postępu, karty ćwiczeń z polami kg / powt. i dużymi checkboxami, „+ Dodaj serię”, „Dodaj ćwiczenie”.
// Bez minutnika przerwy (spec 9.1). Stan serii przychodzi z GymLog (ten sam use-gym-store co web).
// Czas: zakończony — od startu do end_local; dzisiejszy w trakcie — od startu do teraz (tyka co sekundę);
// inaczej bez czasu *[Claude]*.
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckIcon, ChevronLeft, Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { ExercisePicker } from "../exercise-picker";
import type { WorkoutData } from "../load-sport";
import { formatDuration, formatKg, lastSetsSummary } from "../model";
import { isTempId, type GymStore } from "../use-gym-store";

const POLE =
  "box-border h-11 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-1.5 font-mono text-base text-foreground outline-none placeholder:text-faint-foreground focus:border-primary focus:bg-white disabled:opacity-60";
const KOLUMNY = "grid grid-cols-[36px_1fr_1fr_44px] gap-2 px-3.5";

export function MGym({
  data,
  store,
  finishing,
  onFinish,
}: {
  data: WorkoutData;
  store: GymStore;
  // „Zakończ” w toku (wspólne z przyciskiem web)
  finishing: boolean;
  onFinish: () => void;
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

  const procent =
    store.totalCount === 0
      ? 0
      : Math.round((store.doneCount / store.totalCount) * 100);

  return (
    <div className="flex flex-col">
      <header className="flex min-h-[60px] items-center gap-1 p-2">
        <Link
          href={`/sport?miesiac=${dataTreningu.slice(0, 7)}`}
          aria-label="Wstecz"
          className="inline-flex size-11 flex-none items-center justify-center rounded-md text-foreground outline-none hover:bg-muted focus-visible:shadow-focus"
        >
          <ChevronLeft size={22} aria-hidden="true" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <h1 className="m-0 truncate text-[15px] font-semibold">
            {session.title}
          </h1>
          <div
            data-testid="m-serie"
            className="font-mono text-[11px] text-muted-foreground"
          >
            {`${store.doneCount}/${store.totalCount} serii${czas ? ` · ${czas}` : ""}`}
          </div>
        </div>
        <button
          type="button"
          disabled={finishing}
          onClick={onFinish}
          className="flex h-11 cursor-pointer items-center border-0 bg-transparent px-3 text-[15px] font-semibold text-success outline-none focus-visible:shadow-focus disabled:cursor-default disabled:opacity-50"
        >
          Zakończ
        </button>
      </header>
      <div className="h-1 flex-none bg-active">
        <div
          data-testid="m-postep"
          className="h-full bg-success"
          style={{ width: `${procent}%` }}
        />
      </div>

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
            <section
              key={cwiczenie.id}
              aria-labelledby={naglowekId}
              className="rounded-xl border border-border bg-white"
            >
              <div className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
                <span id={naglowekId} className="flex-1 font-semibold">
                  {cwiczenie.name}
                </span>
                {ostatnio && (
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {ostatnio}
                  </span>
                )}
              </div>
              <div
                className={cn(
                  KOLUMNY,
                  "py-1 font-mono text-[11px] text-faint-foreground",
                )}
              >
                <span>SERIA</span>
                <span>KG</span>
                <span>POWT.</span>
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
                      "min-h-12 items-center",
                      s.done && "bg-success-soft",
                    )}
                  >
                    <span className="font-mono text-[13px] text-muted-foreground">
                      {j + 1}
                    </span>
                    {cwiczenie.bodyweight ? (
                      // Masa ciała: „mc” albo „mc + 5”; pole to dociążenie (puste = bez dociążenia)
                      <span className="flex min-w-0 items-center font-mono text-base text-foreground">
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
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={s.done}
                      aria-label={etykieta}
                      disabled={zablokowana}
                      onClick={() => void store.toggleDone(s.id)}
                      // Kwadrat 32 px, pole stuknięcia 44 px (pseudo-element)
                      className={cn(
                        "relative inline-flex size-8 cursor-pointer items-center justify-center rounded-[9px] border-[1.5px] p-0 text-white outline-none after:absolute after:-inset-1.5 after:content-[''] focus-visible:shadow-focus disabled:cursor-default disabled:opacity-50",
                        s.done
                          ? "border-success bg-success"
                          : "border-border-strong bg-white",
                      )}
                    >
                      {s.done && (
                        <CheckIcon
                          aria-hidden="true"
                          strokeWidth={3}
                          className="size-[18px]"
                        />
                      )}
                    </button>
                  </div>
                );
              })}
              <button
                type="button"
                disabled={tymczasowe}
                onClick={() => void store.addSet(cwiczenie.id)}
                className="h-11 w-full cursor-pointer rounded-b-xl border-0 border-t border-solid border-border bg-transparent text-sm text-soft-foreground outline-none focus-visible:bg-panel disabled:cursor-default disabled:opacity-50"
              >
                + Dodaj serię
              </button>
            </section>
          );
        })}

        <ExercisePicker
          exercises={data.exercises}
          excludeNames={store.exercises.map((e) => e.name)}
          onPick={(name) => void store.addExercise(name)}
          trigger={
            <button
              type="button"
              className="box-border flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input bg-white font-medium text-foreground outline-none hover:bg-panel focus-visible:shadow-focus"
            >
              <Plus size={18} aria-hidden="true" />
              Dodaj ćwiczenie
            </button>
          }
        />
      </div>
    </div>
  );
}
