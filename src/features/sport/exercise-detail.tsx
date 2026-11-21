"use client";

// Szczegóły ćwiczenia (ExerciseDetail.dc.html): ścieżka „Sport / Ćwiczenia / nazwa” z „Z masą ciała” i „Zmień nazwę”,
// cztery kafelki (szac. 1RM, najcięższa seria, najwięcej powt., zmiana 8 tyg.), wykres 1RM
// z przełącznikiem 3 mies. / 8 tyg. i historia sesji z plakietką REKORD.
// Jedno drzewo dla webu i telefonu — kafelki i tabela same się zwężają (tabela przewija się w poziomie).
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PencilIcon } from "lucide-react";

import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  FormDialog,
  Segment,
  StatusBadge,
  Switch,
  TextField,
} from "@/components/controls";
import { addDays, weekdayOf } from "@/features/calendar/view-range";
import { cn } from "@/lib/utils";
import { renameExercise, setExerciseBodyweight } from "./actions";
import type { ExerciseData } from "./load-sport";
import {
  effectiveKg,
  epley1rm,
  formatKg,
  plPlural,
  recordSetIds,
} from "./model";

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
// Okna w dniach: 8 tygodni i 3 miesiące (13 tygodni)
const DNI_OKNA = { "8t": 56, "3m": 91 } as const;

// 82.5 -> "82,5", 72 -> "72,0" (jak `kg` w makiecie)
const kg = (v: number) => v.toFixed(1).replace(".", ",");

type Sesja = {
  id: string;
  dzien: string; // YYYY-MM-DD
  v: number | null; // najlepszy szac. 1RM sesji (serie z ciężarem i powt. ≥ 1)
  seria: string; // najlepsza seria, np. „72,5 × 5”
  rekord: boolean;
};

