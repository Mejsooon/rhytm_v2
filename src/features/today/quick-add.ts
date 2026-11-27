// Parser okna „Szybko dodaj” (skrypt makiety S2QuickAdd): z jednego zdania wyciąga typ, dzień,
// godziny i dystans. Czysta funkcja; daty to 'YYYY-MM-DD', godziny to minuty od północy.
import type { IsoDate } from "@/components/controls/calendar-math";
import { addDays, weekdayOf } from "@/features/calendar/view-range";
import type { ActivityKind } from "@/features/sport/activities";
import { parseQuickRun } from "./model";

export type QuickAdd = {
  type: "run" | "gym" | "other" | "sleep" | "habit" | "block";
  date: IsoDate;
  // null = w tekście nie było godziny
  startMin: number | null;
  endMin: number | null;
  distanceKm: number | null;
  runKind: ReturnType<typeof parseQuickRun>["kind"];
  template: { id: string; name: string } | null;
  activity: ActivityKind | null;
  // Nazwa bloku albo nawyku: tekst bez słów sterujących, dni i godzin
  title: string;
};

// Skróty dni jak w makiecie; indeks 1 = poniedziałek
const DNI: [string, number][] = [
  ["pn", 1],
  ["wt", 2],
  ["śr", 3],
  ["czw", 4],
  ["pt", 5],
  ["sob", 6],
  ["nd", 7],
];

// „8”, „8:30” → minuty; poza zakresem doby → null
function minuty(tekst: string): number | null {
  const [h, m = "0"] = tekst.split(":");
  const wynik = Number(h) * 60 + Number(m);
  return Number(h) > 23 || Number(m) > 59 ? null : wynik;
}

export function parseQuickAdd(
  text: string,
  today: IsoDate,
  templates: { id: string; name: string }[],
  kinds: ActivityKind[],
): QuickAdd {
  const maly = ` ${text.toLowerCase()} `;
  const slowo = (s: string) => maly.includes(` ${s} `);

  let date = today;
  if (slowo("jutro")) date = addDays(today, 1);
  for (const [skrot, nr] of DNI) {
    // Następny taki dzień po dziś (w „dzisiejszy” dzień tygodnia = za tydzień)
    if (slowo(skrot)) date = addDays(today, ((nr - weekdayOf(today) + 6) % 7) + 1);
  }

  const zakres = maly.match(/(\d{1,2}(?::\d{2})?)\s?[–-]\s?(\d{1,2}(?::\d{2})?)/);
  const jedna = maly.match(/\d{1,2}:\d{2}/);
  let startMin: number | null = null;
  let endMin: number | null = null;
  if (zakres) {
    const od = minuty(zakres[1]);
    const doKtorej = minuty(zakres[2]);
    if (od !== null && doKtorej !== null) {
      startMin = od;
      endMin = doKtorej;
    }
  } else if (jedna) {
    startMin = minuty(jedna[0]);
  }

  const template = templates.find((t) => maly.includes(t.name.toLowerCase())) ?? null;
  const activity = kinds.find((k) => maly.includes(k.name.toLowerCase())) ?? null;
  const blok = maly.startsWith(" blok ");
  const nawyk = maly.startsWith(" nawyk ");
  const type: QuickAdd["type"] = blok
    ? "block"
    : nawyk
      ? "habit"
      : /bieg/.test(maly)
        ? "run"
        : /siłown|silown|trening/.test(maly)
          ? "gym"
          : activity
            ? "other"
            : slowo("sen")
              ? "sleep"
              : template
                ? "gym"
                : "block";

  const { distanceKm, kind } = parseQuickRun(text);
  const title = text
    .replace(/^\s*(blok|nawyk)(\s+|$)/i, "")
    .replace(/(\d{1,2}(:\d{2})?)\s?[–-]\s?(\d{1,2}(:\d{2})?)|\d{1,2}:\d{2}/g, "")
    .split(/\s+/)
    .filter((s) => s !== "" && s.toLowerCase() !== "jutro" && s.toLowerCase() !== "dziś" && !DNI.some(([d]) => d === s.toLowerCase()))
    .join(" ");

  return {
    type,
    date,
    startMin,
    endMin,
    distanceKm,
    runKind: kind,
    template: type === "gym" ? template : null,
    activity: type === "other" ? activity : null,
    title: title === "" ? "" : title[0].toUpperCase() + title.slice(1),
  };
}
