"use client";

// Okno biegu (RunDialog.dc.html): nowy bieg, edycja i „Uzupełnij dane” planu. Tempo i kcal liczą się
// na żywo z wpisanego dystansu i czasu (waga z profilu). Bez czasu bieg zapisuje się jako plan.
import { useState } from "react";

import {
  Button,
  DatePicker,
  FIELD,
  FormDialog,
  Switch,
  TextField,
  TimePicker,
  type IsoDate,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { saveRun, type RunInput } from "./actions";
import type { SportProfile } from "./load-sport";
import {
  formatDuration,
  formatKm,
  formatPace,
  paceSPerKm,
  parseDuration,
  parseKm,
  runFormInput,
  runKcal,
  type RunKind,
  type SportItem,
} from "./model";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// Etykiety chipów jak w makiecie („Długi”); tytuł sesji w bazie to pełna etykieta rodzaju.
// Wspólne z arkuszem telefonu (MRunNew)
export const RODZAJE: { kind: RunKind; label: string }[] = [
  { kind: "easy", label: "Spokojny" },
  { kind: "tempo", label: "Tempo" },
  { kind: "intervals", label: "Interwały" },
  { kind: "long", label: "Długi" },
  { kind: "race", label: "Zawody" },
];

type Bledy = Partial<Record<keyof RunInput, string>>;

export function RunDialog({
  item,
  date,
  start,
  profile,
  onClose,
}: {
  // Bieg do edycji; null = nowy bieg
  item: SportItem | null;
  // Data i godzina startu (nowy bieg: z adresu; edycja: z biegu)
  date: IsoDate;
  start: string;
  profile: SportProfile;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<RunKind>(item?.runKind ?? "easy");
  const [dzien, setDzien] = useState<IsoDate | null>(date);
  const [godzina, setGodzina] = useState(start);
  const [dystans, setDystans] = useState(
    item?.distanceKm != null
      ? Number.isInteger(item.distanceKm)
        ? formatKm(item.distanceKm)
        : String(item.distanceKm).replace(".", ",")
      : "",
  );
  const [czas, setCzas] = useState(
    item?.durationS != null ? formatDuration(item.durationS) : "",
  );
  const [trudnosc, setTrudnosc] = useState<number | null>(
    item?.difficulty ?? null,
  );
  const [notatka, setNotatka] = useState(item?.note ?? "");
  const [wKalendarzu, setWKalendarzu] = useState(item?.showInCalendar ?? true);
  const [bledy, setBledy] = useState<Bledy>({});
  const [blad, setBlad] = useState("");
  const [pending, setPending] = useState(false);

  // Na żywo: tempo i kcal tylko dla poprawnego dystansu i czasu
  const km = parseKm(dystans);
  const sekundy = parseDuration(czas);
  const naZywo = km !== null && km > 0 && sekundy !== null && sekundy > 0;
  const tempo = naZywo ? `${formatPace(paceSPerKm(km, sekundy))} /km` : "—";
  const kcalNaZywo = naZywo ? runKcal(km, sekundy, profile.weightKg) : null;

  const plan = item !== null && item.planned;
  const tytul =
    item === null ? "Nowy bieg" : plan ? "Uzupełnij dane biegu" : "Edytuj bieg";

  async function zapisz() {
    if (pending) return;
    // Zły zapis łapiemy przed serwerem (wspólne z MRunNew); zakresy (0 km, > 24 h) sprawdza saveRun
    const formularz = runFormInput({
      id: item?.sessionId ?? null,
      kind,
      date: dzien,
      start: godzina,
      distanceText: dystans,
      durationText: czas,
      difficulty: trudnosc,
      note: notatka,
      showInCalendar: wKalendarzu,
    });
    if (!formularz.ok) {
      setBledy(formularz.errors);
      setBlad("");
      return;
    }

    setPending(true);
    setBledy({});
    setBlad("");
    try {
      const wynik = await saveRun(formularz.input);
      if (wynik.ok) {
        onClose();
        return;
      }
      if (wynik.field) {
        setBledy({ [wynik.field]: wynik.message });
      } else {
        setBlad(wynik.message);
      }
    } catch {
      setBlad(BLAD_ZAPISU);
    }
    setPending(false);
  }

  return (
    <FormDialog
      open
      onOpenChange={(otwarte) => {
        if (!otwarte) onClose();
      }}
      title={tytul}
      description="Tempo i kcal liczą się na żywo."
      wide
      footer={
        <>
          {blad && (
            <p
              role="alert"
              className="m-0 mr-auto text-xs text-destructive-foreground"
            >
              {blad}
            </p>
          )}
          <Button variant="ghost" onClick={onClose}>
            Anuluj
          </Button>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() => void zapisz()}
          >
            Zapisz bieg
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        Rodzaj biegu
        {/* Tor .seg: szare tło, wybrany rodzaj to biała pigułka z cieniem (aria-pressed jak dotąd) */}
        <div
          role="group"
          aria-label="Rodzaj biegu"
          className="inline-flex max-w-full flex-wrap gap-0.5 self-start rounded-md bg-muted p-0.5 font-normal"
        >
          {RODZAJE.map((r) => (
            <button
              key={r.kind}
              type="button"
              aria-pressed={kind === r.kind}
              onClick={() => setKind(r.kind)}
              className={cn(
                "inline-flex h-7 cursor-pointer items-center justify-center rounded-[8px] border-0 px-2.5 text-sm font-medium whitespace-nowrap outline-none focus-visible:shadow-focus max-[799px]:h-10",
                kind === r.kind
                  ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.05)]"
                  : "bg-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 max-[799px]:grid-cols-1">
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          Data
          <DatePicker
            value={dzien}
            onChange={setDzien}
            weekStart={profile.weekStart}
            ariaLabel="Data"
          />
          {bledy.date && (
            <p className="m-0 text-xs font-normal text-destructive-foreground">
              {bledy.date}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          Start
          <TimePicker
            value={godzina}
            onChange={setGodzina}
            ariaLabel="Start"
            clock={profile.clock}
          />
        </div>
        <TextField
          label="Dystans (km)"
          className="tabular-nums"
          inputMode="decimal"
          autoComplete="off"
          value={dystans}
          error={bledy.distanceKm}
          onChange={(e) => setDystans(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 max-[799px]:grid-cols-1">
        <TextField
          label="Czas"
          className="tabular-nums"
          placeholder="h:mm:ss"
          autoComplete="off"
          value={czas}
          error={bledy.durationS}
          onChange={(e) => setCzas(e.target.value)}
        />
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          Tempo
          <div
            data-testid="tempo"
            className={cn(
              FIELD,
              "flex items-center bg-black/[.025] tabular-nums shadow-none",
            )}
          >
            {tempo}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          Kcal
          <div
            data-testid="kcal"
            className={cn(
              FIELD,
              "flex items-center bg-black/[.025] tabular-nums shadow-none",
            )}
          >
            {kcalNaZywo !== null ? `≈ ${kcalNaZywo}` : "—"}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        <span>
          Trudność{" "}
          <span className="text-xs font-normal text-muted-foreground">
            1 = bardzo lekko, 10 = maks
          </span>
        </span>
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => {
            // Kolor skali zależy od wybranej trudności: 1–4 zielony, 5–7 bursztynowy, 8–10 czerwony
            const wysoka = trudnosc !== null && trudnosc >= 8;
            const srednia = trudnosc !== null && trudnosc >= 5 && trudnosc < 8;
            let stan = "border-input bg-white text-soft-foreground shadow-xs";
            if (trudnosc === n) {
              stan = wysoka
                ? "border-destructive bg-destructive text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)]"
                : srednia
                  ? "border-warning bg-warning text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)]"
                  : "border-success bg-success text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)]";
            } else if (trudnosc !== null && n < trudnosc) {
              stan = wysoka
                ? "border-destructive/[.19] bg-destructive/[.09] text-soft-foreground"
                : srednia
                  ? "border-warning/[.19] bg-warning/[.09] text-soft-foreground"
                  : "border-success/[.19] bg-success/[.09] text-soft-foreground";
            }
            return (
              <button
                key={n}
                type="button"
                aria-pressed={trudnosc === n}
                onClick={() => setTrudnosc(trudnosc === n ? null : n)}
                className={cn(
                  "size-8 cursor-pointer rounded-[10px] border text-[13px] font-medium tabular-nums outline-none focus-visible:shadow-focus",
                  stan,
                )}
              >
                {n}
              </button>
            );
          })}
        </div>
        {bledy.difficulty && (
          <p className="m-0 text-xs font-normal text-destructive-foreground">
            {bledy.difficulty}
          </p>
        )}
      </div>

      <TextField
        label={
          <>
            Notatka{" "}
            <span className="text-xs font-normal text-muted-foreground">
              opcjonalnie
            </span>
          </>
        }
        placeholder="trasa, pogoda, samopoczucie"
        autoComplete="off"
        value={notatka}
        error={bledy.note}
        onChange={(e) => setNotatka(e.target.value)}
      />

      <div className="flex items-center gap-2.5 text-sm">
        <Switch
          checked={wKalendarzu}
          onChange={setWKalendarzu}
          ariaLabel="Pokaż w kalendarzu głównym jako blok"
        />
        Pokaż w kalendarzu głównym jako blok
      </div>

      <p className="m-0 text-xs text-muted-foreground">
        Kcal z wagi w profilu. Bez czasu bieg zapisze się jako plan.
      </p>
    </FormDialog>
  );
}
