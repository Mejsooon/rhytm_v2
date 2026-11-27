"use client";

// Ekran „Sport” na telefonie wg MSport.dc.html: nagłówek z numerem tygodnia i „+”, segment Tydzień / Miesiąc,
// karta „Bieganie” (km / cel z paskiem tylko przy włączonym celu km), wykres km ze stuknięciem słupka,
// przyciski „Bieg”, „Trening” i „Szablony” oraz lista „Ostatnie”. „Trening” otwiera te same opcje co „+ Trening siłowy”
// na webie (Ruling): „Pusty trening”, szablony („Z szablonu”) i „Szablony treningów…”.
// *[Claude]* „Miesiąc” = 4 ostatnie tygodnie (ostatni = bieżący, jak w makiecie „t. 43–46”), cel = 4 × cel tygodnia.
// *[Claude]* Nad „Ostatnie” lista „Zaplanowane” (tylko gdy coś jest): plany biegów, niedokończone treningi
// i wystąpienia szablonów z bieżącego tygodnia — na telefonie nie ma kalendarza miesiąca, z którego by się je otwierało.
// `?wybrany=` z kalendarza głównego: poniżej 800 px trening jest przekazywany raz do onSelected (dymek jest tylko na webie).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";

import {
  ActionPopover,
  Button,
  Card,
  CardTitle,
  MENU_ITEM,
  MENU_LABEL,
  MENU_SEPARATOR,
  Progress,
  Segment,
} from "@/components/controls";
import { DNI_SKROT } from "@/features/calendar/mobile/pl";
import {
  addDays,
  isoWeekNumber,
  weekdayOf,
} from "@/features/calendar/view-range";
import type { GymSessionInput } from "../actions";
import type { RunRequest } from "../item-popover";
import type { SportMonthData } from "../load-sport";
import {
  formatDuration,
  formatKm,
  formatPace,
  plPlural,
  weekStats,
  type SportItem,
} from "../model";

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const WYSOKOSC_WYKRESU = 116; // px, najwyższy słupek
// Kolor paska km i słupków to dane z makiety CMSport (nie token UI)
const KOLOR_KM = "#f59e0b";
// Etykieta małej karty i wartość w trzech kolumnach karty „Bieganie” (.lbl, .num)
const ETYKIETA = "text-xs font-medium text-muted-foreground";
const LICZBA = "mt-0.5 text-[17px] font-semibold tabular-nums";
// Wiersz listy „Zaplanowane” / „Ostatnie”: m-row, ikona rodzaju 40 px i chevron (CMSport)
const WIERSZ =
  "m-row w-full cursor-pointer border-x-0 border-t-0 bg-transparent py-2.5 text-left text-sm text-foreground outline-none focus-visible:bg-panel";
const IKONA_WIERSZA =
  "flex size-10 flex-none items-center justify-center rounded-[10px]";
const IKONA_BIEGU = (
  <span className={`${IKONA_WIERSZA} bg-warning-soft text-warning-foreground`}>
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  </span>
);
const IKONA_SILOWNI = (
  <span className={`${IKONA_WIERSZA} bg-accent text-foreground`}>
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
    </svg>
  </span>
);
const STRZALKA = (
  <ChevronRight
    size={16}
    aria-hidden="true"
    className="flex-none text-faint-foreground"
  />
);

