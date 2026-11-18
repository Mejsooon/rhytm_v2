"use client";

// Szczegóły ćwiczenia (ExerciseDetail.dc.html): ścieżka „Sport / Ćwiczenia / nazwa” z „Z masą ciała” i „Zmień nazwę”,
// cztery kafelki (szac. 1RM, najcięższa seria, najwięcej powt., zmiana 8 tyg.), wykres 1RM
// z przełącznikiem 3 mies. / 8 tyg. i historia sesji z plakietką REKORD.
// Jedno drzewo dla webu i telefonu — kafelki i tabela same się zwężają (tabela przewija się w poziomie).
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Button,
  FormDialog,
  MonoLabel,
  Segment,
  Switch,
  TextField,
} from "@/components/controls";
import { addDays, weekdayOf } from "@/features/calendar/view-range";
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
  const podtytul =
    sesje.length === 0
      ? "Brak treningów"
      : `${plPlural(sesje.length, "trening", "treningi", "treningów")} · od ${pierwsza.dzien.slice(8, 10)}.${pierwsza.dzien.slice(5, 7)}.${pierwsza.dzien.slice(0, 4)}${data.templateName ? ` · w szablonie „${data.templateName}”` : ""}`;

  return (
    <div className="flex min-w-0 flex-col">
      <header className="flex min-h-[34px] flex-wrap items-center justify-between gap-3 border-b border-[#eaeaea] px-6 py-3 max-[799px]:px-4">
        <div className="font-mono text-[13px] text-[#666666]">
          <Link
            href="/sport"
            className="text-[#666666] no-underline hover:text-[#171717] max-[799px]:inline-flex max-[799px]:min-h-11 max-[799px]:items-center"
          >
            Sport
          </Link>{" "}
          <span className="text-[#b0b0b0]">/</span> <span>Ćwiczenia</span>{" "}
          <span className="text-[#b0b0b0]">/</span>{" "}
          <span className="text-[#171717]">{exercise.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {/* Etykieta obok przełącznika; na telefonie pole stuknięcia ≥ 44 px */}
          <div className="flex items-center gap-2 text-[13px] text-[#404040] max-[799px]:min-h-11">
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
            size="sm"
            className="max-[799px]:h-11"
            onClick={() => {
              setNazwa(exercise.name);
              setBlad(null);
              setDialogOtwarty(true);
            }}
          >
            Zmień nazwę
          </Button>
        </div>
      </header>

      <div className="box-border flex w-full max-w-[1100px] flex-col gap-6 px-6 py-7 max-[799px]:px-4 max-[799px]:py-5">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">
            {exercise.name}
          </h1>
          <p className="m-0 mt-1.5 font-mono text-xs text-[#6b6b6b]">
            {podtytul}
          </p>
        </div>

        <div className="grid grid-cols-4 gap-px overflow-hidden rounded-lg border border-[#eaeaea] bg-[#eaeaea] max-[799px]:grid-cols-2">
          <div className="bg-white px-[18px] py-4">
            <MonoLabel>Szac. 1RM</MonoLabel>
            <div className="mt-2 font-mono text-[26px]">
              {najlepszy1rm === null ? (
                "—"
              ) : (
                <>
                  {kg(najlepszy1rm)}{" "}
                  <span className="text-sm text-[#666666]">kg</span>
                </>
              )}
            </div>
          </div>
          <div className="bg-white px-[18px] py-4">
            <MonoLabel>Najcięższa seria</MonoLabel>
            <div className="mt-2 font-mono text-[26px]">
              {najciezsza === null
                ? "—"
                : `${formatKg(najciezsza.kg, zMasaCiala)} × ${najciezsza.reps}`}
            </div>
          </div>
          <div className="bg-white px-[18px] py-4">
            <MonoLabel>Najwięcej powt.</MonoLabel>
            <div className="mt-2 font-mono text-[26px]">
              {najwiecejPowt === null
                ? "—"
                : `${formatKg(najwiecejPowt.kg, zMasaCiala)} × ${najwiecejPowt.reps}`}
            </div>
          </div>
          <div className="bg-white px-[18px] py-4">
            <MonoLabel>8 tygodni</MonoLabel>
            <div
              className="mt-2 font-mono text-[26px]"
              style={{
                color:
                  zmiana === null || zmiana === 0
                    ? undefined
                    : zmiana > 0
                      ? "#15803d"
                      : "#b91c1c",
              }}
            >
              {zmiana === null
                ? "—"
                : zmiana === 0
                  ? "0 kg"
                  : `${zmiana > 0 ? "+" : "−"}${formatKg(Math.abs(zmiana))} kg`}
            </div>
          </div>
        </div>

        <section
          aria-labelledby="wykres-1rm"
          className="rounded-lg border border-[#eaeaea] bg-white p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <h2 id="wykres-1rm" className="m-0 text-[15px] font-semibold">
              Szacowany 1RM
            </h2>
            <Segment
              ariaLabel="Zakres wykresu"
              value={okno}
              onChange={setOkno}
              options={[
                { value: "3m", label: "3 mies." },
                { value: "8t", label: "8 tyg." },
              ]}
            />
          </div>
          {punkty.length === 0 ? (
            <p className="m-0 mt-4 text-[13px] text-[#666666]">
              Brak danych w tym okresie.
            </p>
          ) : (
            <svg
              viewBox="0 0 620 200"
              width="100%"
              height="220"
              role="img"
              aria-label={`Szacowany 1RM: od ${kg(punkty[0].v as number)} do ${kg(punkty[punkty.length - 1].v as number)} kg w ${plPlural(punkty.length, "sesji", "sesjach", "sesjach")}`}
              className="mt-2.5 block"
            >
              <line x1="0" y1="170" x2="620" y2="170" stroke="#eaeaea" />
              <line x1="0" y1="95" x2="620" y2="95" stroke="#f0f0f0" />
              <line x1="0" y1="20" x2="620" y2="20" stroke="#f0f0f0" />
              {[170, 95, 20].map((y) => (
                <text
                  key={y}
                  x="600"
                  y={y - 4}
                  fontSize="10"
                  fill="#6b6b6b"
                  fontFamily="Geist Mono, ui-monospace, monospace"
                  textAnchor="end"
                >
                  {formatKg(
                    Math.round(dolna + ((170 - y) / 150) * (gorna - dolna)),
                  )}
                </text>
              ))}
              <polyline
                points={punkty
                  .map(
                    (p, i) =>
                      `${px(i).toFixed(1)},${py(p.v as number).toFixed(1)}`,
                  )
                  .join(" ")}
                fill="none"
                stroke="#171717"
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {punkty.map((p, i) => (
                <circle
                  key={p.id}
                  data-testid="punkt-wykresu"
                  cx={px(i)}
                  cy={py(p.v as number)}
                  r={p.rekord ? 5 : 3}
                  fill={p.rekord ? "#15803d" : "#171717"}
                >
                  <title>{`${etykietaDnia(p.dzien)}: ${kg(p.v as number)} kg (seria ${p.seria})`}</title>
                </circle>
              ))}
            </svg>
          )}
        </section>

        <section
          aria-labelledby="historia-cwiczenia"
          className="overflow-x-auto rounded-lg border border-[#eaeaea] bg-white"
        >
          <div className="border-b border-[#eaeaea] px-4 py-3">
            <h2
              id="historia-cwiczenia"
              className="m-0 text-[15px] font-semibold"
            >
              Historia
            </h2>
          </div>
          {wiersze.length === 0 ? (
            <p className="m-0 px-4 py-3.5 text-[13px] text-[#666666]">
              Brak zrobionych serii tego ćwiczenia.
            </p>
          ) : (
            <table className="w-full min-w-[520px] border-collapse text-[13px]">
              <thead>
                <tr className="bg-[#fafafa]">
                  {["Data", "Najlepsza seria", "Szac. 1RM"].map((t) => (
                    <th
                      key={t}
                      scope="col"
                      className="border-b border-[#eaeaea] px-3.5 py-2.5 text-left font-medium whitespace-nowrap text-[#666666]"
                    >
                      {t}
                    </th>
                  ))}
                  <th
                    scope="col"
                    className="border-b border-[#eaeaea] px-3.5 py-2.5"
                  >
                    <span className="sr-only">Rekord</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {wiersze.map((s) => (
                  <tr key={s.id}>
                    <td className="border-b border-[#f0f0f0] px-3.5 py-[11px] font-mono text-[#404040]">
                      {etykietaDnia(s.dzien)}
                    </td>
                    <td className="border-b border-[#f0f0f0] px-3.5 py-[11px] font-mono">
                      {s.seria}
                    </td>
                    <td className="border-b border-[#f0f0f0] px-3.5 py-[11px] font-mono">
                      {s.v === null ? "—" : `${kg(s.v)} kg`}
                    </td>
                    <td className="border-b border-[#f0f0f0] px-3.5 py-[11px]">
                      {s.rekord && (
                        <span className="rounded border border-[#bbe5cc] bg-[#f0faf4] px-1.5 py-px font-mono text-[10px] text-[#15803d]">
                          REKORD
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <FormDialog
        open={dialogOtwarty}
        onOpenChange={setDialogOtwarty}
        title="Zmień nazwę"
        footer={
          <>
            <Button
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
