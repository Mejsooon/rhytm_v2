"use client";

// Arkusz szybkiego dodawania na telefonie wg MQuickAdd.dc.html (pływający „+” w MToday).
// Segment Blok / Bieg / Nawyk, jedno pole, chipy „Kiedy” zależne od typu
// (quickWhenOptions w model.ts) i „Dodaj”. Zapis nie jest optymistyczny: pending, błąd zostaje
// w arkuszu, a po sukcesie arkusz się zamyka, pokazuje toast „Dodano” i odświeża Dziś.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, PenLine, XIcon } from "lucide-react";
import { Dialog } from "radix-ui";
import { toast } from "sonner";

import { Button, Chip, Segment } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { createBlock } from "@/features/calendar/actions";
import type { CategoryRow } from "@/features/calendar/load-calendar";
import { createHabit } from "@/features/habits/actions";
import { saveRun } from "@/features/sport/actions";
import type { ActionResult } from "@/lib/action-result";
import { parseQuickRun, quickWhenOptions, type QuickKind } from "../model";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// Napisy segmentu, etykiety pola i placeholdery dosłownie z makiety
const RODZAJE: {
  value: QuickKind;
  label: string;
  pole: string;
  placeholder: string;
}[] = [
  {
    value: "block",
    label: "Blok",
    pole: "Blok w kalendarzu",
    placeholder: "Nazwa bloku, np. Nauka SQL",
  },
  {
    value: "run",
    label: "Bieg",
    pole: "Bieg",
    placeholder: "Np. 8 km spokojnie",
  },
  {
    value: "habit",
    label: "Nawyk",
    pole: "Nawyk",
    placeholder: "Np. Woda 2 l",
  },
];

const ETYKIETA =
  "font-mono text-[11px] tracking-[.06em] text-muted-foreground uppercase";
const LINK =
  "flex min-h-11 items-center gap-2 text-sm text-soft-foreground outline-none focus-visible:shadow-focus";