export function ExerciseDetail({ data }: { data: ExerciseData }) {
  const router = useRouter();
  const { exercise, today } = data;
  // Tylko zakończone treningi: przyszły / niedokończony nie trafia do wykresu, tabeli, „8 tygodni” ani REKORDU
  const history = data.history.filter((h) => h.completed);
  const [okno, setOkno] = useState<"3m" | "8t">("8t");
  const [dialogOtwarty, setDialogOtwarty] = useState(false);
  const [nazwa, setNazwa] = useState(exercise.name);
  const [blad, setBlad] = useState<string | null>(null);
  const [zapisuje, setZapisuje] = useState(false);

  // „Z masą ciała” optymistycznie: przełącznik zmienia się od razu, błąd go cofa.
  // Nowe dane z serwera (inna wartość flagi) stają się nowym stanem (wzór z use-gym-store).
  const [zMasaCiala, setZMasaCiala] = useState(exercise.bodyweight);
  const zapisujeMase = useRef(false);
  const [flagaSerwera, setFlagaSerwera] = useState(exercise.bodyweight);
  if (flagaSerwera !== exercise.bodyweight) {
    setFlagaSerwera(exercise.bodyweight);
    setZMasaCiala(exercise.bodyweight);
  }
  const wagaProfilu = data.profile.weightKg;

  const rekordowe = recordSetIds(history, exercise.id, zMasaCiala, wagaProfilu);

  // Jedno przejście po seriach: kafelki + najlepsza seria i 1RM każdej sesji.
  // Porównujemy efektywny ciężar (masa ciała: waga z profilu + dociążenie), a pokazujemy
  // wpisany („mc + 5 × 10” przy masie ciała).
  let najlepszy1rm: number | null = null;
  let najciezsza: { kg: number | null; ef: number; reps: number } | null = null;
  let najwiecejPowt: {
    kg: number | null;
    ef: number | null;
    reps: number;
  } | null = null;
  const sesje: Sesja[] = [];
  for (const h of history) {
    let v: number | null = null;
    let seria: { kg: number | null; reps: number } | null = null;
    let rekord = false;
    for (const s of h.sets) {
      if (s.exercise_id !== exercise.id || !s.done) continue;
      if (rekordowe.has(s.id)) rekord = true;
      if (s.reps === null || s.reps < 1) continue;
      const ef = effectiveKg(s.weight_kg, zMasaCiala, wagaProfilu);
      if (
        najwiecejPowt === null ||
        s.reps > najwiecejPowt.reps ||
        (s.reps === najwiecejPowt.reps && (ef ?? 0) > (najwiecejPowt.ef ?? 0))
      )
        najwiecejPowt = { kg: s.weight_kg, ef, reps: s.reps };
      if (ef === null) {
        // Seria bez ciężaru liczy się do historii tylko, gdy sesja nie ma serii z ciężarem
        if (v === null && (seria === null || s.reps > seria.reps))
          seria = { kg: s.weight_kg, reps: s.reps };
        continue;
      }
      if (
        najciezsza === null ||
        ef > najciezsza.ef ||
        (ef === najciezsza.ef && s.reps > najciezsza.reps)
      )
        najciezsza = { kg: s.weight_kg, ef, reps: s.reps };
      const e = epley1rm(ef, s.reps);
      if (v === null || e > v) {
        v = e;
        seria = { kg: s.weight_kg, reps: s.reps };
      }
    }
    if (seria === null) continue;
    if (v !== null && (najlepszy1rm === null || v > najlepszy1rm))
      najlepszy1rm = v;
    sesje.push({
      id: h.sessionId,
      dzien: h.startLocal.slice(0, 10),
      v,
      seria: `${formatKg(seria.kg, zMasaCiala)} × ${seria.reps}`,
      rekord,
    });
  }

  // Zmiana 8 tyg.: najlepszy 1RM z ostatnich 8 tygodni − najlepszy z 8 tygodni wcześniej
  const granica8 = addDays(today, -DNI_OKNA["8t"]);
  const granica16 = addDays(today, -2 * DNI_OKNA["8t"]);
  let ostatnie: number | null = null;
  let wczesniejsze: number | null = null;
  for (const s of sesje) {
    if (s.v === null) continue;
    if (s.dzien > granica8) {
      if (ostatnie === null || s.v > ostatnie) ostatnie = s.v;
    } else if (s.dzien > granica16) {
      if (wczesniejsze === null || s.v > wczesniejsze) wczesniejsze = s.v;
    }
  }
  const zmiana =
    ostatnie !== null && wczesniejsze !== null ? ostatnie - wczesniejsze : null;

  // Punkty wykresu: sesje z 1RM w wybranym oknie, rosnąco po dacie
  const granicaOkna = addDays(today, -DNI_OKNA[okno]);
  const punkty = sesje.filter((s) => s.v !== null && s.dzien > granicaOkna);
  const dolna = Math.min(...punkty.map((p) => p.v as number)) - 2;
  const gorna = Math.max(...punkty.map((p) => p.v as number)) + 2;
  // Skala 620 × 200 jak w makiecie: x od 20 do 580, y od 170 (dół) do 20 (góra)
  const px = (i: number) =>
    punkty.length > 1 ? 20 + i * (560 / (punkty.length - 1)) : 300;
  const py = (v: number) => 170 - ((v - dolna) / (gorna - dolna)) * 150;

  // Tabela: najnowsza sesja na górze
  const wiersze = [...sesje].reverse();
  const rokDzis = today.slice(0, 4);
  const etykietaDnia = (dzien: string) => {
    const [rok, mm, dd] = dzien.split("-");
    return `${DNI[weekdayOf(dzien)]} ${dd}.${mm}${rok === rokDzis ? "" : `.${rok}`}`;
  };

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

  const pierwsza = sesje[0];

  return (
    <div className="flex min-w-0 flex-col">
      {/* .topbar z okruszkami .crumb (CExerciseDetail) */}
      <header className="box-content flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-2.5 max-[799px]:px-4">
        <nav
          aria-label="Okruszki"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <Link
            href="/sport"
            className="text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:shadow-focus max-[799px]:inline-flex max-[799px]:min-h-11 max-[799px]:items-center"
          >
            Sport
          </Link>
          <span aria-hidden="true">/</span>
          <span>Ćwiczenia</span>
          <span aria-hidden="true">/</span>
          <span className="font-medium text-foreground">{exercise.name}</span>
        </nav>
        <div className="flex flex-wrap items-center gap-2">
          {/* Etykieta obok przełącznika; na telefonie pole stuknięcia ≥ 44 px */}
          <div className="flex items-center gap-2 text-sm max-[799px]:min-h-11">
            <Switch
              checked={zMasaCiala}
              onChange={(v) => void przelaczMaseCiala(v)}
              ariaLabel="Z masą ciała"
            />
            {/* Klik w napis też przełącza, jak <label> w makiecie */}
            <span
              aria-hidden="true"
              className="cursor-pointer select-none"
              onClick={() => void przelaczMaseCiala(!zMasaCiala)}
            >
              Z masą ciała
            </span>
          </div>
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

      <div className="box-border flex w-full max-w-[1100px] flex-col gap-6 px-6 py-7 max-[799px]:px-4 max-[799px]:py-5">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">
            {exercise.name}
          </h1>
          {/* Podtytuł jako odznaki .bdg lg: liczba treningów, data pierwszego, szablon */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {sesje.length === 0 ? (
              <StatusBadge tone="gray" size="lg">
                Brak treningów
              </StatusBadge>
            ) : (
              <>
                <StatusBadge tone="gray" size="lg">
                  {plPlural(sesje.length, "trening", "treningi", "treningów")}
                </StatusBadge>
                <StatusBadge tone="gray" size="lg" className="tabular-nums">
                  {`od ${pierwsza.dzien.slice(8, 10)}.${pierwsza.dzien.slice(5, 7)}.${pierwsza.dzien.slice(0, 4)}`}
                </StatusBadge>
                {data.templateName && (
                  <StatusBadge tone="outline" size="lg">
                    {`w szablonie „${data.templateName}”`}
                  </StatusBadge>
                )}
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-3 max-[799px]:grid-cols-2">
          <Card className="min-w-0 px-[18px] py-4">
            <span className="block text-xs font-medium text-muted-foreground">
              Szac. 1RM
            </span>
            <div className="mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">
              {najlepszy1rm === null ? (
                "—"
              ) : (
                <>
                  {kg(najlepszy1rm)}{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    kg
                  </span>
                </>
              )}
            </div>
          </Card>
          <Card className="min-w-0 px-[18px] py-4">
            <span className="block text-xs font-medium text-muted-foreground">
              Najcięższa seria
            </span>
            <div className="mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">
              {najciezsza === null
                ? "—"
                : `${formatKg(najciezsza.kg, zMasaCiala)} × ${najciezsza.reps}`}
            </div>
          </Card>
          <Card className="min-w-0 px-[18px] py-4">
            <span className="block text-xs font-medium text-muted-foreground">
              Najwięcej powt.
            </span>
            <div className="mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums">
              {najwiecejPowt === null
                ? "—"
                : `${formatKg(najwiecejPowt.kg, zMasaCiala)} × ${najwiecejPowt.reps}`}
            </div>
          </Card>
          <Card className="min-w-0 px-[18px] py-4">
            <span className="block text-xs font-medium text-muted-foreground">
              8 tygodni
            </span>
            <div
              className={cn(
                "mt-2 text-[26px] font-semibold tracking-[-0.02em] tabular-nums",
                zmiana !== null && zmiana > 0 && "text-success",
                zmiana !== null && zmiana < 0 && "text-destructive-foreground",
              )}
            >
              {zmiana === null
                ? "—"
                : zmiana === 0
                  ? "0 kg"
                  : `${zmiana > 0 ? "+" : "−"}${formatKg(Math.abs(zmiana))} kg`}
            </div>
          </Card>
        </div>

        <Card role="region" aria-labelledby="wykres-1rm">
          <CardHeader className="items-center">
            <CardTitle as="h2" id="wykres-1rm">
              Szacowany 1RM
            </CardTitle>
            <Segment
              ariaLabel="Zakres wykresu"
              value={okno}
              onChange={setOkno}
              options={[
                { value: "3m", label: "3 mies." },
                { value: "8t", label: "8 tyg." },
              ]}
            />
          </CardHeader>
          <div className="px-6 pt-3 pb-5">
            {punkty.length === 0 ? (
              <p className="m-0 text-sm text-muted-foreground">
                Brak danych w tym okresie.
              </p>
            ) : (
              <svg
                viewBox="0 0 620 200"
                width="100%"
                height="220"
                role="img"
                aria-label={`Szacowany 1RM: od ${kg(punkty[0].v as number)} do ${kg(punkty[punkty.length - 1].v as number)} kg w ${plPlural(punkty.length, "sesji", "sesjach", "sesjach")}`}
                className="block"
              >
                {/* Siatka jak w makiecie: dół pełny, dwie linie kreskowane */}
                <line
                  x1="0"
                  y1="170"
                  x2="620"
                  y2="170"
                  stroke="rgba(0,0,0,.08)"
                />
                <line
                  x1="0"
                  y1="110"
                  x2="620"
                  y2="110"
                  stroke="rgba(0,0,0,.05)"
                  strokeDasharray="4 4"
                />
                <line
                  x1="0"
                  y1="50"
                  x2="620"
                  y2="50"
                  stroke="rgba(0,0,0,.05)"
                  strokeDasharray="4 4"
                />
                {[170, 110, 50].map((y) => (
                  <text
                    key={y}
                    x="612"
                    y={y - 4}
                    fontSize="11"
                    fill="#686868"
                    fontFamily="Inter, sans-serif"
                    textAnchor="end"
                  >
                    {formatKg(
                      Math.round(dolna + ((170 - y) / 150) * (gorna - dolna)),
                    )}
                  </text>
                ))}
                {/* Obszar pod linią (od dwóch punktów) */}
                {punkty.length > 1 && (
                  <polygon
                    points={`${px(0).toFixed(1)},170 ${punkty
                      .map(
                        (p, i) =>
                          `${px(i).toFixed(1)},${py(p.v as number).toFixed(1)}`,
                      )
                      .join(" ")} ${px(punkty.length - 1).toFixed(1)},170`}
                    fill="rgba(38,38,38,.04)"
                  />
                )}
                <polyline
                  points={punkty
                    .map(
                      (p, i) =>
                        `${px(i).toFixed(1)},${py(p.v as number).toFixed(1)}`,
                    )
                    .join(" ")}
                  fill="none"
                  stroke="#262626"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                {punkty.map((p, i) => (
                  <circle
                    key={p.id}
                    data-testid="punkt-wykresu"
                    cx={px(i)}
                    cy={py(p.v as number)}
                    r={p.rekord ? 5 : 3.5}
                    fill={p.rekord ? "#15803d" : "#fff"}
                    stroke={p.rekord ? "#fff" : "#262626"}
                    strokeWidth="2"
                  >
                    <title>{`${etykietaDnia(p.dzien)}: ${kg(p.v as number)} kg (seria ${p.seria})`}</title>
                  </circle>
                ))}
              </svg>
            )}
          </div>
        </Card>

        <Card
          role="region"
          aria-labelledby="historia-cwiczenia"
          className="overflow-hidden"
        >
          <CardHeader className="pb-3.5">
            <CardTitle as="h2" id="historia-cwiczenia">
              Historia
            </CardTitle>
          </CardHeader>
          <div className="overflow-x-auto border-t border-border">
            {wiersze.length === 0 ? (
              <p className="m-0 px-6 py-3.5 text-sm text-muted-foreground">
                Brak zrobionych serii tego ćwiczenia.
              </p>
            ) : (
              <table className="w-full min-w-[520px] border-collapse text-sm">
                <thead>
                  <tr>
                    {["Data", "Najlepsza seria", "Szac. 1RM"].map((t, i) => (
                      <th
                        key={t}
                        scope="col"
                        className={cn(
                          "h-10 border-b border-border px-3 text-left font-medium whitespace-nowrap text-muted-foreground",
                          i === 0 && "pl-6",
                        )}
                      >
                        {t}
                      </th>
                    ))}
                    <th
                      scope="col"
                      className="h-10 border-b border-border pr-6 pl-3"
                    >
                      <span className="sr-only">Rekord</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {wiersze.map((s) => (
                    <tr
                      key={s.id}
                      className="group/wiersz hover:bg-black/[.02]"
                    >
                      <td className="h-11 border-b border-border pr-3 pl-6 text-soft-foreground tabular-nums group-last/wiersz:border-b-0">
                        {etykietaDnia(s.dzien)}
                      </td>
                      <td className="h-11 border-b border-border px-3 font-medium tabular-nums group-last/wiersz:border-b-0">
                        {s.seria}
                      </td>
                      <td className="h-11 border-b border-border px-3 tabular-nums group-last/wiersz:border-b-0">
                        {s.v === null ? "—" : `${kg(s.v)} kg`}
                      </td>
                      <td className="h-11 border-b border-border pr-6 pl-3 text-right group-last/wiersz:border-b-0">
                        {s.rekord && (
                          <StatusBadge tone="green">REKORD</StatusBadge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      </div>

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
