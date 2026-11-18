"use client";

// Okno biegu (RunDialog.dc.html): nowy bieg, edycja i „Uzupełnij dane” planu. Tempo i kcal liczą się
// na żywo z wpisanego dystansu i czasu (waga z profilu). Bez czasu bieg zapisuje się jako plan.
import { useState } from "react";

import {
  Button,
  Chip,
  DatePicker,
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
  runKcal,
  type RunKind,
  type SportItem,
} from "./model";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const BLAD_DYSTANSU = "Podaj dystans w km, np. 10,5.";
const BLAD_CZASU = "Podaj czas jako h:mm:ss albo mm:ss, np. 58:00.";

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
    // Zły zapis łapiemy przed serwerem; zakresy (0 km, > 24 h) sprawdza saveRun
    const nowe: Bledy = {};
    if (dystans.trim() !== "" && km === null) nowe.distanceKm = BLAD_DYSTANSU;
    if (czas.trim() !== "" && sekundy === null) nowe.durationS = BLAD_CZASU;
    if (dzien === null) nowe.date = "Wybierz datę.";
    if (Object.keys(nowe).length > 0 || dzien === null) {
      setBledy(nowe);
      setBlad("");
      return;
    }

    setPending(true);
    setBledy({});
    setBlad("");
    const dane: RunInput = {
      kind,
      date: dzien,
      start: godzina,
      distanceKm: dystans.trim() === "" ? null : km,
      durationS: czas.trim() === "" ? null : sekundy,
      difficulty: trudnosc,
      note: notatka,
      showInCalendar: wKalendarzu,
    };
    if (item?.sessionId) dane.id = item.sessionId;
    try {
      const wynik = await saveRun(dane);
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
            <p role="alert" className="m-0 mr-auto text-xs text-[#b91c1c]">
              {blad}
            </p>
          )}
          <Button onClick={onClose}>Anuluj</Button>
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
        <div
          role="group"
          aria-label="Rodzaj biegu"
          className="flex flex-wrap gap-1.5"
        >
          {RODZAJE.map((r) => (
            <Chip
              key={r.kind}
              selected={kind === r.kind}
              onClick={() => setKind(r.kind)}
            >
              {r.label}
            </Chip>
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
            <p className="m-0 text-xs font-normal text-[#b91c1c]">
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
          className="font-mono"
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
          className="font-mono"
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
            className="rounded-md border border-[#e0e0e0] bg-[#fafafa] px-[11px] py-[9px] font-mono text-sm font-normal"
          >
            {tempo}
          </div>
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          Kcal
          <div
            data-testid="kcal"
            className="rounded-md border border-[#e0e0e0] bg-[#fafafa] px-[11px] py-[9px] font-mono text-sm font-normal"
          >
            {kcalNaZywo !== null ? `≈ ${kcalNaZywo}` : "—"}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        <span>
          Trudność{" "}
          <span className="text-xs font-normal text-[#6b6b6b]">
            1 = bardzo lekko, 10 = maks
          </span>
        </span>
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={trudnosc === n}
              onClick={() => setTrudnosc(trudnosc === n ? null : n)}
              className={cn(
                "size-8 cursor-pointer rounded-md border font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20",
                trudnosc === n
                  ? "border-[#171717] bg-[#171717] text-white"
                  : "border-[#e0e0e0] bg-white text-[#404040]",
              )}
            >
              {n}
            </button>
          ))}
        </div>
        {bledy.difficulty && (
          <p className="m-0 text-xs font-normal text-[#b91c1c]">
            {bledy.difficulty}
          </p>
        )}
      </div>

      <TextField
        label={
          <>
            Notatka{" "}
            <span className="text-xs font-normal text-[#6b6b6b]">
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

      <div className="flex items-center gap-2.5 text-[13px]">
        <Switch
          checked={wKalendarzu}
          onChange={setWKalendarzu}
          ariaLabel="Pokaż w kalendarzu głównym jako blok"
        />
        Pokaż w kalendarzu głównym jako blok
      </div>

      <p className="m-0 font-mono text-[11px] text-[#6b6b6b]">
        Kcal z wagi w profilu. Bez czasu bieg zapisze się jako plan.
      </p>
    </FormDialog>
  );
}
