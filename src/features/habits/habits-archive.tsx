"use client";

// Archiwum nawyków (S2HabitsArchive): przywracanie i usuwanie na zawsze.
import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { Button, Card } from "@/components/controls";
import { setHabitArchived } from "./actions";
import { DeleteHabitDialog } from "./delete-habit-dialog";
import type { HabitsPageData } from "./load-habits";
import { archivedSince, longestStreak, totalChecks, type Checks } from "./model";
import { streakLabel } from "./text";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

const odmien = (n: number) =>
  n === 1 ? "odhaczenie" : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? "odhaczenia" : "odhaczeń";

export function HabitsArchive({ data }: { data: HabitsPageData }) {
  const [usuwany, setUsuwany] = useState<{ id: string; name: string } | null>(null);
  const checks: Checks = new Map();
  for (const c of data.checks) {
    checks.set(c.habitId, (checks.get(c.habitId) ?? new Set()).add(c.date));
  }
  const wiersze = data.habits.flatMap((h) => {
    const od = archivedSince(h, data.today);
    return od ? [{ h, od }] : [];
  });

  async function przywroc(id: string, name: string) {
    const wynik = await setHabitArchived(id, false).catch(() => null);
    if (wynik?.ok) toast.success(`Przywrócono „${name}” — jest znów na liście nawyków.`);
    else toast.error(wynik?.message ?? BLAD_ZAPISU);
  }

  return (
    <div className="flex min-w-0 flex-col">
      <header className="flex min-h-14 items-center gap-1.5 border-b border-border px-6 text-sm text-muted-foreground">
        <Link href="/nawyki" className="text-muted-foreground no-underline hover:text-foreground">
          Nawyki i sen
        </Link>
        <span>/</span>
        <b className="font-medium text-foreground">Archiwum</b>
      </header>
      <div className="flex max-w-[820px] flex-col gap-4 px-6 py-7">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">Zarchiwizowane nawyki</h1>
          <p className="m-0 mt-1 text-muted-foreground">
            Nie liczą się do limitu i nie przypominają. Historia zostaje — po przywróceniu seria liczy się dalej.
          </p>
        </div>
        <Card className="p-0">
          {wiersze.length === 0 ? (
            <p className="m-0 px-5 py-4 text-muted-foreground">Archiwum jest puste.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {wiersze.map(({ h, od }) => {
                const ile = totalChecks(h.id, checks);
                return (
                  <li key={h.id} className="flex flex-wrap items-center gap-3 border-t border-border-soft px-5 py-3.5 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <Link href={`/nawyki/${h.id}`} className="font-medium text-foreground no-underline">
                        {h.name}
                      </Link>
                      <div className="text-xs text-muted-foreground tabular-nums">
                        {`zarchiwizowany ${od.slice(8, 10)}.${od.slice(5, 7)} · najdłuższa seria ${streakLabel(longestStreak(h, checks, data.today, data.weekStart))} · ${ile} ${odmien(ile)}`}
                      </div>
                    </div>
                    <Button size="sm" onClick={() => void przywroc(h.id, h.name)}>
                      Przywróć
                    </Button>
                    <Button size="sm" variant="destructive-outline" onClick={() => setUsuwany(h)}>
                      Usuń na zawsze
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <Link href="/nawyki" className="text-sm text-muted-foreground">
          ← Wróć do nawyków
        </Link>
      </div>
      {usuwany && (
        <DeleteHabitDialog
          habitId={usuwany.id}
          name={usuwany.name}
          open
          onOpenChange={(o) => !o && setUsuwany(null)}
          after="/nawyki/archiwum"
          onDeleted={() => setUsuwany(null)}
        />
      )}
    </div>
  );
}
