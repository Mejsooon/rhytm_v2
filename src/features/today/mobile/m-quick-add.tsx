"use client";

// Arkusz szybkiego dodawania na telefonie wg CMQuickAdd.dc.html (pływający „+” w MToday).
// FormDialog z ✕, segment Blok / Bieg / Nawyk (bez „Zadanie”: zadanie należy do bloku), jedno pole, chipy „Kiedy” zależne od typu
// (quickWhenOptions w model.ts) i „Dodaj”. Zapis nie jest optymistyczny: pending, błąd zostaje
// w arkuszu, a po sukcesie arkusz się zamyka, pokazuje toast „Dodano” i odświeża Dziś.
import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, PenLine } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Chip,
  FormDialog,
  Segment,
  TextField,
} from "@/components/controls";
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
    <FormDialog
      open
      onOpenChange={(otwarte) => !otwarte && !pending && onClose()}
      title="Szybko dodaj"
      phoneHeader="close"
      footer={
        <Button
          variant="primary"
          disabled={!mozeDodac}
          onClick={() => void dodaj()}
          className="w-full font-medium disabled:cursor-default disabled:opacity-50"
        >
          Dodaj
        </Button>
      }
    >
      <Segment
        ariaLabel="Rodzaj"
        value={rodzaj}
        onChange={(r) => {
          setRodzaj(r);
          setBlad("");
        }}
        options={RODZAJE}
      />

      <TextField
        label={
          <span className="text-xs text-muted-foreground">{opis.pole}</span>
        }
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
      />

      {opcje.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Kiedy
          </span>
          <div
            role="group"
            aria-label="Kiedy"
            // Chipy 36 px; py-[5px] zostawia kontenerowi (overflow ucina pseudo-element) cel stuknięcia ≥ 44 px
            className="flex gap-2 overflow-x-auto px-0.5 py-[5px]"
          >
            {opcje.map((o) => (
              <div key={o.label} className="flex-none">
                <Chip
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
        <Link href={pelnyBlok} onClick={onClose} className="m-row px-0">
          <PenLine
            aria-hidden="true"
            className="size-4 flex-none text-muted-foreground"
          />
          <span className="flex-1">
            Pełny formularz bloku (kategoria, zadania, powtarzanie)
          </span>
          <ChevronRight
            aria-hidden="true"
            className="size-4 flex-none text-faint-foreground"
          />
        </Link>
      )}
      {pelnyBieg && (
        <Link href={pelnyBieg} onClick={onClose} className="m-row px-0">
          <PenLine
            aria-hidden="true"
            className="size-4 flex-none text-muted-foreground"
          />
          <span className="flex-1">Pełny formularz biegu (dystans, tempo)</span>
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
    </FormDialog>
  );
}
