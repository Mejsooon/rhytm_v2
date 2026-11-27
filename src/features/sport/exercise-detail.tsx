"use client";

// Szczegóły ćwiczenia (S2ExerciseDetail): liczby z wybranego zakresu, wykres z dymkiem, rozwijana historia,
// „Następny trening” z celem i rekordy. Ćwiczenia na czas i dystans mają ten sam układ z innymi liczbami.
// Web: powyżej 800 px. Telefon: poniżej 800 px osobny układ z CMExerciseDetail (mobile/m-exercise-detail.tsx)
// na tych samych danych; oba drzewa są w DOM, przełącza je CSS.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronRight, PencilIcon } from "lucide-react";

import { Button, Card, CardTitle, FormDialog, Segment, StatusBadge, Switch, TextField } from "@/components/controls";
import { addDays, isoWeekNumber, weekdayOf } from "@/features/calendar/view-range";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import { createGymSession, renameExercise, setExerciseBodyweight } from "./actions";
import { ExerciseChart } from "./exercise-chart";
import { exerciseRecords, exerciseSessions, metrics, nextGoal, type ExerciseSession } from "./exercise-stats";
import { exerciseCatalog } from "./gym-dialogs";
import { MExerciseDetail } from "./mobile/m-exercise-detail";
import type { ExerciseData } from "./load-sport";
import {
  EXERCISE_KINDS,
  formatDuration,
  formatKg,
  formatSet,
  formatVolume,
  isBodyweightKind,
  kindOf,
  plPlural,
  setLabels,
  type ExerciseKind,
  type GymSetRow,
} from "./model";

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const DNI_8_TYG = 56;
// Wiersz historii jak .hrow z makiety
const WIERSZ = "grid grid-cols-[88px_minmax(0,1fr)_88px_88px_64px_16px] items-center gap-3 px-6 whitespace-nowrap";

// 82.5 -> "82,5", 72 -> "72,0" (jak `kg` w makiecie)
const kg = (v: number) => v.toFixed(1).replace(".", ",");

