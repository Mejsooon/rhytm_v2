// Karta „Ten tydzień” wg Today.dc.html: pięć kafelków (Zadania, Nawyki, Śr. sen, Bieg, Treningi),
// każdy z wartością, paskiem postępu i dopiskiem. Liczby przychodzą gotowe z `weekTiles` (model.ts).
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

  // Najbliższy bieg: „dziś 16:00” albo „cz 18:00”
  const { nextRun } = tiles.run;
  const biegDopisek =
    nextRun === null
      ? "brak zaplanowanych"
      : `${nextRun.date === today ? "dziś" : DNI_SKROT[weekdayOf(nextRun.date)]} ${formatClockTime(Math.floor(nextRun.startMin / 60), nextRun.startMin % 60, clock)}`;

  // Pasek: wypełnienie 0–100%
  const procent = (czesc: number, calosc: number) =>
    calosc > 0 ? Math.min(100, Math.round((czesc / calosc) * 100)) : 0;

  const kafelki: {
    etykieta: string;
    wartosc: string;
    jednostka: string;
    pasek: number;
    dopisek: string;
  }[] = [
    {
      etykieta: "Zadania",
      wartosc:
        tiles.tasks.percent === null
          ? "—"
          : `${tiles.tasks.done}/${tiles.tasks.total}`,
      jednostka: "",
      pasek: tiles.tasks.percent ?? 0,
      dopisek:
        tiles.tasks.percent === null
          ? `dziś ${tiles.tasks.todayDone}/${tiles.tasks.todayTotal}`
          : `${tiles.tasks.percent}% · dziś ${tiles.tasks.todayDone}/${tiles.tasks.todayTotal}`,
    },
    {
      etykieta: "Nawyki",
      wartosc: tiles.habits.percent === null ? "—" : `${tiles.habits.percent}%`,
      jednostka: "",
      pasek: tiles.habits.percent ?? 0,
      dopisek: `${tiles.habits.above70} z ${tiles.habits.plannedDays} dni powyżej 70%`,
    },
    {
      etykieta: "Śr. sen",
      wartosc: tiles.sleep.avgMin === null ? "—" : hmm(tiles.sleep.avgMin),
      jednostka: `/ ${hmm(tiles.sleep.goalMin)}`,
      pasek:
        tiles.sleep.avgMin === null
          ? 0
          : procent(tiles.sleep.avgMin, tiles.sleep.goalMin),
      dopisek: `${tiles.sleep.nightsAtGoal} z ${tiles.sleep.nights} nocy ≥ cel`,
    },
    {
      etykieta: "Bieg",
      wartosc: formatKm(tiles.run.km),
      // Bez celu tylko liczba km i pusty pasek
      jednostka:
        tiles.run.goalKm === null
          ? "km"
          : `/ ${String(tiles.run.goalKm).replace(".", ",")} km`,
      pasek:
        tiles.run.goalKm === null ? 0 : procent(tiles.run.km, tiles.run.goalKm),
      dopisek: biegDopisek,
    },
    {
      etykieta: "Treningi",
      wartosc: String(tiles.workouts.done),
      jednostka: tiles.workouts.total > 0 ? `/ ${tiles.workouts.total}` : "",
      pasek: procent(tiles.workouts.done, tiles.workouts.total),
      dopisek: "",
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
            <div
              role="progressbar"
              aria-label={k.etykieta}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={k.pasek}
              className="h-1 rounded-sm bg-[#f0f0f0]"
            >
              <div
                className="h-1 rounded-sm bg-[#15803d]"
                style={{ width: `${k.pasek}%` }}
              />
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