export function MQuickAdd({
  today,
  nowMin,
  weekStart,
  categories,
  onClose,
}: {
  // „Dziś” i „teraz” w strefie profilu (chipy „Kiedy” liczą się od nich)
  today: IsoDate;
  nowMin: number;
  weekStart: "mon" | "sun";
  categories: CategoryRow[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [rodzaj, setRodzaj] = useState<QuickKind>("block");
  const [tekst, setTekst] = useState("");
  // Wybrany chip po etykiecie: zmiana typu zostawia „Jutro”, a chipa, którego już nie ma, zastępuje pierwszy
  const [kiedy, setKiedy] = useState("Dziś");
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego zapisu (dwa szybkie stuknięcia, zanim stan pending się odświeży)
  const zapisuje = useRef(false);

  const opis = RODZAJE.find((r) => r.value === rodzaj)!;
  const opcje = quickWhenOptions(rodzaj, today, nowMin, weekStart);
  const wybrana = opcje.find((o) => o.label === kiedy) ?? opcje[0] ?? null;
  const tytul = tekst.trim();
  const mozeDodac = tytul !== "" && !pending;

  // Godzina startu do akcji i adresów: „HH:MM” (24 h)
  const godzina =
    wybrana?.startMin != null
      ? `${String(Math.floor(wybrana.startMin / 60)).padStart(2, "0")}:${String(wybrana.startMin % 60).padStart(2, "0")}`
      : "";

  async function dodaj() {
    if (!mozeDodac || zapisuje.current) return;
    zapisuje.current = true;
    setPending(true);
    setBlad("");
    let wynik: ActionResult;
    try {
      if (rodzaj === "block") {
        // Pierwsza niesystemowa i nieukryta kategoria wg pozycji; bez takiej blok jest bez kategorii
        const kategoria =
          categories
            .filter((k) => !k.is_system && !k.hidden)
            .sort((a, b) => a.position - b.position)[0] ?? null;
        wynik = await createBlock({
          title: tytul,
          categoryId: kategoria?.id ?? null,
          date: wybrana!.date!,
          startMin: wybrana!.startMin!,
          durationMin: 60,
          recurrence: null,
          note: "",
          remind: true,
        });
      } else if (rodzaj === "run") {
        // Plan (bez czasu): dystans i rodzaj z tekstu
        const { distanceKm, kind } = parseQuickRun(tytul);
        wynik = await saveRun({
          kind,
          date: wybrana!.date!,
          start: godzina,
          distanceKm,
          durationS: null,
          difficulty: null,
          note: "",
          showInCalendar: true,
        });
      } else {
        wynik = await createHabit({
          name: tytul,
          schedule: { type: "daily", weekdays: [], timesPerWeek: null },
          remindAt: null,
          showOnToday: true,
        });
      }
    } catch {
      wynik = { ok: false, message: BLAD_ZAPISU };
    }
    zapisuje.current = false;
    setPending(false);
    if (!wynik.ok) {
      setBlad(wynik.message);
      return;
    }
    onClose();
    toast.success("Dodano");
    // Akcje odświeżają swoje moduły, więc Dziś pobiera dane sam
    router.refresh();
  }

  // Pełne formularze: blok z tytułem z pola, bieg z datą i godziną
  const pelnyBlok =
    rodzaj === "block" && wybrana?.date
      ? `/kalendarz?nowy=blok&data=${wybrana.date}&godzina=${godzina}${tytul ? `&tytul=${encodeURIComponent(tytul)}` : ""}`
      : null;
  const pelnyBieg =
    rodzaj === "run" && wybrana?.date
      ? `/sport?nowy=bieg&data=${wybrana.date}&godzina=${godzina}`
      : null;

  return (
    // W trakcie zapisu arkusz się nie zamyka (nakładka, Esc)
    <Dialog.Root
      open
      onOpenChange={(otwarte) => !otwarte && !pending && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[92%] flex-col rounded-t-[18px] bg-white text-[15px] text-foreground shadow-[0_-8px_30px_rgba(0,0,0,.12)] outline-none"
        >
          {/* Uchwyt arkusza */}
          <div
            aria-hidden="true"
            className="mx-auto mt-2 mb-0.5 h-[5px] w-9 flex-none rounded-[3px] bg-border-strong"
          />
          <div className="flex items-center py-1 pr-2 pl-5">
            <Dialog.Title className="m-0 flex-1 text-[17px] font-semibold">
              Szybko dodaj
            </Dialog.Title>
            <button
              type="button"
              aria-label="Zamknij"
              disabled={pending}
              onClick={onClose}
              className="flex size-11 flex-none cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-0 text-foreground outline-none hover:bg-muted focus-visible:shadow-focus"
            >
              <XIcon aria-hidden="true" className="size-5" />
            </button>
          </div>

          <div className="flex min-h-0 flex-col gap-4 overflow-y-auto px-4 pt-1 pb-6">
            <Segment
              ariaLabel="Rodzaj"
              value={rodzaj}
              onChange={(r) => {
                setRodzaj(r);
                setBlad("");
              }}
              options={RODZAJE}
            />

            <label className="flex flex-col gap-1.5 text-[13px]">
              <span className={ETYKIETA}>{opis.pole}</span>
              <input
                type="text"
                value={tekst}
                maxLength={120}
                placeholder={opis.placeholder}
                onChange={(e) => setTekst(e.target.value)}
                onKeyDown={(e) => {
                  // Enter dodaje (nie podczas składania znaków z klawiatury ekranowej)
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void dodaj();
                  }
                }}
                className="box-border h-[52px] w-full rounded-md border border-input bg-white px-3.5 text-[17px] text-foreground outline-none placeholder:text-faint-foreground focus:border-primary"
              />
            </label>

            {opcje.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className={ETYKIETA}>Kiedy</span>
                <div
                  role="group"
                  aria-label="Kiedy"
                  // Pionowy odstęp 5 px zostawia chipom pełne pole stuknięcia ≥ 44 px (wymóg ważniejszy niż 2 px z makiety)
                  className="flex gap-2 overflow-x-auto py-[5px]"
                >
                  {opcje.map((o) => (
                    <div key={o.label} className="flex-none">
                      <Chip
                        variant="solid"
                        selected={o.label === wybrana?.label}
                        onClick={() => setKiedy(o.label)}
                      >
                        {o.label}
                      </Chip>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {pelnyBlok && (
              <Link href={pelnyBlok} onClick={onClose} className={LINK}>
                <PenLine
                  aria-hidden="true"
                  className="size-4 flex-none text-muted-foreground"
                />
                Pełny formularz bloku (kategoria, zadania, powtarzanie)
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 flex-none text-faint-foreground"
                />
              </Link>
            )}
            {pelnyBieg && (
              <Link href={pelnyBieg} onClick={onClose} className={LINK}>
                <PenLine
                  aria-hidden="true"
                  className="size-4 flex-none text-muted-foreground"
                />
                Pełny formularz biegu (dystans, tempo)
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 flex-none text-faint-foreground"
                />
              </Link>
            )}

            {blad && (
              <p role="alert" className="m-0 text-xs text-destructive-foreground">
                {blad}
              </p>
            )}

            <Button
              variant="primary"
              disabled={!mozeDodac}
              onClick={() => void dodaj()}
              className="w-full font-medium disabled:cursor-default disabled:opacity-50"
            >
              Dodaj
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
