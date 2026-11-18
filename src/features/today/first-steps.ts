// Lista „Pierwsze kroki” z pustego Dziś (EmptyToday.dc.html): cztery kroki, każdy zrobiony,
// gdy w odpowiedniej tabeli jest choć jeden wpis.
export type FirstStep = {
  key: "block" | "habit" | "workout" | "sleep";
  title: string;
  hint: string | null;
  href: string;
  done: boolean;
};

export function firstSteps(counts: {
  blocks: number;
  habits: number;
  workouts: number;
  sleepLogs: number;
}): {
  steps: FirstStep[];
  doneCount: number;
} {
  const steps: FirstStep[] = [
    {
      key: "block",
      title: "Dodaj pierwszy blok w kalendarzu",
      hint: null,
      href: "/kalendarz",
      done: counts.blocks > 0,
    },
    {
      key: "habit",
      title: "Dodaj nawyk",
      hint: "np. woda, czytanie, rozciąganie",
      href: "/nawyki?nowy=nawyk",
      done: counts.habits > 0,
    },
    {
      key: "workout",
      title: "Zapisz trening",
      hint: "bieg albo siłownia",
      href: "/sport",
      done: counts.workouts > 0,
    },
    {
      key: "sleep",
      title: "Wpisz ostatnią noc",
      hint: "godzina zaśnięcia i pobudki",
      href: "/nawyki?nowy=sen",
      done: counts.sleepLogs > 0,
    },
  ];
  return { steps, doneCount: steps.filter((s) => s.done).length };
}
