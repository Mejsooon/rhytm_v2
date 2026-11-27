"use client";

// Okno „Szybko dodaj” wg S2QuickAdd: jedno pole, podgląd „Rozumiem to tak”, przykłady.
// Enter zapisuje istniejącą akcją modułu, Esc zamyka.
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";

import { Button, Chip, Kbd } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { createBlock } from "@/features/calendar/actions";
import { createHabit, saveSleepLog } from "@/features/habits/actions";
import type { SleepLog } from "@/features/habits/sleep";
import { createGymSession, saveRun } from "@/features/sport/actions";
import type { ActivityKind } from "@/features/sport/activities";
import { saveActivity } from "@/features/sport/activity-actions";
import type { ActionResult } from "@/lib/action-result";
import { parseQuickAdd, type QuickAdd } from "./quick-add";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const PRZYKLADY = [
  "bieg 10 km jutro 18:00",
  "siłownia push pt 17:00",
  "tenis sob 10–12",
  "blok nauka matma jutro 8–10",
  "sen 23:40–7:10",
  "nawyk woda 2 l",
];

const TYPY: Record<QuickAdd["type"], { nazwa: string; zapisz: string; kolor: string; opis: string }> = {
  run: { nazwa: "Bieg", zapisz: "Zapisz bieg", kolor: "bg-[rgba(245,158,11,.14)] text-[#b45309]", opis: "Zapiszemy jako zaplanowany bieg w Sporcie i w kalendarzu. Czas i tempo uzupełnisz po treningu." },
  gym: { nazwa: "Siłownia", zapisz: "Zaplanuj trening", kolor: "bg-black/[.06] text-[#404040]", opis: "Zaplanujemy trening. W dniu treningu klikniesz Rozpocznij i odhaczysz serie." },
  other: { nazwa: "Aktywność", zapisz: "Zapisz aktywność", kolor: "bg-black/[.06] text-[#404040]", opis: "Zapiszemy jako aktywność w Sporcie, w jej kolorze." },
  sleep: { nazwa: "Sen", zapisz: "Zapisz sen", kolor: "bg-[rgba(79,70,229,.1)] text-[#4338ca]", opis: "Zapiszemy jako ostatnią noc w Nawykach i śnie." },
  habit: { nazwa: "Nawyk", zapisz: "Dodaj nawyk", kolor: "bg-success-soft text-success", opis: "Dodamy nowy nawyk do odhaczania na ekranie Dziś." },
  block: { nazwa: "Blok", zapisz: "Zapisz blok", kolor: "bg-black/[.05] text-muted-foreground", opis: "Zapiszemy jako blok w kalendarzu. Kategorię i zadania dodasz w dymku bloku." },
};

const gg = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