export function MSport({
  data,
  selectedKey = null,
  onNewRun,
  onNewGym,
  onOpenRun,
  onStartGym,
  onSelected,
}: {
  data: SportMonthData;
  // ?wybrany={klucz} z kalendarza głównego
  selectedKey?: string | null;
  onNewRun: () => void;
  // Trening siłowy: null = pusty, inaczej id szablonu (wystąpienie z dziś)
  onNewGym: (templateId: string | null) => void;
  onOpenRun: (req: RunRequest) => void;
  // Wystąpienie szablonu z „Zaplanowane” (jego dzień i godzina)
  onStartGym: (input: GymSessionInput) => void;
  // Trening z `?wybrany=` na telefonie (wywoływane raz na klucz)
  onSelected: (item: SportItem) => void;
}) {
  const { today, profile } = data;
  // Inne aktywności dojdą na telefon w pakiecie Telefon; tu nie mogą udawać biegu ani siłowni
  const items = data.items.filter((i) => i.kind !== "other");
  const [zakres, setZakres] = useState<"w" | "m">("w");
  const [slupek, setSlupek] = useState<number | null>(null);
  const [menuTreningu, setMenuTreningu] = useState(false);

  // `?wybrany=` obsłużony raz; ref zeruje się, gdy klucz zniknie z adresu (Next 16 Activity trzyma
  // ekran w pamięci, więc ten sam klucz przy kolejnym wejściu z kalendarza ma zadziałać znowu).
  const obsluzonyKlucz = useRef<string | null>(null);
  useEffect(() => {
    if (selectedKey === null) {
      obsluzonyKlucz.current = null;
      return;
    }
    if (obsluzonyKlucz.current === selectedKey) return;
    const telefon =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 799px)").matches;
    if (!telefon) return;
    const item = items.find((i) => i.key === selectedKey);
    // Klucza spoza danych nie ma czym otworzyć — adres czyści SportView
    if (!item) return;
    obsluzonyKlucz.current = selectedKey;
    onSelected(item);
  }, [selectedKey, items, onSelected]);

  // Bieżący tydzień od profiles.week_start; numer ISO ze środka tygodnia (jak WeekTiles)
  const dzien = weekdayOf(today);
  const biezacy = addDays(
    today,
    -(profile.weekStart === "mon" ? dzien - 1 : dzien % 7),
  );
  const koniecTygodnia = addDays(biezacy, 6);
  const dd = (d: string) => String(Number(d.slice(8, 10)));
  const mm = (d: string) => d.slice(5, 7);
  const zakresDat =
    mm(biezacy) === mm(koniecTygodnia)
      ? `${dd(biezacy)}–${dd(koniecTygodnia)}.${mm(koniecTygodnia)}`
      : `${dd(biezacy)}.${mm(biezacy)}–${dd(koniecTygodnia)}.${mm(koniecTygodnia)}`;
  const naglowek = `Tydzień ${isoWeekNumber(addDays(biezacy, 3))} · ${zakresDat}`;

  // Zakres karty: tydzień albo 4 ostatnie tygodnie
  const od = zakres === "w" ? biezacy : addDays(biezacy, -21);
  const wykonane = items.filter(
    (i) => !i.planned && i.date >= od && i.date <= koniecTygodnia,
  );
  let km = 0;
  let sekundy = 0;
  let biegi = 0;
  let silownia = 0;
  for (const i of wykonane) {
    if (i.kind === "gym") {
      silownia += 1;
      continue;
    }
    biegi += 1;
    // Tempo tylko z biegów z dystansem i czasem naraz (jak weekStats)
    if (i.distanceKm !== null && i.durationS !== null) {
      km += i.distanceKm;
      sekundy += i.durationS;
    }
  }
  const tempo = km > 0 ? formatPace(sekundy / km) : "—";
  const cel = zakres === "w" ? profile.weeklyKmGoal : profile.weeklyKmGoal * 4;

  // Słupki: dni tygodnia albo 4 tygodnie
  const slupki =
    zakres === "w"
      ? Array.from({ length: 7 }, (_, i) => {
          const data = addDays(biezacy, i);
          let suma = 0;
          for (const w of wykonane) {
            if (w.kind === "run" && w.date === data && w.durationS !== null)
              suma += w.distanceKm ?? 0;
          }
          return { etykieta: DNI_SKROT[weekdayOf(data)], km: suma };
        })
      : Array.from({ length: 4 }, (_, i) => {
          const poczatek = addDays(biezacy, (i - 3) * 7);
          return {
            etykieta: `t. ${isoWeekNumber(addDays(poczatek, 3))}`,
            km: weekStats(items, poczatek).km,
          };
        });
  const najwiecej = Math.max(0, ...slupki.map((s) => s.km)) || 1;

  const ostatnie = data.recent.filter((i) => i.kind !== "other").slice(0, 5);
  // Plany bieżącego tygodnia (items są posortowane wg daty i godziny)
  const zaplanowane = items.filter(
    (i) => i.planned && i.date >= biezacy && i.date <= koniecTygodnia,
  );

  return (
    <div className="flex flex-col">
      <header className="m-head py-1">
        <div className="min-w-0 flex-1">
          <div className={ETYKIETA}>{naglowek}</div>
          <h1 className="m-title">Sport</h1>
        </div>
        <Button
          variant="ghost"
          icon
          aria-label="Nowa aktywność"
          onClick={onNewRun}
        >
          <Plus size={20} aria-hidden="true" />
        </Button>
      </header>

      <div className="mx-4 mt-3 mb-2">
        <Segment
          ariaLabel="Zakres"
          value={zakres}
          onChange={(v) => {
            setZakres(v);
            setSlupek(null);
          }}
          options={[
            { value: "w", label: "Tydzień" },
            { value: "m", label: "Miesiąc" },
          ]}
        />
      </div>

      <div className="flex flex-col gap-4 px-4 pt-1 pb-6">
        <Card className="p-4" role="region" aria-labelledby="m-sport-bieganie">
          <div id="m-sport-bieganie" className={ETYKIETA}>
            Bieganie
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              data-testid="km"
              className="text-[34px] font-semibold tracking-[-0.02em] tabular-nums"
            >
              {formatKm(km)}
            </span>
            <span className="text-[13px] text-muted-foreground">
              {profile.kmGoalOn ? `/ ${cel} km` : "km"}
            </span>
          </div>
          {profile.kmGoalOn && (
            <Progress
              value={km}
              max={cel}
              ariaLabel="Postęp celu km"
              color={KOLOR_KM}
              className="mt-2.5"
            />
          )}
          <div className="mt-3.5 grid grid-cols-3 border-t border-border pt-3">
            <div>
              <div className={ETYKIETA}>Biegi</div>
              <div data-testid="biegi" className={LICZBA}>
                {biegi}
              </div>
            </div>
            <div>
              <div className={ETYKIETA}>Śr. tempo</div>
              <div data-testid="tempo" className={LICZBA}>
                {tempo}
              </div>
            </div>
            <div>
              <div className={ETYKIETA}>Siłownia</div>
              <div
                data-testid="silownia"
                className={LICZBA}
              >{`${silownia}×`}</div>
            </div>
          </div>
        </Card>

        <Card
          className="p-3.5"
          role="region"
          aria-labelledby="m-sport-kilometry"
        >
          <div className="flex items-baseline justify-between">
            <CardTitle as="h2" id="m-sport-kilometry" className="text-[15px]">
              Kilometry
            </CardTitle>
            <span className="text-xs text-muted-foreground tabular-nums">
              {slupek === null
                ? "stuknij słupek"
                : `${slupki[slupek].etykieta} · ${formatKm(slupki[slupek].km)} km`}
            </span>
          </div>
          <div
            // Odstęp między słupkami jest w przyciskach (padding), żeby pole stuknięcia miało ≥ 44 px
            className="-mx-[5px] mt-3 flex h-[120px] items-end border-b border-border"
          >
            {slupki.map((s, k) => (
              // Przycisk na całą wysokość wykresu, żeby dało się trafić także w niski słupek
              <button
                key={s.etykieta}
                type="button"
                aria-label={`${s.etykieta}: ${formatKm(s.km)} km`}
                aria-pressed={slupek === k}
                onClick={() => setSlupek(k)}
                className={`flex h-full min-w-0 flex-1 cursor-pointer items-end border-0 bg-transparent py-0 outline-none focus-visible:ring-2 focus-visible:ring-ring ${zakres === "w" ? "px-[5px]" : "px-3"}`}
              >
                <span
                  className="block w-full rounded-t-[6px]"
                  style={{
                    height: Math.max(
                      4,
                      Math.round((s.km / najwiecej) * WYSOKOSC_WYKRESU),
                    ),
                    background:
                      slupek === k
                        ? "var(--primary)"
                        : s.km
                          ? KOLOR_KM
                          : "rgba(0,0,0,.08)",
                  }}
                />
              </button>
            ))}
          </div>
          <div className="-mx-[5px] mt-1.5 flex text-xs text-muted-foreground tabular-nums">
            {slupki.map((s) => (
              <span key={s.etykieta} className="flex-1 text-center">
                {s.etykieta}
              </span>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="primary" onClick={onNewRun}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12h4l3-8 4 16 3-8h4" />
            </svg>
            Bieg
          </Button>
          <ActionPopover
            open={menuTreningu}
            onOpenChange={setMenuTreningu}
            align="end"
            side="top"
            width={260}
            ariaLabel="Nowy trening"
            trigger={
              <Button>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 7v10M18 7v10M3 10v4M21 10v4M6 12h12" />
                </svg>
                Trening
              </Button>
            }
          >
            <div className="flex flex-col gap-px">
              <button
                type="button"
                className={MENU_ITEM}
                onClick={() => {
                  setMenuTreningu(false);
                  onNewGym(null);
                }}
              >
                Pusty trening
              </button>
              {data.templates.length > 0 && (
                <>
                  <div className={`${MENU_SEPARATOR} mt-1`} />
                  <div className={MENU_LABEL}>Z szablonu</div>
                  {data.templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={MENU_ITEM}
                      onClick={() => {
                        setMenuTreningu(false);
                        onNewGym(t.id);
                      }}
                    >
                      {t.name}
                    </button>
                  ))}
                </>
              )}
              <div className={MENU_SEPARATOR} />
              <Link
                href="/sport/szablony"
                className={MENU_ITEM}
                onClick={() => setMenuTreningu(false)}
              >
                Szablony treningów…
              </Link>
            </div>
          </ActionPopover>
          <Button asChild className="col-span-2">
            <Link href="/sport/szablony">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M4 6h16M4 12h16M4 18h10" />
              </svg>
              Szablony
            </Link>
          </Button>
        </div>

        {zaplanowane.length > 0 && (
          <section aria-labelledby="m-sport-zaplanowane">
            <CardTitle
              as="h2"
              id="m-sport-zaplanowane"
              className="mb-2 text-[15px]"
            >
              Zaplanowane
            </CardTitle>
            <Card className="overflow-hidden">
              {zaplanowane.map((item) => {
                const godzina = `${String(Math.floor(item.startMin / 60)).padStart(2, "0")}:${String(item.startMin % 60).padStart(2, "0")}`;
                const kiedy = `${DNI[weekdayOf(item.date)]} ${item.date.slice(8, 10)}.${item.date.slice(5, 7)} · ${godzina}`;
                if (item.kind === "run") {
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        item.sessionId &&
                        onOpenRun({ sessionId: item.sessionId })
                      }
                      className={WIERSZ}
                    >
                      {IKONA_BIEGU}
                      <span className="min-w-0 flex-1">
                        <span className="block font-medium">
                          {item.distanceKm !== null
                            ? `${item.title} · ${formatKm(item.distanceKm)} km`
                            : item.title}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {kiedy}
                        </span>
                      </span>
                      {STRZALKA}
                    </button>
                  );
                }
                const tresc = (
                  <>
                    {IKONA_SILOWNI}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{`Siłownia — ${item.title}`}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {kiedy}
                      </span>
                    </span>
                    {STRZALKA}
                  </>
                );
                // Niedokończony trening — jego ekran; wystąpienie szablonu — rozpoczęcie w jego dniu
                return item.sessionId ? (
                  <Link
                    key={item.key}
                    href={`/sport/trening/${item.sessionId}`}
                    className="m-row py-2.5"
                  >
                    {tresc}
                  </Link>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      onStartGym({
                        date: item.date,
                        start: godzina,
                        templateId: item.templateId ?? undefined,
                      })
                    }
                    className={WIERSZ}
                  >
                    {tresc}
                  </button>
                );
              })}
            </Card>
          </section>
        )}

        <section aria-labelledby="m-sport-ostatnie">
          <CardTitle as="h2" id="m-sport-ostatnie" className="mb-2 text-[15px]">
            Ostatnie
          </CardTitle>
          <Card className="overflow-hidden">
            {ostatnie.length === 0 && (
              <p className="m-0 px-3.5 py-4 text-sm text-muted-foreground">
                Brak wykonanych treningów.
              </p>
            )}
            {ostatnie.map((item) => {
              const kiedy = `${DNI[weekdayOf(item.date)]} ${item.date.slice(8, 10)}.${item.date.slice(5, 7)}`;
              if (item.kind === "run") {
                const kmBiegu = item.distanceKm ?? 0;
                const opis = [kiedy];
                if (item.durationS !== null)
                  opis.push(formatDuration(item.durationS));
                if (kmBiegu > 0 && item.durationS !== null)
                  opis.push(`${formatPace(item.durationS / kmBiegu)}/km`);
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      item.sessionId && onOpenRun({ sessionId: item.sessionId })
                    }
                    className={WIERSZ}
                  >
                    {IKONA_BIEGU}
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium">{`${item.title} · ${formatKm(kmBiegu)} km`}</span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {opis.join(" · ")}
                      </span>
                    </span>
                    {STRZALKA}
                  </button>
                );
              }
              const serie =
                data.setsHistory.find((s) => s.sessionId === item.sessionId)
                  ?.sets ?? [];
              const cwiczen = new Set(serie.map((s) => s.exercise_id)).size;
              return (
                <Link
                  key={item.key}
                  href={`/sport/trening/${item.sessionId}`}
                  className="m-row py-2.5"
                >
                  {IKONA_SILOWNI}
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{`Siłownia — ${item.title}`}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {`${kiedy} · ${plPlural(cwiczen, "ćwiczenie", "ćwiczenia", "ćwiczeń")} · ${item.durationMin} min`}
                    </span>
                  </span>
                  {STRZALKA}
                </Link>
              );
            })}
          </Card>
        </section>
      </div>
    </div>
  );
}