export function ExerciseDetail({ data }: { data: ExerciseData }) {
  const router = useRouter();
  const { exercise, today, profile } = data;
  const [zakres, setZakres] = useState<"8t" | "all">("8t");
  const [miara, setMiara] = useState(0);
  const [otwarta, setOtwarta] = useState<string | null>(null);
  const [wszystkie, setWszystkie] = useState(false);
  const [startuje, setStartuje] = useState(false);
  const [dialogOtwarty, setDialogOtwarty] = useState(false);
  const [nazwa, setNazwa] = useState(exercise.name);
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisuje, setZapisuje] = useState(false);

  // „Z masą ciała” optymistycznie: przełącznik zmienia się od razu, błąd go cofa.
  // Nowe dane z serwera (inna wartość flagi) stają się nowym stanem (wzór z use-gym-store).
  const rodzajSerwera = kindOf(exercise);
  const flaga = isBodyweightKind(rodzajSerwera);
  const [zMasaCiala, setZMasaCiala] = useState(flaga);
  const zapisujeMase = useRef(false);
  const [flagaSerwera, setFlagaSerwera] = useState(flaga);
  if (flagaSerwera !== flaga) {
    setFlagaSerwera(flaga);
    setZMasaCiala(flaga);
  }
  const rodzaj: ExerciseKind = zMasaCiala === flaga ? rodzajSerwera : zMasaCiala ? "wbw" : "wr";
  const zCiezarem = rodzaj !== "dur" && rodzaj !== "dist";

  const wszystkieSesje = exerciseSessions(data.history, exercise.id, rodzaj, profile.weightKg);
  const wiersze = [...wszystkieSesje].reverse();
  const wZakresie = zakres === "all" ? wszystkieSesje : wszystkieSesje.filter((s) => s.day > addDays(today, -DNI_8_TYG));

  const rokDzis = today.slice(0, 4);
  const dataPelna = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
  const etykietaDnia = (dzien: string) => {
    const [rok, mm, dd] = dzien.split("-");
    return `${DNI[weekdayOf(dzien)]} ${dd}.${mm}${rok === rokDzis ? "" : `.${rok}`}`;
  };
  const seriaTxt = (s: GymSetRow) => formatSet(s, rodzaj) ?? "—";
  // Najlepsza seria sesji: ta z najlepszym szac. 1RM, bez ciężaru ta z największą liczbą powtórzeń
  const najlepszaSeria = (s: ExerciseSession) => s.best ?? s.mostReps ?? s.working[0] ?? s.sets[0];

  // Wykres
  const dostepne = metrics(rodzaj);
  const m = dostepne[Math.min(miara, dostepne.length - 1)];
  const punkty = wZakresie.flatMap((s) => {
    const v = m.value(s);
    if (v === null) return [];
    const bezSerii = m.key === "volume" || m.key.startsWith("total");
    return [
      {
        id: s.id,
        label: `${s.day.slice(8, 10)}.${s.day.slice(5, 7)}`,
        date: `${DNI[weekdayOf(s.day)]} ${dataPelna(s.day)}`,
        value: v,
        detail: bezSerii ? plPlural(s.sets.length, "seria", "serie", "serii") : `najlepsza seria ${seriaTxt(najlepszaSeria(s))}`,
      },
    ];
  });
  const ostatni = punkty.at(-1)?.value ?? null;
  const roznica = ostatni === null || punkty.length < 2 ? null : ostatni - punkty[0].value;
  const wZakresieTxt = zakres === "8t" ? "w 8 tyg." : "od początku";
  const zeZnakiem = (v: number, format: (x: number) => string) => `${v >= 0 ? "+" : "−"}${format(Math.abs(v))}`;

  // Cztery liczby z wybranego zakresu
  const serie = wZakresie.reduce((a, s) => a + s.working.length, 0);
  const liczbaTreningow = wZakresie.length;
  const naTrening = (v: number) => (liczbaTreningow ? v / liczbaTreningow : 0);
  const suma = (f: (s: ExerciseSession) => number) => wZakresie.reduce((a, s) => a + f(s), 0);
  const glowna = dostepne[0];
  const glowne = wZakresie.map(glowna.value).filter((v): v is number => v !== null);
  const glownaWartosc = zCiezarem ? glowne.at(-1) : glowne.length ? Math.max(...glowne) : undefined;
  const zmianaGlownej = zCiezarem && glowne.length > 1 ? glowne[glowne.length - 1] - glowne[0] : null;
  const razem =
    rodzaj === "dur"
      ? { k: "Łączny czas", v: formatDuration(suma((s) => s.totalS)), sub: `${formatDuration(Math.round(naTrening(suma((s) => s.totalS))))} na trening` }
      : rodzaj === "dist"
        ? { k: "Łączny dystans", v: `${formatKg(Math.round(suma((s) => s.totalKm) * 100) / 100)} km`, sub: `${formatKg(Math.round(naTrening(suma((s) => s.totalKm)) * 100) / 100)} km na trening` }
        : {
            k: "Objętość",
            v: suma((s) => s.volume) >= 1000 ? `${kg(suma((s) => s.volume) / 1000)} t` : `${formatVolume(suma((s) => s.volume))} kg`,
            sub: `${formatVolume(Math.round(naTrening(suma((s) => s.volume))))} kg na trening`,
          };
  const liczby = [
    {
      k: glowna.label,
      v: glownaWartosc === undefined ? "—" : glowna.format(glownaWartosc),
      sub: zmianaGlownej === null ? wZakresieTxt : `${zeZnakiem(zmianaGlownej, glowna.format)} ${wZakresieTxt}`,
      tone: zmianaGlownej !== null && zmianaGlownej > 0 ? "text-success" : "",
    },
    {
      k: "Treningi",
      v: String(liczbaTreningow),
      sub: zakres === "8t" ? `ok. ${formatKg(Math.round((liczbaTreningow / 8) * 10) / 10)} w tygodniu` : wszystkieSesje[0] ? `od ${dataPelna(wszystkieSesje[0].day)}` : "—",
      tone: "",
    },
    { k: zCiezarem ? "Serie robocze" : "Serie", v: String(serie), sub: `${formatKg(Math.round(naTrening(serie) * 10) / 10)} na trening`, tone: "" },
    { ...razem, tone: "" },
  ];

  const rekordy = exerciseRecords(wszystkieSesje, rodzaj);
  const cel = nextGoal(wszystkieSesje.at(-1), data.repsText, rodzaj);
  const meta = exerciseCatalog([exercise]).find((x) => x.id === exercise.id);
  const podtytul = [
    meta?.group,
    meta?.equipment,
    wszystkieSesje.length
      ? `${plPlural(wszystkieSesje.length, "trening", "treningi", "treningów")} od ${dataPelna(wszystkieSesje[0].day)}`
      : "Brak treningów",
    data.templateName ? `w szablonie „${data.templateName}”` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const nastepny = data.next;
  async function rozpocznij() {
    if (!nastepny?.templateId || startuje) return;
    setStartuje(true);
    try {
      const wynik = await createGymSession({
        date: nastepny.date,
        start: `${String(Math.floor(nastepny.startMin / 60)).padStart(2, "0")}:${String(nastepny.startMin % 60).padStart(2, "0")}`,
        templateId: nastepny.templateId,
      });
      if (wynik.ok && wynik.id) {
        router.push(`/sport/trening/${wynik.id}`);
        return;
      }
      toast.error(wynik.ok ? BLAD_ZAPISU : wynik.message);
    } catch {
      toast.error(BLAD_ZAPISU);
    }
    setStartuje(false);
  }

  async function przelaczMaseCiala(nowa: boolean) {
    // Kolejne kliknięcia w trakcie zapisu ignorujemy, żeby cofnięcie po błędzie nie trafiło w zły stan
    if (zapisujeMase.current) return;
    zapisujeMase.current = true;
    setZMasaCiala(nowa);
    let ok = false;
    try {
      const wynik = await setExerciseBodyweight(exercise.id, nowa);
      ok = wynik.ok;
    } catch {
      ok = false;
    }
    zapisujeMase.current = false;
    if (ok) {
      router.refresh();
      return;
    }
    setZMasaCiala(!nowa);
    toast.error(BLAD_ZAPISU);
  }

  async function zapisz() {
    setZapisuje(true);
    setBlad(null);
    try {
      const wynik = await renameExercise(exercise.id, nazwa);
      if (wynik.ok) {
        setDialogOtwarty(false);
        router.refresh();
      } else {
        setBlad(wynik.message);
      }
    } catch {
      setBlad(BLAD_ZAPISU);
    }
    setZapisuje(false);
  }

  const sesje = wszystkieSesje.map((s) => {
    const naj = najlepszaSeria(s);
    return {
      id: s.id,
      dzien: s.day,
      v: s.rm,
      seriaTel: `${formatKg(naj.weight_kg, zMasaCiala)}${zMasaCiala ? "" : " kg"} × ${naj.reps ?? "—"}`,
      komplet: s.sets.map((x) => (zCiezarem ? `${formatKg(x.weight_kg, zMasaCiala)}×${x.reps}` : seriaTxt(x))).join(" · "),
      objetosc: s.volume,
      rekord: s.record,
    };
  });
  const najlepszy1rm = sesje.reduce<number | null>((a, s) => (s.v !== null && (a === null || s.v > a) ? s.v : a), null);
  const najciezsza = wszystkieSesje.reduce<ExerciseSession["heaviest"]>((a, s) => (s.heaviest && (!a || s.heaviest.kg > a.kg) ? s.heaviest : a), null);
  const najwiecejPowt = wszystkieSesje.reduce<GymSetRow | null>((a, s) => (s.mostReps && (!a || (s.mostReps.reps as number) > (a.reps as number)) ? s.mostReps : a), null);
  // Zmiana 8 tyg.: najlepszy 1RM z ostatnich 8 tygodni − najlepszy z 8 tygodni wcześniej
  const najlepszyMiedzy = (od: string, doDnia: string) => {
    const l = sesje.filter((s) => s.v !== null && s.dzien > od && s.dzien <= doDnia).map((s) => s.v as number);
    return l.length ? Math.max(...l) : null;
  };
  const ostatnie = najlepszyMiedzy(addDays(today, -DNI_8_TYG), "9999-12-31");
  const wczesniejsze = najlepszyMiedzy(addDays(today, -2 * DNI_8_TYG), addDays(today, -DNI_8_TYG));
  const zmiana = ostatnie !== null && wczesniejsze !== null ? ostatnie - wczesniejsze : null;
  // Telefon (CMExerciseDetail): 8 ostatnich tygodni kalendarzowych (wg początku tygodnia z profilu),
  // najlepszy 1RM i objętość każdego tygodnia
  const dzienTygodnia = weekdayOf(today);
  const poczatekTygodnia = addDays(
    today,
    -(data.profile.weekStart === "mon" ? dzienTygodnia - 1 : dzienTygodnia % 7),
  );
  const tygodnie = Array.from({ length: 8 }, (_, i) => {
    const od = addDays(poczatekTygodnia, (i - 7) * 7);
    const doDnia = addDays(od, 6);
    let rmTygodnia: number | null = null;
    let objetoscTygodnia: number | null = null;
    for (const s of sesje) {
      if (s.dzien < od || s.dzien > doDnia) continue;
      if (s.v !== null && (rmTygodnia === null || s.v > rmTygodnia))
        rmTygodnia = s.v;
      if (s.objetosc > 0)
        objetoscTygodnia = (objetoscTygodnia ?? 0) + s.objetosc;
    }
    return {
      etykieta: `tydz. ${isoWeekNumber(addDays(od, 3))}`,
      rm: rmTygodnia,
      objetosc: objetoscTygodnia,
    };
  });
  // Seria z najlepszym szac. 1RM (do wiersza „Najlepsza seria”)
  let najlepszaSesja: (typeof sesje)[number] | null = null;
  for (const s of sesje) {
    if (
      s.v !== null &&
      (najlepszaSesja === null || s.v > (najlepszaSesja.v as number))
    )
      najlepszaSesja = s;
  }
  const jednostka = zMasaCiala ? "" : " kg";

  return (
    <div className="flex min-w-0 flex-col">
      {/* .topbar z okruszkami .crumb */}
      <header className="box-content flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-2.5 max-[799px]:hidden">
        <nav aria-label="Okruszki" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/sport" className="text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:shadow-focus">
            Sport
          </Link>
          <span aria-hidden="true">/</span>
          <span>Ćwiczenia</span>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-foreground">{exercise.name}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {zCiezarem && (
            <div className="flex items-center gap-2 text-sm">
              <Switch checked={zMasaCiala} onChange={(v) => void przelaczMaseCiala(v)} ariaLabel="Z masą ciała" />
              {/* Klik w napis też przełącza, jak <label> w makiecie */}
              <span aria-hidden="true" className="cursor-pointer select-none" onClick={() => void przelaczMaseCiala(!zMasaCiala)}>
                Z masą ciała
              </span>
            </div>
          )}
          <Button
            onClick={() => {
              setNazwa(exercise.name);
              setBlad(null);
              setDialogOtwarty(true);
            }}
          >
            <PencilIcon aria-hidden="true" className="size-4" />
            Zmień nazwę
          </Button>
        </div>
      </header>

      <div className="box-border flex w-full flex-col gap-4 p-6 max-[799px]:hidden">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">{exercise.name}</h1>
          <p className="m-0 mt-1 flex flex-wrap items-center gap-2 text-muted-foreground tabular-nums">
            <span>{podtytul}</span>
            {zMasaCiala && <StatusBadge tone="blue">z masą ciała</StatusBadge>}
            {!zCiezarem && <StatusBadge tone="gray">{EXERCISE_KINDS[rodzaj].label}</StatusBadge>}
          </p>
        </div>

        <Card className="grid grid-cols-4 divide-x divide-border overflow-hidden">
          {liczby.map((l) => (
            <div key={l.k} data-testid={`liczba-${l.k}`} className="flex min-w-0 flex-col gap-0.5 px-5 py-3.5">
              <span className="text-xs text-muted-foreground">{l.k}</span>
              <b className="text-lg font-semibold whitespace-nowrap tabular-nums">{l.v}</b>
              <span className={cn("truncate text-xs text-muted-foreground tabular-nums", l.tone)}>{l.sub}</span>
            </div>
          ))}
        </Card>

        <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card role="region" aria-label="Wykres">
              <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-5 pb-2">
                <Segment
                  ariaLabel="Miara"
                  value={m.key}
                  onChange={(v) => setMiara(dostepne.findIndex((x) => x.key === v))}
                  options={dostepne.map((x) => ({ value: x.key, label: x.label }))}
                />
                <Segment
                  ariaLabel="Zakres"
                  value={zakres}
                  onChange={setZakres}
                  options={[
                    { value: "8t", label: "8 tyg." },
                    { value: "all", label: "Wszystko" },
                  ]}
                />
              </div>
              <div className="flex flex-col gap-4 px-6 pt-1 pb-5">
                {ostatni === null ? (
                  <p className="m-0 text-sm text-muted-foreground">Brak danych w tym okresie.</p>
                ) : (
                  <>
                    <div className="flex flex-wrap items-baseline gap-2.5">
                      <b data-testid="liczba-wykresu" className="text-[32px] leading-none font-semibold tracking-[-0.03em] tabular-nums">
                        {m.format(ostatni)}
                      </b>
                      <span className="text-muted-foreground">{m.unit}</span>
                      {roznica !== null && (
                        <StatusBadge tone={roznica >= 0 ? "green" : "orange"} className="ml-1 tabular-nums">
                          {`${zeZnakiem(roznica, m.format)} ${wZakresieTxt}`}
                        </StatusBadge>
                      )}
                    </div>
                    <ExerciseChart points={punkty} format={m.format} />
                  </>
                )}
              </div>
            </Card>

            <Card role="region" aria-labelledby="historia-cwiczenia" className="overflow-hidden">
              <div className="flex items-center justify-between px-6 pt-5 pb-3.5">
                <CardTitle as="h2" id="historia-cwiczenia">
                  Historia
                </CardTitle>
                <span className="text-xs text-muted-foreground tabular-nums">{plPlural(wiersze.length, "trening", "treningi", "treningów")}</span>
              </div>
              {wiersze.length === 0 ? (
                <p className="m-0 border-t border-border px-6 py-3.5 text-sm text-muted-foreground">Brak zrobionych serii tego ćwiczenia.</p>
              ) : (
                <>
                  <div className={cn(WIERSZ, "pb-2 text-xs font-medium text-muted-foreground")}>
                    <span>Data</span>
                    <span>Serie</span>
                    <span className="text-right">{zCiezarem ? "Szac. 1RM" : rodzaj === "dur" ? "Najdłużej" : "Dystans"}</span>
                    <span className="text-right">{zCiezarem ? "Objętość" : "Łączny czas"}</span>
                    <span />
                    <span />
                  </div>
                  {(wszystkie ? wiersze : wiersze.slice(0, 5)).map((s) => {
                    const jest = otwarta === s.id;
                    const wynik = zCiezarem
                      ? s.rm === null ? "—" : `${kg(s.rm)} kg`
                      : rodzaj === "dur"
                        ? s.longestS === null ? "—" : formatDuration(s.longestS)
                        : `${formatKg(Math.round(s.totalKm * 100) / 100)} km`;
                    const objetosc = zCiezarem ? `${formatVolume(s.volume)} kg` : s.totalS ? formatDuration(s.totalS) : "—";
                    const etykiety = setLabels(s.sets);
                    const rekordSesji = rekordy.filter((r) => r.day === s.day).map((r) => r.label.toLowerCase());
                    return (
                      <div key={s.id}>
                        <button
                          type="button"
                          aria-expanded={jest}
                          onClick={() => setOtwarta(jest ? null : s.id)}
                          className={cn(WIERSZ, "w-full border-0 border-t border-solid border-black/[.06] bg-transparent py-2.5 text-left outline-none hover:bg-black/[.02] focus-visible:bg-accent", jest && "bg-black/[.025]")}
                        >
                          <span className="text-soft-foreground tabular-nums">{etykietaDnia(s.day)}</span>
                          <span className="truncate tabular-nums">{s.sets.map(seriaTxt).join(" · ")}</span>
                          <span className="text-right font-medium tabular-nums">{wynik}</span>
                          <span className="text-right text-soft-foreground tabular-nums">{objetosc}</span>
                          <span className="text-right">{s.record && <StatusBadge tone="green">rekord</StatusBadge>}</span>
                          <ChevronRight size={16} aria-hidden="true" className={cn("text-[#a3a3a3] transition-transform", jest && "rotate-90")} />
                        </button>
                        {jest && (
                          <div className="flex flex-col gap-3 bg-black/[.025] pt-1 pr-6 pb-4 pl-6 min-[1100px]:pl-[124px]">
                            <table className="w-full border-collapse overflow-hidden rounded-[10px] border border-border bg-white text-[13px]">
                              <thead>
                                <tr>
                                  {["Seria", ...(zCiezarem ? ["Ciężar", "Powt.", "Objętość"] : rodzaj === "dur" ? ["Czas"] : ["Dystans", "Czas"])].map((n) => (
                                    <th key={n} scope="col" className="border-b border-border px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">
                                      {n}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {s.sets.map((x, j) => {
                                  const ciezar = x.weight_kg === null ? null : x.weight_kg;
                                  const komorki = zCiezarem
                                    ? [
                                        zMasaCiala ? formatKg(ciezar, true) : ciezar === null ? "—" : `${formatKg(ciezar)} kg`,
                                        String(x.reps ?? "—"),
                                        ciezar === null || x.reps === null || zMasaCiala ? "—" : `${formatVolume(ciezar * x.reps)} kg`,
                                      ]
                                    : rodzaj === "dur"
                                      ? [x.duration_s === null ? "—" : formatDuration(x.duration_s)]
                                      : [x.distance_km === null ? "—" : `${formatKg(x.distance_km)} km`, x.duration_s === null ? "—" : formatDuration(x.duration_s)];
                                  return (
                                    <tr key={x.id}>
                                      {[etykiety[j], ...komorki].map((k, i) => (
                                        <td key={i} className="border-t border-black/5 px-3 py-1.5 tabular-nums">
                                          {k}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button asChild size="sm">
                                <Link href={`/sport/trening/${s.id}`}>Otwórz trening</Link>
                              </Button>
                              <span className="text-xs text-muted-foreground">
                                {[`Trening ${s.title}`, plPlural(s.working.length, "seria robocza", "serie robocze", "serii roboczych"), rekordSesji.length ? `rekord: ${rekordSesji.join(", ")}` : null]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {wiersze.length > 5 && (
                    <Button
                      variant="ghost"
                      className="h-11 w-full justify-center rounded-none border-0 border-t border-solid border-black/[.06]"
                      onClick={() => {
                        setWszystkie(!wszystkie);
                        setOtwarta(null);
                      }}
                    >
                      {wszystkie ? "Pokaż mniej" : `Pokaż wszystkie (${wiersze.length})`}
                    </Button>
                  )}
                </>
              )}
            </Card>
          </div>

          <div className="flex min-w-0 flex-col gap-4">
            {nastepny && (
              <Card role="region" aria-labelledby="nastepny-trening">
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                  <CardTitle as="h2" id="nastepny-trening">
                    Następny trening
                  </CardTitle>
                  <StatusBadge tone="gray">zaplanowany</StatusBadge>
                </div>
                <div className="flex flex-col gap-3.5 px-6 pb-5">
                  <div>
                    <div className="font-medium">{nastepny.title}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {`${new Intl.DateTimeFormat("pl-PL", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${nastepny.date}T00:00:00Z`))} · ${formatClockTime(Math.floor(nastepny.startMin / 60), nastepny.startMin % 60, profile.clock)}`}
                    </div>
                  </div>
                  {cel && (
                    <div data-testid="cel" className="flex items-center justify-between gap-3 rounded-[10px] border border-border px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground">Cel na ostatnią serię</div>
                        <div className="mt-0.5 font-semibold tabular-nums">{cel.goal}</div>
                      </div>
                      <span className="text-right text-xs text-muted-foreground tabular-nums">
                        {`ostatnio ${cel.last}`}
                        <br />
                        {cel.change}
                      </span>
                    </div>
                  )}
                  {nastepny.sessionId ? (
                    <Button asChild variant="primary" className="justify-center">
                      <Link href={`/sport/trening/${nastepny.sessionId}`}>Rozpocznij trening</Link>
                    </Button>
                  ) : (
                    <Button variant="primary" className="justify-center" disabled={startuje} onClick={() => void rozpocznij()}>
                      Rozpocznij trening
                    </Button>
                  )}
                </div>
              </Card>
            )}
            <Card role="region" aria-labelledby="rekordy-cwiczenia">
              <div className="flex items-center justify-between px-6 pt-5 pb-1">
                <CardTitle as="h2" id="rekordy-cwiczenia">
                  Rekordy
                </CardTitle>
                <span className="text-xs text-muted-foreground">najlepsze wyniki</span>
              </div>
              <div className="px-6 pb-3">
                {rekordy.length === 0 && <p className="m-0 py-2.5 text-sm text-muted-foreground">Jeszcze brak.</p>}
                {rekordy.map((r) => (
                  <div key={r.label} className="flex items-center gap-3 border-t border-black/[.06] py-2.5 first:border-t-0">
                    <span className="min-w-0 flex-1">{r.label}</span>
                    {r.fresh && <StatusBadge tone="green">nowy</StatusBadge>}
                    <span className="text-right">
                      <b className="block font-semibold tabular-nums">{r.value}</b>
                      <span className="text-xs text-muted-foreground tabular-nums">{dataPelna(r.day)}</span>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>

      <MExerciseDetail
        nazwa={exercise.name}
        rm={najlepszy1rm === null ? null : kg(najlepszy1rm)}
        zmiana={
          zmiana === null
            ? null
            : {
                tekst:
                  zmiana === 0
                    ? "0 kg"
                    : `${zmiana > 0 ? "+" : "−"}${formatKg(Math.abs(zmiana))} kg`,
                znak: zmiana > 0 ? 1 : zmiana < 0 ? -1 : 0,
              }
        }
        tygodnie={tygodnie}
        najciezsza={
          najciezsza === null
            ? null
            : `${formatKg(najciezsza.set.weight_kg, zMasaCiala)}${formatKg(najciezsza.set.weight_kg, zMasaCiala).startsWith("mc") ? "" : jednostka} × ${najciezsza.set.reps}`
        }
        najwiecejPowt={
          najwiecejPowt === null
            ? null
            : `${formatKg(najwiecejPowt.weight_kg, zMasaCiala)}${formatKg(najwiecejPowt.weight_kg, zMasaCiala).startsWith("mc") ? "" : jednostka} × ${najwiecejPowt.reps}`
        }
        najlepsza={
          najlepszaSesja === null
            ? null
            : { tekst: najlepszaSesja.seriaTel, rekord: najlepszaSesja.rekord }
        }
        wiersze={[...sesje].reverse().map((s) => ({
          id: s.id,
          dzien: etykietaDnia(s.dzien),
          serie: s.komplet,
          rm: s.v === null ? "—" : `${kg(s.v)} kg`,
        }))}
        nazwaSzablonu={data.templateName}
        zMasaCiala={zMasaCiala}
        onToggleBodyweight={(v) => void przelaczMaseCiala(v)}
        onRename={() => {
          setNazwa(exercise.name);
          setBlad(null);
          setDialogOtwarty(true);
        }}
      />

      <FormDialog
        open={dialogOtwarty}
        onOpenChange={setDialogOtwarty}
        title="Zmień nazwę"
        footer={
          <>
            <Button
              variant="ghost"
              size="sm"
              className="max-[799px]:h-11"
              onClick={() => setDialogOtwarty(false)}
            >
              Anuluj
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="max-[799px]:h-11"
              disabled={zapisuje}
              onClick={zapisz}
            >
              Zapisz
            </Button>
          </>
        }
      >
        <TextField
          label="Nazwa ćwiczenia"
          value={nazwa}
          maxLength={60}
          error={blad ?? undefined}
          onChange={(e) => setNazwa(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !zapisuje) zapisz();
          }}
        />
      </FormDialog>
    </div>
  );
}
