"use client";

// Edytor szablonu treningu (WorkoutTemplates.dc.html, widok edycji): ścieżka „Sport / Szablony treningów /
// Nowy szablon | Edycja: X”, nazwa, chipy dni pn–nd z godziną startu (tylko przy wybranych dniach),
// tabela ćwiczeń (serie −/+, powt., przerwa „m:ss”, ↑ ↓ ✕), „+ Ćwiczenie”, Zapisz / Anuluj / Usuń.
// Okno czeka na serwer: przyciski są zablokowane w trakcie, a błąd zostaje na ekranie.
// Jedno drzewo dla webu i telefonu (CMWorkoutTemplates, arkusz „Nowy szablon”): poniżej 800 px nagłówek .m-head
// ze strzałką do listy i „Zapisz”, dni tygodnia jako siatka 7 chipów, tabela ćwiczeń przewija się poziomo.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  ChevronDownIcon,
  ChevronUpIcon,
  DumbbellIcon,
  MinusIcon,
  PlusIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";

import { ModuleHeader } from "@/components/shell/module-header";
import { SidebarToggle } from "@/components/shell/sidebar-toggle";
import {
  Button,
  FIELD,
  StatusBadge,
  TextField,
  TimePicker,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { deleteTemplate, saveTemplate } from "./actions";
import { ExercisePicker } from "./exercise-picker";
import type { SportProfile, TemplateWithItems } from "./load-sport";
import { formatRest, parseRest, plPlural, type ExerciseRow } from "./model";

export type TemplateEditorData = {
  profile: SportProfile;
  exercises: ExerciseRow[];
  template: TemplateWithItems | null; // null = nowy szablon
};

type Wiersz = {
  key: string;
  name: string;
  sets: number;
  reps: string;
  rest: string; // "m:ss" wpisywane ręcznie
};

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const DNI = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"]; // indeks + 1 = dzień w weekdays
const DOMYSLNA_GODZINA = "17:00";
// Wiersz tabeli jak .exrow z makiety: 32 / 1fr / 126 / 96 / 96 / 108 px, odstęp 10 px
const SIATKA =
  "grid grid-cols-[32px_minmax(0,1fr)_126px_96px_96px_108px] items-center gap-2.5 max-[799px]:grid-cols-[32px_minmax(140px,1fr)_160px_96px_96px_148px]";
// Pole powtórzeń i przerwy: .inp 30 px (na telefonie 44 px z FIELD)
const POLE = cn(FIELD, "h-[30px] tabular-nums");
// Przycisk ikony .btng.ic.sm (28 px, na telefonie 44 px), fokus w środku przycisku
const IKONA =
  "max-[799px]:size-11 focus-visible:shadow-focus-inset aria-disabled:opacity-35";
// Przycisk serii w jednej ramce: bez własnej ramki i promienia, z linią oddzielającą
const SERIA = cn(IKONA, "rounded-none border-0 border-black/[.08]");

// Stan formularza z szablonu (albo pusty dla nowego)
function stanPoczatkowy(template: TemplateWithItems | null) {
  return {
    name: template?.name ?? "",
    days: template ? [...template.weekdays] : [],
    startTime: template ? template.start_time.slice(0, 5) : DOMYSLNA_GODZINA,
    rows: (template?.items ?? []).map(
      (i): Wiersz => ({
        key: i.id,
        name: i.exerciseName,
        sets: i.sets_count,
        reps: i.reps_text,
        rest: formatRest(i.rest_s),
      }),
    ),
  };
}

export function TemplateEditor({ data }: { data: TemplateEditorData }) {
  const router = useRouter();
  const { template, profile } = data;

  const [form, setForm] = useState(() => stanPoczatkowy(template));
  const [tried, setTried] = useState(false);
  const [zapisuje, setZapisuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const licznik = useRef(0);

  // Next 16 Activity zachowuje stan trasy: nowe dane z serwera (ponowne wejście) zaczynają formularz od nowa
  const [zrodlo, setZrodlo] = useState(data);
  if (data !== zrodlo) {
    setZrodlo(data);
    setForm(stanPoczatkowy(template));
    setTried(false);
    setZapisuje(false);
    setBlad(null);
  }

  const { name, days, startTime, rows } = form;
  const nazwa = name.trim();
  const valid = nazwa !== "" && rows.length > 0;
  const serie = rows.reduce((a, r) => a + r.sets, 0);
  const meta = `${plPlural(rows.length, "ćwiczenie", "ćwiczenia", "ćwiczeń")} · ${plPlural(serie, "seria", "serie", "serii")}`;
  const zlaPrzerwa = rows.some((r) => parseRest(r.rest) === null);
  const crumb = template ? `Edycja: ${nazwa || "bez nazwy"}` : "Nowy szablon";

  function zmienWiersz(i: number, patch: Partial<Wiersz>) {
    setForm((f) => ({
      ...f,
      rows: f.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));
  }

  function przesun(i: number, kierunek: -1 | 1) {
    const j = i + kierunek;
    if (j < 0 || j >= rows.length) return;
    setForm((f) => {
      const nowe = [...f.rows];
      [nowe[i], nowe[j]] = [nowe[j], nowe[i]];
      return { ...f, rows: nowe };
    });
  }

  async function zapisz() {
    if (zapisuje) return;
    if (!valid || zlaPrzerwa) {
      setTried(true);
      return;
    }
    setZapisuje(true);
    setBlad(null);
    try {
      const wynik = await saveTemplate({
        ...(template ? { id: template.id } : {}),
        name: nazwa,
        weekdays: [...days].sort((a, b) => a - b),
        startTime,
        items: rows.map((r) => ({
          exerciseName: r.name,
          setsCount: r.sets,
          repsText: r.reps.trim(),
          restS: parseRest(r.rest) as number,
        })),
      });
      if (wynik.ok) {
        router.push(
          `/sport/szablony?komunikat=${template ? "zapisano" : "dodano"}&nazwa=${encodeURIComponent(nazwa)}`,
        );
        return;
      }
      setBlad(wynik.message);
    } catch {
      setBlad(BLAD_ZAPISU);
    }
    setZapisuje(false);
  }

  async function usun() {
    if (!template || zapisuje) return;
    setZapisuje(true);
    setBlad(null);
    try {
      const wynik = await deleteTemplate(template.id);
      if (wynik.ok) {
        router.push(
          `/sport/szablony?komunikat=usunieto&nazwa=${encodeURIComponent(template.name)}`,
        );
        return;
      }
      setBlad(wynik.message);
    } catch {
      setBlad(BLAD_ZAPISU);
    }
    setZapisuje(false);
  }

  // „Zapisz szablon” jak w makiecie: aria-disabled bez nazwy lub ćwiczeń, klik pokazuje „Podaj nazwę.”
  const przyciskZapisz = (
    <Button
      variant="primary"
      aria-disabled={valid ? "false" : "true"}
      disabled={zapisuje}
      onClick={() => void zapisz()}
    >
      Zapisz szablon
    </Button>
  );
  const przyciskAnuluj = (
    <Button asChild variant="ghost">
      <Link href="/sport/szablony">Anuluj</Link>
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col">
      {/* Telefon: .m-head — wstecz do listy szablonów, tytuł na środku, „Zapisz” (jak „Zapisz szablon” na webie) */}
      <ModuleHeader
        title={template ? "Edytuj szablon" : "Nowy szablon"}
        phoneOnly
        phoneCenterTitle
        phoneBack={{ href: "/sport/szablony", label: "Wstecz" }}
        phoneActions={
          <Button
            variant="primary"
            aria-disabled={valid ? "false" : "true"}
            disabled={zapisuje}
            onClick={() => void zapisz()}
          >
            Zapisz
          </Button>
        }
      />
      {/* .topbar z okruszkami .crumb (CWorkoutTemplates) */}
      <header className="box-content flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-2.5 max-[799px]:hidden">
        <nav
          aria-label="Okruszki"
          className="flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground"
        >
          {/* Przy schowanym pasku: przycisk „Pokaż pasek boczny” przed okruszkami */}
          <SidebarToggle placement="header" />
          <Link
            href="/sport"
            className="text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:shadow-focus max-[799px]:inline-flex max-[799px]:min-h-11 max-[799px]:items-center"
          >
            Sport
          </Link>
          <span aria-hidden="true">/</span>
          {/* „Szablony treningów” jak mały przycisk ghost z makiety */}
          <Button
            asChild
            variant="ghost"
            size="xs"
            className="-ml-[7px] text-sm font-normal text-muted-foreground hover:text-foreground max-[799px]:h-11"
          >
            <Link href="/sport/szablony">Szablony treningów</Link>
          </Button>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-foreground">{crumb}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {przyciskAnuluj}
          {przyciskZapisz}
        </div>
      </header>

      <div className="box-border flex w-full flex-col gap-6 px-6 py-7 max-[799px]:gap-3.5 max-[799px]:px-4 max-[799px]:pt-4 max-[799px]:pb-6">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em] max-[799px]:hidden">
            {template ? "Edytuj szablon" : "Nowy szablon"}
          </h1>
          <p className="m-0 mt-1.5 text-[13px] text-muted-foreground tabular-nums max-[799px]:mt-0 max-[799px]:text-xs">
            {meta}
          </p>
        </div>

        {/* .card z coss.css (jak Card): pola, tabela ćwiczeń i stopka .foot */}
        <section className="relative flex flex-col rounded-xl border border-border bg-white bg-clip-padding shadow-card">
          <div className="grid grid-cols-2 gap-4 border-b border-black/[.08] px-6 py-5 max-[799px]:grid-cols-1 max-[799px]:px-[18px]">
            <TextField
              label="Nazwa szablonu"
              type="text"
              value={name}
              maxLength={60}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Np. Push, Full body A"
              error={tried && nazwa === "" ? "Podaj nazwę." : undefined}
            />
            <div className="flex flex-col gap-1.5 text-[13px] font-medium">
              <span>
                Dni tygodnia{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  (opcjonalnie — pojawi się w kalendarzu Sport)
                </span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Tor .seg: szare tło, wybrany dzień to biała pigułka z cieniem (wielokrotny wybór, aria-pressed) */}
                <div
                  role="group"
                  aria-label="Dni tygodnia"
                  className="inline-flex max-w-full flex-wrap gap-0.5 rounded-md bg-muted p-0.5 font-normal max-[799px]:grid max-[799px]:w-full max-[799px]:grid-cols-7"
                >
                  {DNI.map((etykieta, i) => {
                    const dzien = i + 1;
                    const wlaczony = days.includes(dzien);
                    return (
                      <button
                        key={etykieta}
                        type="button"
                        aria-pressed={wlaczony}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            days: wlaczony
                              ? f.days.filter((d) => d !== dzien)
                              : [...f.days, dzien],
                          }))
                        }
                        className={cn(
                          "inline-flex h-7 w-9 cursor-pointer items-center justify-center rounded-[8px] border-0 px-0 text-sm font-medium whitespace-nowrap outline-none focus-visible:shadow-focus max-[799px]:h-11 max-[799px]:w-full",
                          wlaczony
                            ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.05)]"
                            : "bg-transparent text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {etykieta}
                      </button>
                    );
                  })}
                </div>
                {/* Godzina startu ma sens tylko, gdy szablon sam planuje treningi */}
                {days.length > 0 && (
                  <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
                    o
                    <TimePicker
                      value={startTime}
                      onChange={(v) => setForm((f) => ({ ...f, startTime: v }))}
                      ariaLabel="Godzina startu"
                      clock={profile.clock}
                    />
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col px-6 pt-2 pb-5 max-[799px]:px-[18px]">
            <div className="max-[799px]:-mx-[18px] max-[799px]:overflow-x-auto max-[799px]:px-[18px]">
              <div
                className={cn(
                  SIATKA,
                  "py-2 text-xs font-medium text-muted-foreground",
                )}
              >
                <span>#</span>
                <span>Ćwiczenie</span>
                <span>Serie</span>
                <span>Powt.</span>
                <span>Przerwa</span>
                <span />
              </div>
              {rows.map((r, i) => {
                const pierwszy = i === 0;
                const ostatni = i === rows.length - 1;
                const zla = tried && parseRest(r.rest) === null;
                return (
                  <div
                    key={r.key}
                    data-testid="wiersz-cwiczenia"
                    data-name={r.name}
                    className={cn(SIATKA, "border-b border-black/[.06] py-2")}
                  >
                    <StatusBadge tone="gray" className="w-[22px] tabular-nums">
                      {i + 1}
                    </StatusBadge>
                    <span className="min-w-0 truncate font-medium">
                      {r.name}
                    </span>
                    {/* Serie −/+ w jednej ramce (30 px) jak w makiecie */}
                    <span
                      data-testid="stepper-serii"
                      className="inline-flex h-[30px] max-[799px]:h-11 items-center justify-self-start overflow-hidden rounded-md border border-input bg-white shadow-xs"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        icon
                        className={cn(SERIA, "border-r")}
                        aria-label={`${r.name}: mniej serii`}
                        onClick={() =>
                          zmienWiersz(i, { sets: Math.max(1, r.sets - 1) })
                        }
                      >
                        <MinusIcon aria-hidden="true" className="size-3.5" />
                      </Button>
                      <span
                        data-testid={`serie-${r.name}`}
                        className="w-[30px] text-center font-semibold tabular-nums"
                      >
                        {r.sets}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon
                        className={cn(SERIA, "border-l")}
                        aria-label={`${r.name}: więcej serii`}
                        onClick={() =>
                          zmienWiersz(i, { sets: Math.min(10, r.sets + 1) })
                        }
                      >
                        <PlusIcon aria-hidden="true" className="size-3.5" />
                      </Button>
                    </span>
                    <input
                      type="text"
                      value={r.reps}
                      maxLength={20}
                      onChange={(e) => zmienWiersz(i, { reps: e.target.value })}
                      aria-label={`${r.name}: powtórzenia`}
                      className={POLE}
                    />
                    <input
                      type="text"
                      value={r.rest}
                      onChange={(e) => zmienWiersz(i, { rest: e.target.value })}
                      aria-label={`${r.name}: przerwa`}
                      aria-invalid={zla ? true : undefined}
                      className={POLE}
                    />
                    <span className="inline-flex justify-end gap-0.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon
                        className={IKONA}
                        aria-label={`Przesuń ${r.name} w górę`}
                        aria-disabled={pierwszy ? "true" : "false"}
                        onClick={() => przesun(i, -1)}
                      >
                        <ChevronUpIcon
                          aria-hidden="true"
                          className="size-3.5"
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon
                        className={IKONA}
                        aria-label={`Przesuń ${r.name} w dół`}
                        aria-disabled={ostatni ? "true" : "false"}
                        onClick={() => przesun(i, 1)}
                      >
                        <ChevronDownIcon
                          aria-hidden="true"
                          className="size-3.5"
                        />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon
                        className={cn(
                          IKONA,
                          "text-destructive-foreground hover:text-destructive-foreground",
                        )}
                        aria-label={`Usuń ${r.name}`}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            rows: f.rows.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        <XIcon aria-hidden="true" className="size-3.5" />
                      </Button>
                    </span>
                  </div>
                );
              })}
            </div>
            {rows.length === 0 && (
              // .empty z ikoną w ramce (tekst bez zmian)
              <div className="flex flex-col items-center gap-2 p-5 text-center">
                <span className="grid size-10 place-items-center rounded-md border border-border bg-white text-muted-foreground shadow-xs">
                  <DumbbellIcon aria-hidden="true" className="size-4" />
                </span>
                <p className="m-0 text-sm text-muted-foreground">
                  Brak ćwiczeń — dodaj pierwsze poniżej.
                </p>
              </div>
            )}
            {tried && zlaPrzerwa && (
              <p className="m-0 pt-2 text-xs text-destructive-foreground">
                Przerwa w formacie m:ss, np. 2:00.
              </p>
            )}
            <div className="mt-3.5 self-start">
              <ExercisePicker
                exercises={data.exercises}
                excludeNames={rows.map((r) => r.name)}
                side="bottom"
                onPick={(nazwaCwiczenia) => {
                  licznik.current += 1;
                  setForm((f) => ({
                    ...f,
                    rows: [
                      ...f.rows,
                      {
                        key: `nowe-${licznik.current}`,
                        name: nazwaCwiczenia,
                        sets: 3,
                        reps: "8–10",
                        rest: "2:00",
                      },
                    ],
                  }));
                }}
              />
            </div>
            {blad && (
              <p
                role="alert"
                className="m-0 pt-3 text-[13px] text-destructive-foreground"
              >
                {blad}
              </p>
            )}
          </div>

          {/* .foot: Zapisz / Anuluj po lewej, „Usuń szablon” (.btndo) po prawej */}
          <div
            data-testid="stopka-szablonu"
            className={cn(
              "flex flex-wrap items-center justify-between gap-2.5 rounded-b-[15px] border-t border-border bg-black/[.025] px-6 py-3.5 max-[799px]:px-[18px]",
              // Telefon: Zapisz jest w nagłówku, więc stopka zostaje tylko z „Usuń szablon”
              !template && "max-[799px]:hidden",
            )}
          >
            <div className="flex gap-2 max-[799px]:hidden">
              {przyciskZapisz}
              {przyciskAnuluj}
            </div>
            {template && (
              <Button
                variant="destructive-outline"
                className="max-[799px]:w-full"
                disabled={zapisuje}
                onClick={() => void usun()}
              >
                <Trash2Icon aria-hidden="true" className="size-4" />
                Usuń szablon
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
