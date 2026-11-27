"use client";

// „Pierwsze kroki” na Dziś wg S2EmptyToday: 6 kroków, każdy zalicza się z danych albo ręcznie.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { toast } from "sonner";

import { Button, Card, StatusBadge } from "@/components/controls";
import type { ActionResult } from "@/lib/action-result";
import { setFirstStep, setFirstStepsHidden } from "./actions";
import type { FirstStepKey } from "./first-steps-model";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// Teksty z makiety; `href` = strona, bez niego krok otwiera okno na Dziś
const KROKI: { k: FirstStepKey; title: string; sub: string; cta: string; href?: string }[] = [
  { k: "profil", title: "Uzupełnij profil", sub: "Nazwa, waga i wzrost do liczenia kcal biegów.", cta: "Otwórz", href: "/ustawienia" },
  { k: "blok", title: "Dodaj pierwszy blok w kalendarzu", sub: "Zaplanuj czas i wpisz zadania na ten blok.", cta: "Dodaj blok" },
  { k: "nawyk", title: "Utwórz pierwszy nawyk", sub: "Codziennie albo w wybrane dni tygodnia.", cta: "Nowy nawyk" },
  { k: "trening", title: "Zapisz trening", sub: "Bieg albo siłownia. Pojawi się też w kalendarzu.", cta: "Nowy bieg" },
  { k: "push", title: "Włącz powiadomienia", sub: "Przypomnienia nawyków, start bloku, odnowienia.", cta: "Włącz", href: "/ustawienia/powiadomienia" },
  { k: "strona", title: "Utwórz stronę z szablonu", sub: "Książki, Subskrypcje, Projekty albo pusta strona.", cta: "Wybierz szablon", href: "/strony/nowa" },
];

export function FirstSteps({
  done,
  onOpen,
}: {
  done: Record<FirstStepKey, boolean>;
  onOpen: (krok: "blok" | "nawyk" | "trening") => void;
}) {
  const router = useRouter();
  // Ręczne kliknięcia widać od razu; po odświeżeniu przychodzą już z serwera
  const [reczne, setReczne] = useState<Partial<Record<FirstStepKey, boolean>>>({});
  const [ukryta, setUkryta] = useState(false);
  const zrobione = (k: FirstStepKey) => reczne[k] ?? done[k];
  const ile = KROKI.filter((s) => zrobione(s.k)).length;

  async function zapisz(akcja: () => Promise<ActionResult>, cofnij: () => void) {
    const wynik = await akcja().catch(() => null);
    if (wynik?.ok) {
      router.refresh();
      return;
    }
    cofnij();
    toast.error(wynik?.message ?? BLAD_ZAPISU);
  }

  function ukryj(czy: boolean) {
    setUkryta(czy);
    // Bez odświeżenia przy ukrywaniu: pasek z „Pokaż” ma zostać na ekranie
    void setFirstStepsHidden(czy)
      .catch(() => null)
      .then((wynik) => {
        if (wynik?.ok) return;
        setUkryta(!czy);
        toast.error(wynik?.message ?? BLAD_ZAPISU);
      });
  }

  if (ukryta) {
    return (
      <div role="status" className="flex max-w-[990px] items-center justify-between gap-3 rounded-lg border border-border px-4 py-2.5">
        <span className="text-muted-foreground">Lista „Pierwsze kroki” jest ukryta.</span>
        <Button size="sm" onClick={() => ukryj(false)}>
          Pokaż
        </Button>
      </div>
    );
  }
  if (ile === KROKI.length) return null;

  return (
    <section aria-labelledby="pierwsze-kroki" className="max-w-[990px]">
      <Card className="overflow-hidden p-0">
        <div className="flex items-start justify-between gap-3 border-b border-border px-6 pt-5">
          <div className="w-[360px] max-w-full">
            <h2 id="pierwsze-kroki" className="m-0 text-base leading-[1.3] font-semibold">
              Pierwsze kroki
            </h2>
            <p className="m-0 mt-1 text-muted-foreground">{`${ile} z ${KROKI.length} zrobione`}</p>
            <div role="progressbar" aria-label="Postęp pierwszych kroków" aria-valuemin={0} aria-valuemax={KROKI.length} aria-valuenow={ile} className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-black/[.06]">
              <span className="block h-full rounded-full bg-success" style={{ width: `${Math.round((ile / KROKI.length) * 100)}%` }} />
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => ukryj(true)}>
            Ukryj listę
          </Button>
        </div>
        <ul className="m-0 list-none p-0">
          {KROKI.map((s) => {
            const jest = zrobione(s.k);
            return (
              <li key={s.k} className="flex items-center gap-3 border-t border-black/[.06] px-4 py-3 first:border-t-0">
                <button
                  type="button"
                  aria-pressed={jest}
                  aria-label={`${jest ? "Odznacz" : "Oznacz jako zrobione"}: ${s.title}`}
                  onClick={() => {
                    setReczne((r) => ({ ...r, [s.k]: !jest }));
                    void zapisz(
                      () => setFirstStep(s.k, !jest),
                      () => setReczne((r) => ({ ...r, [s.k]: jest })),
                    );
                  }}
                  className={`grid size-5 flex-none cursor-pointer place-items-center rounded-full border p-0 outline-none focus-visible:shadow-focus ${jest ? "border-success bg-success text-white" : "border-input bg-white"}`}
                >
                  {jest && <Check size={12} aria-hidden="true" />}
                </button>
                <span className="min-w-0 flex-1">
                  <span className={`block font-medium ${jest ? "text-muted-foreground line-through" : ""}`}>{s.title}</span>
                  <span className="block text-xs text-muted-foreground">{s.sub}</span>
                </span>
                {jest ? (
                  <StatusBadge tone="green">Zrobione</StatusBadge>
                ) : s.href ? (
                  <Button size="sm" asChild>
                    <Link href={s.href}>{s.cta}</Link>
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => onOpen(s.k as "blok" | "nawyk" | "trening")}>
                    {s.cta}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </section>
  );
}