export function QuickAddDialog({
  today,
  nowMin,
  templates,
  kinds,
  sleepLogs,
  onFullForm,
  onClose,
  initialText = "",
}: {
  today: IsoDate;
  nowMin: number;
  templates: { id: string; name: string }[];
  kinds: ActivityKind[];
  // Wpis z dzisiejszej nocy: samopoczucie, tagi i notatka zostają po zmianie godzin
  sleepLogs: SleepLog[];
  onFullForm: (typ: QuickAdd["type"]) => void;
  onClose: () => void;
  // Tekst wpisany wcześniej w oknie szukania
  initialText?: string;
}) {
  const router = useRouter();
  const [tekst, setTekst] = useState(initialText);
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego zapisu (dwa Entery, zanim stan pending się odświeży)
  const zapisuje = useRef(false);

  const p = parseQuickAdd(tekst, today, templates, kinds);
  const typ = TYPY[p.type];
  // Domyślna godzina: dziś najbliższa pełna, w inne dni 9:00 (blok) albo 18:00 (trening)
  const start =
    p.startMin ??
    (p.date === today
      ? Math.min((Math.floor(nowMin / 60) + 1) * 60, 23 * 60)
      : p.type === "block"
        ? 9 * 60
        : 18 * 60);
  const dlugosc = p.endMin === null || p.startMin === null ? null : (p.endMin - p.startMin + 1440) % 1440;
  const czas = dlugosc === null ? "—" : `${Math.floor(dlugosc / 60)} h${dlugosc % 60 ? ` ${dlugosc % 60} min` : ""}`;

  const dzien =
    p.type === "sleep"
      ? "ostatnia noc"
      : `${p.date === today ? "dziś " : ""}${p.date.slice(8, 10)}.${p.date.slice(5, 7)}`;
  const godziny =
    p.type === "habit"
      ? "—"
      : p.type === "sleep"
        ? p.startMin !== null && p.endMin !== null
          ? `${gg(p.startMin)}–${gg(p.endMin)}`
          : "—"
        : p.endMin !== null && p.startMin !== null
          ? `${gg(p.startMin)}–${gg(p.endMin)}`
          : gg(start);
  const czwarta: [string, string] =
    p.type === "run"
      ? ["Dystans", p.distanceKm === null ? "—" : `${String(p.distanceKm).replace(".", ",")} km`]
      : p.type === "gym"
        ? ["Szablon", p.template?.name ?? "pusty"]
        : p.type === "habit"
          ? ["Powtarzanie", "codziennie"]
          : ["Czas trwania", czas];

  const puste = tekst.trim() === "";

  async function zapisz() {
    if (puste || zapisuje.current) return;
    const brak =
      (p.type === "block" || p.type === "habit") && p.title === ""
        ? "Dopisz nazwę."
        : p.type === "sleep" && (p.startMin === null || p.endMin === null)
          ? "Podaj godziny snu, np. 23:40–7:10."
          : p.type === "block" && p.endMin !== null && p.startMin !== null && p.endMin <= p.startMin
            ? "Blok nie może przechodzić przez północ."
            : "";
    if (brak) {
      setBlad(brak);
      return;
    }
    zapisuje.current = true;
    setPending(true);
    setBlad("");
    let wynik: ActionResult;
    try {
      if (p.type === "run") {
        wynik = await saveRun({ kind: p.runKind, date: p.date, start: gg(start), distanceKm: p.distanceKm, durationS: null, difficulty: null, note: "", showInCalendar: true });
      } else if (p.type === "gym") {
        wynik = await createGymSession({ date: p.date, start: gg(start), templateId: p.template?.id });
      } else if (p.type === "other") {
        const k = p.activity!;
        wynik = await saveActivity({ kind: k.name, color: k.color, hasDistance: k.hasDistance, done: false, date: p.date, start: gg(start), durationS: dlugosc ? dlugosc * 60 : null, distanceKm: k.hasDistance ? p.distanceKm || null : null, difficulty: null, note: "", showInCalendar: true });
      } else if (p.type === "sleep") {
        const wpis = sleepLogs.find((l) => l.date === today);
        wynik = await saveSleepLog({ date: today, sleptAt: gg(p.startMin!), wokeAt: gg(p.endMin!), feeling: wpis?.feeling ?? null, tags: wpis?.tags ?? [], note: wpis?.note ?? null } as Parameters<typeof saveSleepLog>[0]);
      } else if (p.type === "habit") {
        wynik = await createHabit({ name: p.title, schedule: { type: "daily", weekdays: [], timesPerWeek: null }, remindAt: null, showOnToday: true });
      } else {
        wynik = await createBlock({ title: p.title, categoryId: null, date: p.date, startMin: start, durationMin: dlugosc ?? Math.min(60, 1440 - start), recurrence: null, note: "", remind: true });
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
    toast.success("Dodano");
    router.refresh();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="top-[111px] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-[638px]">
        <DialogTitle className="sr-only">Szybkie dodawanie</DialogTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void zapisz();
          }}
        >
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <Plus size={16} aria-hidden="true" className="text-success" />
            <input
              autoFocus
              value={tekst}
              onChange={(e) => {
                setTekst(e.target.value);
                setBlad("");
              }}
              aria-label="Co dodać?"
              placeholder="Np. bieg 10 km jutro 18:00"
              maxLength={80}
              className="min-w-0 flex-1 border-0 bg-transparent text-base outline-none"
            />
            <Kbd>esc</Kbd>
          </div>

          <div className="flex flex-col gap-3 p-4">
            {!puste && (
              <>
                <span className="text-xs font-medium text-muted-foreground">Rozumiem to tak</span>
                <dl data-testid="rozumiem" className="m-0 grid grid-cols-4 divide-x divide-border rounded-lg border border-border">
                  {[
                    ["Typ", p.type === "other" ? p.activity!.name : typ.nazwa],
                    ["Dzień", dzien],
                    [p.type === "sleep" ? "Od – do" : p.endMin !== null ? "Godziny" : "Godzina", godziny],
                    czwarta,
                  ].map(([etykieta, wartosc], i) => (
                    <div key={etykieta} className="px-3.5 py-2.5">
                      <dt className="text-xs text-muted-foreground">{etykieta}</dt>
                      <dd className="m-0 mt-1 flex items-center gap-2 text-base tabular-nums">
                        {i === 0 && (
                          <span aria-hidden="true" className={`grid size-6 flex-none place-items-center rounded-[6px] text-xs font-semibold ${typ.kolor}`}>
                            {wartosc[0]}
                          </span>
                        )}
                        {wartosc}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="m-0 text-[13px] text-muted-foreground">{typ.opis}</p>
              </>
            )}
            {blad && (
              <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
                {blad}
              </p>
            )}
            <span className="text-xs font-medium text-muted-foreground">Przykłady</span>
            <div className="flex flex-wrap gap-1.5">
              {PRZYKLADY.map((x) => (
                <Chip key={x} selected={x === tekst} onClick={() => setTekst(x)}>
                  {x}
                </Chip>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/50 px-6 py-4">
            <Button type="button" onClick={() => onFullForm(p.type)}>
              Otwórz pełny formularz
            </Button>
            <div className="flex items-center gap-2">
              <Kbd>↵</Kbd>
              <span className="text-xs text-muted-foreground">zapisz</span>
              <Button type="submit" variant="primary" disabled={puste || pending}>
                {typ.zapisz}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
