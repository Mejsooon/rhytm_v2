"use client";

// Arkusz biegu na telefonie wg MRunNew.dc.html (pełny ekran, Anuluj / tytuł / Zapisz): chipy rodzaju,
// dystans i czas −/+ (można też wpisać), tempo liczone, trudność 1–10 z opisem, dzień, „Pokaż w kalendarzu
// głównym”, notatka. Zasady zapisu jak w RunDialog (web): ten sam ładunek saveRun i te same komunikaty —
// zmieniając jedno okno, popraw drugie. Zapis nieoptymistyczny: w trakcie Anuluj i Esc są zablokowane.
import { useRef, useState } from "react";
import { Dialog } from "radix-ui";

import {
  Chip,
  DatePicker,
  Switch,
  TimePicker,
  type IsoDate,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { saveRun, type RunInput } from "../actions";
import type { SportProfile } from "../load-sport";
import {
  formatDuration,
  formatKm,
  formatPace,
  paceSPerKm,
  parseDuration,
  parseKm,
  type RunKind,
  type SportItem,
} from "../model";
import { RODZAJE } from "../run-dialog";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const BLAD_DYSTANSU = "Podaj dystans w km, np. 10,5.";
const BLAD_CZASU = "Podaj czas jako h:mm:ss albo mm:ss, np. 58:00.";
// Wartości startowe i kroki −/+ z makiety (10,0 km, 52:00; 0,5 km, 1 min; minimum 0,5 km i 1 min)
const DYSTANS_START = 10;
const CZAS_START = 3120;
const KROK_KM = 0.5;
const KROK_S = 60;

const ETYKIETA =
  "font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase";
const WIERSZ =
  "flex min-h-[52px] items-center gap-3 border-b border-[#f0f0f0] px-3.5 last:border-b-0";
const NAGLOWEK_PRZYCISK =
  "flex h-11 cursor-pointer items-center border-0 bg-transparent px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20";
const PLUS_MINUS =
  "inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border border-[#e0e0e0] bg-white p-0 text-[15px] text-[#171717] outline-none hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-[#171717]/20";
const WARTOSC =
  "box-border h-11 w-[84px] rounded-md border border-transparent bg-transparent px-1 text-center font-mono text-lg text-[#171717] outline-none placeholder:text-[#a3a3a3] focus:border-[#171717]";

type Bledy = Partial<Record<keyof RunInput, string>>;

export function MRunNew({
  item,
  date,
  start,
  today,
  profile,
  onClose,
}: {
  // Bieg do edycji; null = nowy bieg
  item: SportItem | null;
  // Data i godzina startu (nowy bieg: z adresu; edycja: z biegu)
  date: IsoDate;
  start: string;
  today: IsoDate;
  profile: SportProfile;
  onClose: () => void;
}) {
  const [kind, setKind] = useState<RunKind>(item?.runKind ?? "easy");
  const [dzien, setDzien] = useState<IsoDate | null>(date);
  const [godzina, setGodzina] = useState(start);
  // Nowy bieg: wartości z makiety; bieg w przyszłości startuje bez czasu (zapisze się jako plan)
  const [dystans, setDystans] = useState(
    item === null
      ? formatKm(DYSTANS_START)
      : item.distanceKm !== null
        ? Number.isInteger(item.distanceKm)
          ? formatKm(item.distanceKm)
          : String(item.distanceKm).replace(".", ",")
        : "",
  );
  const [czas, setCzas] = useState(
    item === null
      ? date > today
        ? ""
        : formatDuration(CZAS_START)
      : item.durationS !== null
        ? formatDuration(item.durationS)
        : "",
  );
  const [trudnosc, setTrudnosc] = useState<number | null>(
    item?.difficulty ?? null,
  );
  const [notatka, setNotatka] = useState(item?.note ?? "");
  const [wKalendarzu, setWKalendarzu] = useState(item?.showInCalendar ?? true);
  const [bledy, setBledy] = useState<Bledy>({});
  const [blad, setBlad] = useState("");
  const [pending, setPending] = useState(false);
  // Blokada podwójnego zapisu (dwa szybkie stuknięcia, zanim stan pending się odświeży)
  const zapisuje = useRef(false);

  const km = parseKm(dystans);
  const sekundy = parseDuration(czas);
  const tempo =
    km !== null && km > 0 && sekundy !== null && sekundy > 0
      ? `${formatPace(paceSPerKm(km, sekundy))} /km`
      : "—";

  // Progi opisu trudności z makiety
  let opisTrudnosci = "";
  if (trudnosc !== null) {
    opisTrudnosci =
      trudnosc <= 3
        ? "lekko"
        : trudnosc <= 6
          ? "umiarkowanie"
          : trudnosc <= 8
            ? "ciężko"
            : "maksymalnie";
  }

  const tytul =
    item === null
      ? "Nowy bieg"
      : item.planned
        ? "Uzupełnij dane biegu"
        : "Edytuj bieg";

  // −/+: puste albo nieczytelne pole bierze wartość startową z makiety
  function zmienDystans(kierunek: 1 | -1) {
    if (km === null) {
      setDystans(formatKm(DYSTANS_START));
      return;
    }
    // Krok od najbliższej wielokrotności 0,5 km (10,37 → 10,5 albo 10,0)
    const polowki =
      kierunek === 1
        ? Math.floor(km / KROK_KM + 1e-9) + 1
        : Math.ceil(km / KROK_KM - 1e-9) - 1;
    setDystans(formatKm(Math.max(KROK_KM, polowki * KROK_KM)));
  }
  function zmienCzas(kierunek: 1 | -1) {
    if (sekundy === null) {
      setCzas(formatDuration(CZAS_START));
      return;
    }
    const minuty =
      kierunek === 1
        ? Math.floor(sekundy / KROK_S) + 1
        : Math.ceil(sekundy / KROK_S) - 1;
    setCzas(formatDuration(Math.max(KROK_S, minuty * KROK_S)));
  }

  async function zapisz() {
    if (zapisuje.current) return;
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

    zapisuje.current = true;
    setPending(true);
    setBledy({});
    setBlad("");
    // Ładunek jak w RunDialog
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
        // Po sukcesie arkusz zostaje zablokowany aż do zamknięcia
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
    zapisuje.current = false;
    setPending(false);
  }

  return (
    // W trakcie zapisu arkusz się nie zamyka (Esc)
    <Dialog.Root
      open
      onOpenChange={(otwarte) => !otwarte && !pending && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-white text-[15px] text-[#171717] outline-none"
        >
          <div className="flex min-h-[60px] flex-none items-center gap-1 border-b border-[#f0f0f0] p-2">
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              className={cn(
                NAGLOWEK_PRZYCISK,
                "text-[#666666] disabled:cursor-default disabled:opacity-50",
              )}
            >
              Anuluj
            </button>
            <Dialog.Title className="m-0 flex-1 text-center text-[15px] font-semibold">
              {tytul}
            </Dialog.Title>
            <button
              type="button"
              disabled={pending}
              onClick={() => void zapisz()}
              className={cn(
                NAGLOWEK_PRZYCISK,
                "font-semibold disabled:cursor-default disabled:text-[#a3a3a3]",
              )}
            >
              Zapisz
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-[18px] pb-6">
            {blad && (
              <p role="alert" className="m-0 text-xs text-[#b91c1c]">
                {blad}
              </p>
            )}

            <div className="flex flex-col gap-2">
              <span className={ETYKIETA}>Rodzaj</span>
              <div
                role="group"
                aria-label="Rodzaj biegu"
                className="flex flex-wrap gap-2"
              >
                {RODZAJE.map((r) => (
                  <Chip
                    key={r.kind}
                    variant="solid"
                    selected={kind === r.kind}
                    onClick={() => setKind(r.kind)}
                  >
                    {r.label}
                  </Chip>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="rounded-xl border border-[#eaeaea] bg-white">
                <div className={cn(WIERSZ, "min-h-16 gap-2")}>
                  <label htmlFor="m-bieg-dystans" className="flex-1">
                    Dystans
                  </label>
                  <button
                    type="button"
                    aria-label="Mniej"
                    onClick={() => zmienDystans(-1)}
                    className={PLUS_MINUS}
                  >
                    −
                  </button>
                  <span className="flex items-baseline">
                    <input
                      id="m-bieg-dystans"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      aria-label="Dystans (km)"
                      placeholder="—"
                      value={dystans}
                      onChange={(e) => setDystans(e.target.value)}
                      className={cn(WARTOSC, "w-[64px] text-right")}
                    />
                    <span className="pr-1 pl-1 font-mono text-lg">km</span>
                  </span>
                  <button
                    type="button"
                    aria-label="Więcej"
                    onClick={() => zmienDystans(1)}
                    className={PLUS_MINUS}
                  >
                    +
                  </button>
                </div>
                <div className={cn(WIERSZ, "min-h-16 gap-2")}>
                  <label htmlFor="m-bieg-czas" className="flex-1">
                    Czas
                  </label>
                  <button
                    type="button"
                    aria-label="Krócej"
                    onClick={() => zmienCzas(-1)}
                    className={PLUS_MINUS}
                  >
                    −
                  </button>
                  <input
                    id="m-bieg-czas"
                    type="text"
                    autoComplete="off"
                    aria-label="Czas"
                    placeholder="—"
                    value={czas}
                    onChange={(e) => setCzas(e.target.value)}
                    className={cn(WARTOSC, "w-[100px]")}
                  />
                  <button
                    type="button"
                    aria-label="Dłużej"
                    onClick={() => zmienCzas(1)}
                    className={PLUS_MINUS}
                  >
                    +
                  </button>
                </div>
                <div className={cn(WIERSZ, "bg-[#fafafa]")}>
                  <span className="flex-1 text-[13px] text-[#666666]">
                    Tempo (liczone)
                  </span>
                  <span
                    data-testid="tempo"
                    className="font-mono text-lg font-medium"
                  >
                    {tempo}
                  </span>
                </div>
              </div>
              {bledy.distanceKm && (
                <p className="m-0 text-xs text-[#b91c1c]">{bledy.distanceKm}</p>
              )}
              {bledy.durationS && (
                <p className="m-0 text-xs text-[#b91c1c]">{bledy.durationS}</p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className={ETYKIETA}>
                {trudnosc === null ? "Trudność" : `Trudność · ${opisTrudnosci}`}
              </span>
              <div className="grid grid-cols-10 gap-1">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={trudnosc === n}
                    aria-label={`Trudność ${n} z 10`}
                    // Ponowne stuknięcie czyści (trudność jest opcjonalna)
                    onClick={() => setTrudnosc(trudnosc === n ? null : n)}
                    className={cn(
                      "h-11 min-w-0 cursor-pointer rounded-lg border p-0 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20",
                      trudnosc === n
                        ? "border-[#171717] bg-[#171717] text-white"
                        : "border-[#e0e0e0] bg-white text-[#171717]",
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {bledy.difficulty && (
                <p className="m-0 text-xs text-[#b91c1c]">{bledy.difficulty}</p>
              )}
            </div>

            <div className="rounded-xl border border-[#eaeaea] bg-white">
              <div className={cn(WIERSZ, "flex-wrap py-2")}>
                <span className="flex-1">Dzień</span>
                <DatePicker
                  value={dzien}
                  onChange={setDzien}
                  weekStart={profile.weekStart}
                  ariaLabel="Data"
                />
                <TimePicker
                  value={godzina}
                  onChange={setGodzina}
                  ariaLabel="Start"
                  clock={profile.clock}
                />
              </div>
              <div className={WIERSZ}>
                <span className="flex-1">Pokaż w kalendarzu głównym</span>
                <Switch
                  checked={wKalendarzu}
                  onChange={setWKalendarzu}
                  ariaLabel="Pokaż w kalendarzu głównym"
                />
              </div>
            </div>
            {bledy.date && (
              <p className="-mt-3 mb-0 text-xs text-[#b91c1c]">{bledy.date}</p>
            )}

            <label className="flex flex-col gap-1.5 text-[13px] font-medium">
              Notatka
              <textarea
                rows={3}
                placeholder="Jak poszło?"
                value={notatka}
                onChange={(e) => setNotatka(e.target.value)}
                className="box-border h-[88px] w-full resize-none rounded-[10px] border border-[#e0e0e0] bg-white px-3.5 py-3 text-[15px] font-normal text-[#171717] outline-none placeholder:text-[#a3a3a3] focus:border-[#171717]"
              />
            </label>
            {bledy.note && (
              <p className="-mt-3 mb-0 text-xs text-[#b91c1c]">{bledy.note}</p>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
