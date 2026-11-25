// Dane testowe wspólne dla testów widoków kalendarza (nie trafia do bundla aplikacji).
import type { SportItem } from "@/features/sport/model";
import type { CategoryRow, RenewalItem } from "../load-calendar";
import type { Occurrence } from "../occurrences";

export function kategoria(
  id: string,
  name: string,
  color: string,
): CategoryRow {
  return {
    id,
    name,
    color,
    hidden: false,
    is_system: false,
    position: 1,
    user_id: "u1",
    created_at: null,
  };
}

export function wystapienie(
  key: string,
  date: string,
  startMin: number,
  durationMin: number,
  title: string,
  categoryId: string | null,
): Occurrence {
  return {
    key,
    blockId: key.split(":")[0],
    date,
    startMin,
    durationMin,
    title,
    categoryId,
    note: null,
    remind: false,
    recurring: false,
    recurrence: null,
    modified: false,
  };
}

// Podgląd treningu: domyślnie wykonany bieg 07:00, 58 min
export function trening(nadpisz: Partial<SportItem> = {}): SportItem {
  return {
    key: "s:s1",
    kind: "run",
    sessionId: "s1",
    templateId: null,
    date: "2026-11-17",
    startMin: 420,
    durationMin: 58,
    title: "Spokojny",
    planned: false,
    showInCalendar: true,
    distanceKm: 10,
    durationS: 3480,
    kcal: null,
    difficulty: null,
    runKind: "easy",
    note: null,
    ...nadpisz,
  };
}

// Plan z szablonu „Push” (czwartek 18:30, 90 min)
export function planZSzablonu(nadpisz: Partial<SportItem> = {}): SportItem {
  return trening({
    key: "t:t1:2026-11-19",
    kind: "gym",
    sessionId: null,
    templateId: "t1",
    date: "2026-11-19",
    startMin: 18 * 60 + 30,
    durationMin: 90,
    title: "Push",
    planned: true,
    distanceKm: null,
    durationS: null,
    runKind: null,
    ...nadpisz,
  });
}

// Odnowienie subskrypcji: domyślnie Netflix 43,00 zł / mies. w sobotę 21.11.2026
export function odnowienie(nadpisz: Partial<RenewalItem> = {}): RenewalItem {
  return {
    key: "f-ren:r1:2026-11-21",
    fieldId: "f-ren",
    pageId: "p1",
    pageTitle: "Subscriptions",
    rowId: "r1",
    date: "2026-11-21",
    next: "2026-12-21",
    title: "Netflix",
    amount: 43,
    cycle: "month",
    categoryName: "Kategoria",
    categoryLabel: "Rozrywka",
    ...nadpisz,
  };
}
