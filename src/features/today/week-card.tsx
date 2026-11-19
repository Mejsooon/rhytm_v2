// Karta „Ten tydzień” wg Today.dc.html: pięć kafelków (Zadania, Nawyki, Śr. sen, Bieg, Treningi),
// każdy z wartością, słupkami 7 dni tygodnia i dopiskiem. Liczby przychodzą gotowe z `weekTiles` (model.ts).
import { MonoLabel } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { DNI_SKROT } from "@/features/calendar/mobile/pl";
import { addDays, weekdayOf } from "@/features/calendar/view-range";
import { formatKm } from "@/features/sport/model";
import { formatClockTime } from "@/lib/time/timezones";
import type { WeekTiles } from "./model";

export function WeekCard({
  tiles,
  weekStartDate,
  today,
  clock,
}: {
  tiles: WeekTiles;
  weekStartDate: IsoDate;
  today: IsoDate;
  clock: "24" | "12";
}) {
  // Zakres „pn 16 – nd 22.11”; gdy tydzień przechodzi przez miesiąc: „pn 30.11 – nd 6.12”
  const koniec = addDays(weekStartDate, 6);
  const [, mOd, dOd] = weekStartDate.split("-").map(Number);
  const [, mDo, dDo] = koniec.split("-").map(Number);
  const zakres = `${DNI_SKROT[weekdayOf(weekStartDate)]} ${dOd}${mOd === mDo ? "" : `.${String(mOd).padStart(2, "0")}`} – ${DNI_SKROT[weekdayOf(koniec)]} ${dDo}.${String(mDo).padStart(2, "0")}`;

  // Czas snu „h:mm”
  const hmm = (minuty: number) =>
    `${Math.floor(minuty / 60)}:${String(minuty % 60).padStart(2, "0")}`;

  // „dziś”, „jutro” albo skrót dnia
  const nazwaDnia = (data: IsoDate, zJutrem: boolean) =>
    data === today
      ? "dziś"
      : zJutrem && data === addDays(today, 1)
        ? "jutro"
        : DNI_SKROT[weekdayOf(data)];
  // Km bez zbędnego zera: „10”, „7,5”
  const km = (v: number) => String(Math.round(v * 10) / 10).replace(".", ",");

  // Najbliższy bieg: „dziś 16:00 · 10 km w planie”, bez dystansu sama godzina
  const { nextRun } = tiles.run;
  const biegDopisek =
    nextRun === null
      ? "brak zaplanowanych"
      : `${nazwaDnia(nextRun.date, false)} ${formatClockTime(Math.floor(nextRun.startMin / 60), nextRun.startMin % 60, clock)}${nextRun.distanceKm !== null ? ` · ${km(nextRun.distanceKm)} km w planie` : ""}`;

  // Pozostałe treningi tygodnia: „bieg dziś, siłownia cz” (najwyżej dwa)
  const nadchodzace = tiles.workouts.upcoming.slice(0, 2);
  const treningiDopisek =
    nadchodzace.length === 0
      ? "brak w planie"
      : nadchodzace
          .map(
            (u) =>
              `${u.kind === "run" ? "bieg" : "siłownia"} ${nazwaDnia(u.date, true)}`,
          )
          .join(", ");

  // Słupki dni jak `spark` w makiecie: wysokość v / max × 28 px (min. 3 px);
  // dzień bez wartości szary #eaeaea, dziś zielony, dzień z osiągniętym celem ciemny
  const indeksDzis = Array.from({ length: 7 }, (_, i) =>
    addDays(weekStartDate, i),
  ).indexOf(today);
  type Slupek = { tytul: string; wysokosc: number; kolor: string };
  const slupki = (
    wartosci: (number | null)[],
    max: number,
    cel: (v: number, i: number) => boolean,
    tytul: (v: number, i: number) => string,
  ): Slupek[] =>
    wartosci.map((v, i) => ({
      tytul:
        v !== null
          ? tytul(v, i)
          : i < indeksDzis
            ? "brak wpisu"
            : "jeszcze nie",
      wysokosc: v === null ? 3 : Math.max(3, Math.round((v / max) * 28)),
      kolor:
        v === null
          ? "#eaeaea"
          : i === indeksDzis
            ? "#15803d"
            : cel(v, i)
              ? "#171717"
              : "#d4d4d4",
    }));
  const bezCelu = () => false;
  const najwiecej = (wartosci: (number | null)[]) =>
    Math.max(1, ...wartosci.map((v) => v ?? 0));

  const { days } = tiles;
  // Nawyki: wysokość = odhaczone / największy plan dnia w tygodniu, ciemny dzień > 70%
  const nawykiZrobione = days.habits.map((d) => (d === null ? null : d.done));
  const nawykiMax = Math.max(1, ...days.habits.map((d) => d?.planned ?? 0));

  const kafelki: {
    etykieta: string;
    wartosc: string;
    jednostka: string;
    slupki: Slupek[];
    dopisek: string;
  }[] = [
    {
      etykieta: "Zadania",
      wartosc:
        tiles.tasks.percent === null
          ? "—"
          : `${tiles.tasks.done}/${tiles.tasks.total}`,
      jednostka: "",
      slupki: slupki(days.tasks, najwiecej(days.tasks), bezCelu, (v) => `${v}`),
      dopisek:
        tiles.tasks.percent === null
          ? `dziś ${tiles.tasks.todayDone}/${tiles.tasks.todayTotal}`
          : `${tiles.tasks.percent}% · dziś ${tiles.tasks.todayDone}/${tiles.tasks.todayTotal}`,
    },
    {
      etykieta: "Nawyki",
      wartosc: tiles.habits.percent === null ? "—" : `${tiles.habits.percent}%`,
      jednostka: "",
      slupki: slupki(
        nawykiZrobione,
        nawykiMax,
        (v, i) => {
          const plan = days.habits[i]?.planned ?? 0;
          return plan > 0 && (v / plan) * 100 > 70;
        },
        (v, i) => `${v}/${days.habits[i]?.planned ?? 0}`,
      ),
      dopisek: `${tiles.habits.above70} z ${tiles.habits.plannedDays} dni powyżej 70%`,
    },
    {
      etykieta: "Śr. sen",
      wartosc: tiles.sleep.avgMin === null ? "—" : hmm(tiles.sleep.avgMin),
      jednostka: `/ ${hmm(tiles.sleep.goalMin)}`,
      slupki: slupki(
        days.sleep,
        Math.max(tiles.sleep.goalMin + 60, ...days.sleep.map((v) => v ?? 0)),
        (v) => v >= tiles.sleep.goalMin,
        (v) => hmm(v),
      ),
      dopisek: `${tiles.sleep.nightsAtGoal} z ${tiles.sleep.nights} nocy ≥ cel`,
    },
    {
      etykieta: "Bieg",
      wartosc: formatKm(tiles.run.km),
      // Bez celu tylko liczba km (bez „/ cel”)
      jednostka:
        tiles.run.goalKm === null
          ? "km"
          : `/ ${String(tiles.run.goalKm).replace(".", ",")} km`,
      slupki: slupki(
        days.km,
        najwiecej(days.km),
        bezCelu,
        (v) => `${km(v)} km`,
      ),
      dopisek: biegDopisek,
    },
    {
      etykieta: "Treningi",
      wartosc: String(tiles.workouts.done),
      jednostka: tiles.workouts.total > 0 ? `/ ${tiles.workouts.total}` : "",
      slupki: slupki(
        days.workouts,
        najwiecej(days.workouts),
        bezCelu,
        (v) => `${v}`,
      ),
      dopisek: treningiDopisek,
    },
  ];

  return (
    <section aria-labelledby="ten-tydzien">
      <div className="mb-2.5 flex items-baseline justify-between">
        <h2 id="ten-tydzien" className="m-0 text-[15px] font-semibold">
          Ten tydzień
        </h2>
        <span className="font-mono text-xs text-[#6b6b6b]">{zakres}</span>
      </div>
      <div className="grid grid-cols-5 gap-px overflow-hidden rounded-lg border border-[#eaeaea] bg-[#eaeaea] max-[799px]:grid-cols-2">
        {kafelki.map((k) => (
          <div
            key={k.etykieta}
            data-testid="kafelek-tygodnia"
            className="flex flex-col gap-2.5 bg-white px-4 py-3.5"
          >
            <MonoLabel>{k.etykieta}</MonoLabel>
            <div className="font-mono text-2xl leading-none text-[#171717]">
              {k.wartosc}{" "}
              {k.jednostka && (
                <span className="text-[13px] text-[#666666]">
                  {k.jednostka}
                </span>
              )}
            </div>
            <div className="grid h-7 grid-cols-7 items-end gap-[3px]">
              {k.slupki.map((s, i) => (
                <span
                  key={i}
                  aria-hidden="true"
                  data-testid="slupek-dnia"
                  title={s.tytul}
                  className="block rounded-[2px]"
                  style={{ height: s.wysokosc, background: s.kolor }}
                />
              ))}
            </div>
            {/* Pusty dopisek trzyma wysokość, żeby kafelki w rzędzie się zgadzały */}
            <div className="min-h-[1lh] font-mono text-[11px] text-[#6b6b6b]">
              {k.dopisek}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
