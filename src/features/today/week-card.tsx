// Karta „Ten tydzień” wg S2Today: jedna karta, 4 wiersze (Treningi, Bieg, Nawyki, Sen),
// każdy z paskiem celu, wartością i prawą kolumną. Teksty przychodzą gotowe z `weekBars` (model.ts).
import { Card } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { DNI_SKROT } from "@/features/calendar/mobile/pl";
import { addDays, weekdayOf } from "@/features/calendar/view-range";
import type { WeekBar } from "./model";

export function WeekCard({
  bars,
  weekStartDate,
}: {
  bars: WeekBar[];
  weekStartDate: IsoDate;
}) {
  // Zakres „pn 16 – nd 22.11”; gdy tydzień przechodzi przez miesiąc: „pn 30.11 – nd 6.12”
  const koniec = addDays(weekStartDate, 6);
  const [, mOd, dOd] = weekStartDate.split("-").map(Number);
  const [, mDo, dDo] = koniec.split("-").map(Number);
  const zakres = `${DNI_SKROT[weekdayOf(weekStartDate)]} ${dOd}${mOd === mDo ? "" : `.${String(mOd).padStart(2, "0")}`} – ${DNI_SKROT[weekdayOf(koniec)]} ${dDo}.${String(mDo).padStart(2, "0")}`;

  return (
    <section aria-labelledby="ten-tydzien" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        {/* .card-t */}
        <h2
          id="ten-tydzien"
          className="m-0 text-base leading-[1.3] font-semibold"
        >
          Ten tydzień
        </h2>
        {/* .hint.num */}
        <span className="text-xs text-muted-foreground tabular-nums">
          {zakres}
        </span>
      </div>
      {/* .card z paddingiem 8 px 20 px */}
      <Card className="px-5 py-2">
        {bars.map((b) => (
          <div
            key={b.label}
            data-testid="wiersz-tygodnia"
            // Siatka 110 px / pasek / 150 px / 120 px, odstęp 16 px, min. 48 px; linia między wierszami
            className="grid min-h-12 grid-cols-[110px_minmax(0,1fr)_150px_120px] items-center gap-4 border-t border-black/[.06] first:border-t-0"
          >
            <span className="font-medium">{b.label}</span>
            {/* .bar: 8 px, tło rgba(0,0,0,.06), wypełnienie #262626 */}
            <div
              role="progressbar"
              aria-label={b.label}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={b.percent}
              className="h-2 overflow-hidden rounded-full bg-black/[.06]"
            >
              <span
                className="block h-full rounded-full bg-foreground"
                style={{ width: `${b.percent}%` }}
              />
            </div>
            <span className="tabular-nums">
              <b className="text-base font-semibold">{b.value}</b>
              {b.unit && (
                <>
                  {" "}
                  <span className="text-xs text-muted-foreground">
                    {b.unit}
                  </span>
                </>
              )}
            </span>
            <span className="text-right text-xs text-muted-foreground tabular-nums">
              {b.right}
            </span>
          </div>
        ))}
      </Card>
    </section>
  );
}
