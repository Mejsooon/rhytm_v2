"use client";

// Karta wykresu przeglądu (S2Sport): okres, liczba z porównaniem, kafle i słupki z dymkiem po najechaniu.
import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button, Card, Segment, StatusBadge, type BadgeTone } from "@/components/controls";
import { MIESIACE, type IsoDate } from "@/components/controls/calendar-math";
import { isoWeekNumber } from "@/features/calendar/view-range";
import { cn } from "@/lib/utils";
import type { SportProfile } from "./load-sport";
import { formatPace, plPlural, type SportItem } from "./model";
import { barInfo, metric, periodRange, shiftPeriod, stats, wZakresie, type Filtr, type Okres } from "./overview-model";

const liczba = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
const czas = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.round((s % 3600) / 60);
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")} min` : `${m} min`;
};

export function OverviewChart({
  items,
  filtr,
  today,
  okres,
  kotwica,
  onChange,
  profile,
  volume,
}: {
  // Aktywności po filtrze
  items: SportItem[];
  filtr: Filtr;
  today: IsoDate;
  okres: Okres;
  kotwica: IsoDate;
  onChange: (okres: Okres, kotwica: IsoDate) => void;
  profile: SportProfile;
  // Objętość i liczba serii treningu siłowego
  volume: (item: SportItem) => { kg: number; sets: number };
}) {
  const [dymek, setDymek] = useState<number | null>(null);
  const zakres = periodRange(okres, kotwica, profile.weekStart);
  const poprzedni = periodRange(okres, shiftPeriod(okres, kotwica, -1), profile.weekStart);
  const wOkresie = wZakresie(items, zakres.from, zakres.to);
  const przedtemWpisy = wZakresie(items, poprzedni.from, poprzedni.to);
  const biezacy = zakres.from <= today && today <= zakres.to;
  const maWczesniejsze = items.some((i) => i.date < zakres.from);

  const wKm = filtr === "all" || filtr === "run";
  const razem = metric(wOkresie, filtr);
  const przedtem = metric(przedtemWpisy, filtr);
  const plan = metric(wOkresie.filter((i) => i.date >= today), filtr, true);
  const s = stats(wOkresie);
  const wykonane = wOkresie.filter((i) => !i.planned);

  const nazwaPoprzedniego =
    okres === "miesiac"
      ? MIESIACE[Number(poprzedni.from.slice(5, 7)) - 1]
      : okres === "rok"
        ? poprzedni.from.slice(0, 4)
        : `tydz. ${isoWeekNumber(poprzedni.bins[3].from)}`;

  // Plakietka obok dużej liczby: plan, porównanie procentowe albo (siłownia, inne) objętość / różnica
  let zmiana: { tekst: string; tone: BadgeTone };
  if (filtr === "gym") {
    zmiana = { tekst: `${liczba(Math.round(wykonane.reduce((a, i) => a + volume(i).kg, 0)))} kg objętości`, tone: "gray" };
  } else if (biezacy && razem === 0 && plan > 0) {
    zmiana = { tekst: wKm ? `plan ${liczba(plan)} km` : `${liczba(plan)} w planie`, tone: "gray" };
  } else if (przedtem === 0) {
    zmiana = { tekst: "brak porównania", tone: "gray" };
  } else if (wKm) {
    const procent = Math.round(((razem - przedtem) / przedtem) * 100);
    zmiana = { tekst: `${procent > 0 ? "+" : ""}${procent}% vs ${nazwaPoprzedniego}`, tone: procent > 0 ? "green" : procent < 0 ? "orange" : "gray" };
  } else {
    const roznica = razem - przedtem;
    zmiana = { tekst: `${roznica > 0 ? "+" : ""}${roznica} vs ${nazwaPoprzedniego}`, tone: "gray" };
  }

  const trudnosci = wykonane.flatMap((i) => (i.difficulty !== null ? [i.difficulty] : []));
  const trudnosc = trudnosci.length ? `${liczba(trudnosci.reduce((a, b) => a + b, 0) / trudnosci.length)}/10` : "—";
  const ile = new Map<string, number>();
  for (const i of wykonane) ile.set(i.title, (ile.get(i.title) ?? 0) + 1);
  const najczesciej = [...ile].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";
  const kafle =
    filtr === "gym"
      ? [
          ["Serie", String(wykonane.reduce((a, i) => a + volume(i).sets, 0))],
          ["Czas", czas(s.totalS)],
          ["Objętość / trening", wykonane.length ? `${liczba(Math.round(wykonane.reduce((a, i) => a + volume(i).kg, 0) / wykonane.length))} kg` : "—"],
          ["Śr. trudność", trudnosc],
        ]
      : filtr === "other"
        ? [["Aktywności", String(s.other)], ["Czas", czas(s.totalS)], ["Najczęściej", najczesciej], ["Śr. trudność", trudnosc]]
        : [
            ["Biegi", String(s.runs)],
            ["Śr. tempo", s.paceS !== null ? `${formatPace(s.paceS)} /km` : "—"],
            ["Czas", czas(s.totalS)],
            ["Siłownia", plPlural(s.gym, "trening", "treningi", "treningów")],
          ];

  const slupki = zakres.bins.map((b) => {
    const wpisy = wZakresie(items, b.from, b.to);
    const trwa = b.from <= today && today <= b.to;
    return {
      label: b.label,
      done: metric(wpisy, filtr),
      plan: metric(wpisy.filter((i) => i.date >= today), filtr, true),
      trwa,
      opis: barInfo(wpisy, filtr, today, trwa),
    };
  });
  // Linia celu km: w miesiącu cel tygodnia, w roku przeliczony na miesiąc
  const cel = wKm && profile.kmGoalOn && okres !== "tydzien" ? (okres === "rok" ? Math.round((profile.weeklyKmGoal * 52) / 12) : profile.weeklyKmGoal) : null;
  const max = Math.max(1, (cel ?? 0) * 1.1, ...slupki.map((b) => Math.max(b.done, b.plan)));
  const wysokosc = (v: number) => (v / max) * 150;
  const jednostka = wKm ? "km" : filtr === "gym" ? "treningi siłowe" : "inne aktywności";
  const wOkresieTekst =
    okres === "miesiac" ? `w miesiącu` : okres === "rok" ? `w ${zakres.title}` : "w tygodniu";

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" icon aria-label="Poprzedni okres" disabled={!maWczesniejsze} onClick={() => onChange(okres, shiftPeriod(okres, kotwica, -1))}>
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <h2 className="m-0 text-base font-semibold">{zakres.title}</h2>
          <Button variant="ghost" size="sm" icon aria-label="Następny okres" disabled={zakres.to >= today} onClick={() => onChange(okres, shiftPeriod(okres, kotwica, 1))}>
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
        <Segment
          ariaLabel="Okres"
          value={okres}
          onChange={(v) => onChange(v, today)}
          options={[
            { value: "tydzien", label: "Tydzień" },
            { value: "miesiac", label: "Miesiąc" },
            { value: "rok", label: "Rok" },
          ]}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-baseline gap-2.5">
        <b data-testid="suma-okresu" className="text-[40px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
          {liczba(razem)}
        </b>
        <span className="text-muted-foreground">{`${jednostka} ${wOkresieTekst}`}</span>
        <StatusBadge tone={zmiana.tone} className="ml-1 tabular-nums">
          {zmiana.tekst}
        </StatusBadge>
      </div>
      <div className="mt-4 grid grid-cols-4 gap-3">
        {kafle.map(([k, v]) => (
          <div key={k} className="min-w-0">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="truncate text-lg font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      <div className="relative mt-5 flex h-[170px] items-end gap-2 border-b border-border" onMouseLeave={() => setDymek(null)}>
        {cel !== null && (
          <>
            <div className="absolute inset-x-0 border-t border-dashed border-[#15803d]" style={{ bottom: wysokosc(cel) }} />
            <span className="absolute right-0" style={{ bottom: wysokosc(cel) + 4 }}>
              <StatusBadge tone="green">{`cel ${liczba(cel)} km`}</StatusBadge>
            </span>
          </>
        )}
        {slupki.map((b, i) => {
          const duch = b.done === 0 && b.plan > 0;
          return (
            <div key={b.label} className="flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setDymek(i)}>
              <button
                type="button"
                aria-label={`${b.label}: ${b.opis}`}
                onFocus={() => setDymek(i)}
                onBlur={() => setDymek(null)}
                className={cn(
                  "mx-auto block w-full max-w-[56px] cursor-default rounded-t-[6px] rounded-b-[2px] border-0 p-0 outline-none",
                  duch && "box-border border-[1.5px] border-dashed border-[#a3a3a3] bg-black/[.02]",
                  dymek === i && "shadow-[0_0_0_2px_#fff,0_0_0_3.5px_#262626]",
                )}
                style={{
                  height: wysokosc(duch ? b.plan : b.done),
                  minHeight: b.done > 0 || duch ? 3 : 0,
                  // Bieżący okres ciemny, osiągnięty cel zielony, reszta jasna
                  background: duch ? undefined : b.trwa ? "#262626" : cel !== null && b.done >= cel ? "#15803d" : "rgba(0,0,0,.12)",
                }}
              />
            </div>
          );
        })}
        {dymek !== null && slupki[dymek] && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-10 box-border w-[190px] rounded-[8px] border border-border bg-white px-2.5 py-1.5 text-xs leading-[1.4] shadow-lg"
            style={{ left: `clamp(0px, calc(${((dymek + 0.5) / slupki.length) * 100}% - 95px), calc(100% - 190px))` }}
          >
            <div className="font-semibold">{slupki[dymek].label}</div>
            <div className="mt-0.5 text-muted-foreground tabular-nums">{slupki[dymek].opis}</div>
          </div>
        )}
      </div>
      <div className="mt-1.5 flex gap-2 text-center text-[11px] text-muted-foreground">
        {slupki.map((b) => (
          <span key={b.label} className="min-w-0 flex-1 truncate">
            {b.label}
          </span>
        ))}
      </div>
    </Card>
  );
}
