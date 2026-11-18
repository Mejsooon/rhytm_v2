import { describe, expect, it } from "vitest";
import { EXERCISE_LIBRARY, searchExercises } from "./library";
import {
  epley1rm,
  kgVsLast,
  lastSetsSummary,
  parseKgInput,
  parseRepsInput,
  firstReps,
  formatDuration,
  formatKg,
  formatLastUsed,
  formatRest,
  parseRest,
  plPlural,
  formatKm,
  formatPace,
  parseDuration,
  parseKm,
  formatVolume,
  monthGrid,
  paceSPerKm,
  recordSetIds,
  runKcal,
  runFormInput,
  sessionItems,
  sessionVolume,
  sportItemHref,
  templateOccurrences,
  templateSets,
  weekStats,
  type GymSetRow,
  type RunRow,
  type SessionRow,
  type SkipRow,
  type TemplateItemRow,
  type TemplateRow,
  type SportItem,
} from "./model";

const set = (o: Partial<GymSetRow>): GymSetRow => ({
  id: "x",
  user_id: "u",
  session_id: "s",
  exercise_id: "e1",
  exercise_position: 1,
  set_no: 1,
  weight_kg: 60,
  reps: 8,
  done: true,
  ...o,
});

describe("tempo i formatowanie", () => {
  it("liczy tempo i formatuje", () => {
    expect(paceSPerKm(10, 3480)).toBe(348);
    expect(formatPace(348)).toBe("5:48");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(formatDuration(2700)).toBe("45:00");
    expect(formatKm(8)).toBe("8,0");
    expect(formatKg(72.5)).toBe("72,5");
    expect(formatKg(null)).toBe("mc");
  });

  it("formatuje objętość z odstępem tysięcy i przecinkiem", () => {
    expect(formatVolume(5640)).toBe("5 640");
    expect(formatVolume(652.5)).toBe("652,5");
    expect(formatVolume(12345.25)).toBe("12 345,3");
    expect(formatVolume(0)).toBe("0");
  });
});

describe("runKcal", () => {
  it("liczy wg ACSM", () => {
    const v = (8 * 1000) / (2896 / 60);
    const oczekiwane = Math.round(
      (((3.5 + 0.2 * v) * 72 * (2896 / 60)) / 1000) * 5,
    );
    expect(runKcal(8, 2896, 72)).toBe(oczekiwane);
    expect(runKcal(8, 2896, null)).toBeNull();
  });
});

describe("1RM i objętość", () => {
  it("Epley zaokrągla do 0,5", () => {
    expect(epley1rm(70, 6)).toBe(84);
    expect(epley1rm(72.5, 5)).toBe(84.5);
  });
  it("objętość liczy tylko zrobione serie z ciężarem", () => {
    expect(
      sessionVolume([
        { weight_kg: null, reps: 10, done: true },
        { weight_kg: 60, reps: 8, done: false },
      ]),
    ).toBe(0);
    expect(sessionVolume([{ weight_kg: 60, reps: 8, done: true }])).toBe(480);
    expect(
      sessionVolume([
        { weight_kg: 60, reps: 8, done: true },
        { weight_kg: null, reps: 12, done: true },
      ]),
    ).toBe(480);
  });
});

describe("runFormInput", () => {
  const formularz = {
    id: null,
    kind: "tempo" as const,
    date: "2026-11-17",
    start: "16:00",
    distanceText: "10,5",
    durationText: "52:00",
    difficulty: 7,
    note: "ok",
    showInCalendar: true,
  };

  it("poprawny formularz → ładunek saveRun (bez id dla nowego biegu)", () => {
    expect(runFormInput(formularz)).toEqual({
      ok: true,
      input: {
        kind: "tempo",
        date: "2026-11-17",
        start: "16:00",
        distanceKm: 10.5,
        durationS: 3120,
        difficulty: 7,
        note: "ok",
        showInCalendar: true,
      },
    });
  });

  it("puste pola → null (bez czasu bieg jest planem), id przy edycji", () => {
    const wynik = runFormInput({
      ...formularz,
      id: "b1",
      distanceText: " ",
      durationText: "",
    });
    expect(wynik).toEqual({
      ok: true,
      input: expect.objectContaining({
        id: "b1",
        distanceKm: null,
        durationS: null,
      }),
    });
  });

  it("zły zapis i brak daty → błędy pól", () => {
    expect(
      runFormInput({
        ...formularz,
        date: null,
        distanceText: "dużo",
        durationText: "5 min",
      }),
    ).toEqual({
      ok: false,
      errors: {
        distanceKm: "Podaj dystans w km, np. 10,5.",
        durationS: "Podaj czas jako h:mm:ss albo mm:ss, np. 58:00.",
        date: "Wybierz datę.",
      },
    });
  });
});

describe("lastSetsSummary", () => {
  const historia = [
    {
      sessionId: "s1",
      startLocal: "2026-11-03T10:00:00",
      sets: [set({ id: "a1", weight_kg: 50, reps: 10 })],
    },
    {
      sessionId: "s2",
      startLocal: "2026-11-10T10:00:00",
      sets: [
        set({ id: "b2", set_no: 2, weight_kg: 60, reps: 8 }),
        set({ id: "b1", set_no: 1, weight_kg: 60, reps: 8 }),
        set({ id: "b3", set_no: 3, weight_kg: 62.5, reps: 6 }),
        set({ id: "b4", set_no: 4, weight_kg: 70, reps: 6, done: false }),
        set({ id: "inne", exercise_id: "e2", weight_kg: 100 }),
      ],
    },
    {
      sessionId: "teraz",
      startLocal: "2026-11-17T10:00:00",
      sets: [set({ id: "c1", weight_kg: 65 })],
    },
  ];

  it("ostatnia wcześniejsza sesja: zrobione serie × powt. pierwszej · maks. kg", () => {
    expect(lastSetsSummary(historia, "teraz", "e1")).toBe("ost. 3×8 · 62,5 kg");
  });

  it("masa ciała bez kg; brak wcześniejszej sesji → null", () => {
    const mc = [
      {
        sessionId: "s1",
        startLocal: "2026-11-03T10:00:00",
        sets: [
          set({ id: "a1", weight_kg: null, reps: 12 }),
          set({ id: "a2", set_no: 2, weight_kg: null, reps: 10 }),
        ],
      },
      { sessionId: "teraz", startLocal: "2026-11-17T10:00:00", sets: [] },
    ];
    expect(lastSetsSummary(mc, "teraz", "e1")).toBe("ost. 2×12");
    expect(lastSetsSummary(historia, "s1", "e1")).toBeNull();
    expect(lastSetsSummary(historia, "teraz", "e9")).toBeNull();
    expect(lastSetsSummary(historia, "brak", "e1")).toBeNull();
  });
});

describe("recordSetIds", () => {
  it("pierwsza sesja bez rekordu, potem tylko najcięższa seria ponad max", () => {
    const wynik = recordSetIds(
      [
        {
          sessionId: "s2",
          startLocal: "2026-11-10T10:00:00",
          sets: [
            set({ id: "b1", weight_kg: 72.5 }),
            set({ id: "b2", weight_kg: 72.5, set_no: 2 }),
            set({ id: "b3", weight_kg: 71, set_no: 3 }),
            set({ id: "bn", weight_kg: null, set_no: 4 }),
          ],
        },
        {
          sessionId: "s1",
          startLocal: "2026-11-03T10:00:00",
          sets: [set({ id: "a1", weight_kg: 70 })],
        },
      ],
      "e1",
    );
    expect([...wynik]).toEqual(["b1"]);
  });
  it("sesja tylko z seriami mc nie daje rekordu i nie zmienia maksimum", () => {
    const wynik = recordSetIds(
      [
        {
          sessionId: "s1",
          startLocal: "2026-11-03T10:00:00",
          sets: [set({ id: "a1", weight_kg: 70 })],
        },
        {
          sessionId: "s2",
          startLocal: "2026-11-10T10:00:00",
          sets: [set({ id: "b1", weight_kg: null })],
        },
        {
          sessionId: "s3",
          startLocal: "2026-11-17T10:00:00",
          sets: [set({ id: "c1", weight_kg: 72.5 })],
        },
      ],
      "e1",
    );
    expect([...wynik]).toEqual(["c1"]);
  });
  it("niezrobione serie nie ustalają maksimum ani nie są rekordem", () => {
    const wynik = recordSetIds(
      [
        {
          sessionId: "s1",
          startLocal: "2026-11-03T10:00:00",
          sets: [set({ id: "a1", weight_kg: 100, done: false })],
        },
        {
          sessionId: "s2",
          startLocal: "2026-11-10T10:00:00",
          sets: [set({ id: "b1", weight_kg: 60 })],
        },
      ],
      "e1",
    );
    expect(wynik.size).toBe(0);
  });
});

const szablon = (o: Partial<TemplateRow> = {}): TemplateRow => ({
  id: "t1",
  user_id: "u",
  name: "Push",
  weekdays: [1, 4],
  start_time: "18:30:00",
  last_used_at: null,
  created_at: null,
  ...o,
});

describe("templateOccurrences", () => {
  // 2026-11-16 to poniedziałek, 2026-11-18 środa
  const od = "2026-11-16";
  const doo = "2026-11-22";
  it("pomija przeszłość, bierze czwartek z godziną szablonu", () => {
    const w = templateOccurrences([szablon()], [], [], od, doo, "2026-11-18");
    expect(w.map((i) => i.key)).toEqual(["t:t1:2026-11-19"]);
    expect(w[0].startMin).toBe(18 * 60 + 30);
    expect(w[0].planned).toBe(true);
    expect(w[0].kind).toBe("gym");
    expect(w[0].title).toBe("Push");
  });
  it("dzisiaj jest włączone", () => {
    const w = templateOccurrences([szablon()], [], [], od, doo, "2026-11-19");
    expect(w.map((i) => i.key)).toEqual(["t:t1:2026-11-19"]);
  });
  it("pomija dni z template_skips", () => {
    const skip: SkipRow = {
      template_id: "t1",
      date: "2026-11-19",
      user_id: "u",
    };
    expect(
      templateOccurrences([szablon()], [skip], [], od, doo, "2026-11-18"),
    ).toEqual([]);
  });
  it("pomija dni z już utworzoną sesją", () => {
    const sesja = {
      id: "s1",
      template_id: "t1",
      template_date: "2026-11-19",
    } as SessionRow;
    expect(
      templateOccurrences([szablon()], [], [sesja], od, doo, "2026-11-18"),
    ).toEqual([]);
  });
});

describe("sessionItems", () => {
  const sesja = (o: Partial<SessionRow>): SessionRow => ({
    id: "s1",
    user_id: "u",
    type: "run",
    title: "Spokojny",
    start_local: "2026-11-16T07:00:00",
    end_local: null,
    completed: false,
    show_in_calendar: true,
    template_id: null,
    template_date: null,
    note: null,
    difficulty: null,
    created_at: null,
    ...o,
  });
  const bieg = (o: Partial<RunRow>): RunRow => ({
    session_id: "s1",
    user_id: "u",
    kind: "easy",
    distance_km: 10,
    duration_s: 3600,
    difficulty: null,
    weight_kg_snapshot: 72,
    kcal: 700,
    ...o,
  });
  it("bieg wykonany ma czas z duration_s, plan 60 min, siłownia 90 min", () => {
    const items = sessionItems(
      [
        sesja({}),
        sesja({ id: "s2" }),
        sesja({ id: "s3", type: "gym", title: "Push" }),
      ],
      [bieg({}), bieg({ session_id: "s2", duration_s: null })],
    );
    expect(items[0]).toMatchObject({
      key: "s:s1",
      kind: "run",
      date: "2026-11-16",
      startMin: 420,
      durationMin: 60,
      planned: false,
      runKind: "easy",
    });
    expect(items[1]).toMatchObject({ planned: true, durationMin: 60 });
    expect(items[2]).toMatchObject({
      kind: "gym",
      planned: true,
      durationMin: 90,
      runKind: null,
    });
  });
  it("end_local ma pierwszeństwo, ukończony trening nie jest planem", () => {
    const items = sessionItems(
      [
        sesja({
          type: "gym",
          completed: true,
          end_local: "2026-11-16T08:15:00",
        }),
      ],
      [],
    );
    expect(items[0]).toMatchObject({ planned: false, durationMin: 75 });
  });
  it("trudność: bieg z runs, trening siłowy z sesji", () => {
    const items = sessionItems(
      [
        sesja({ difficulty: 9 }),
        sesja({ id: "s3", type: "gym", completed: true, difficulty: 7 }),
      ],
      [bieg({ difficulty: 4 })],
    );
    expect(items[0].difficulty).toBe(4);
    expect(items[1].difficulty).toBe(7);
  });
});

describe("weekStats", () => {
  const bieg = (
    date: string,
    km: number | null,
    s: number | null,
    kcal: number | null,
    planned = false,
  ): SportItem => ({
    key: date,
    kind: "run",
    sessionId: date,
    templateId: null,
    date,
    startMin: 0,
    durationMin: 60,
    title: "x",
    planned,
    showInCalendar: true,
    distanceKm: km,
    durationS: s,
    kcal,
    difficulty: null,
    runKind: "easy",
    note: null,
  });
  it("sumuje km, tempo i kcal wykonanych biegów", () => {
    const w = weekStats(
      [
        bieg("2026-11-16", 10, 3480, 700),
        bieg("2026-11-18", 6, 2130, 400),
        bieg("2026-11-20", 5, null, null, true),
        bieg("2026-11-23", 9, 3000, 600),
      ],
      "2026-11-16",
    );
    expect(w.km).toBe(16);
    expect(w.paceS).toBe((3480 + 2130) / 16);
    expect(w.done).toBe(2);
    expect(w.kcal).toBe(1100);
  });
  it("bez biegów tempo to null", () => {
    expect(weekStats([], "2026-11-16").paceS).toBeNull();
  });
});

describe("weekStats (tydzień od niedzieli)", () => {
  it("liczy 7 dni od niedzieli zgodnie z wierszem monthGrid", () => {
    const wiersz = monthGrid("2026-11", "sun")[2]; // 15–21 listopada
    expect(wiersz[0]).toBe("2026-11-15");
    expect(wiersz[6]).toBe("2026-11-21");
    const b = (date: string): SportItem => ({
      key: date,
      kind: "run",
      sessionId: date,
      templateId: null,
      date,
      startMin: 0,
      durationMin: 60,
      title: "x",
      planned: false,
      showInCalendar: true,
      distanceKm: 5,
      durationS: 1500,
      kcal: 300,
      difficulty: null,
      runKind: "easy",
      note: null,
    });
    const w = weekStats(
      [b("2026-11-14"), b("2026-11-15"), b("2026-11-20"), b("2026-11-22")],
      wiersz[0],
    );
    expect(w.km).toBe(10);
    expect(w.done).toBe(2);
    const sob = weekStats([b("2026-11-21"), b("2026-11-22")], wiersz[0]);
    expect(sob.done).toBe(1);
  });
  it("bieg bez dystansu nie psuje tempa", () => {
    const w = weekStats(
      [
        {
          key: "a",
          kind: "run",
          sessionId: "a",
          templateId: null,
          date: "2026-11-16",
          startMin: 0,
          durationMin: 60,
          title: "x",
          planned: false,
          showInCalendar: true,
          distanceKm: null,
          durationS: 3000,
          kcal: null,
          difficulty: null,
          runKind: "easy",
          note: null,
        },
        {
          key: "b",
          kind: "run",
          sessionId: "b",
          templateId: null,
          date: "2026-11-17",
          startMin: 0,
          durationMin: 60,
          title: "x",
          planned: false,
          showInCalendar: true,
          distanceKm: 5,
          durationS: 1500,
          kcal: null,
          difficulty: null,
          runKind: "easy",
          note: null,
        },
      ],
      "2026-11-16",
    );
    expect(w.paceS).toBe(300);
    expect(w.km).toBe(5);
  });
});

describe("monthGrid", () => {
  it("6 x 7, start zależny od week_start", () => {
    const pn = monthGrid("2026-11", "mon");
    expect(pn).toHaveLength(6);
    expect(pn[0]).toHaveLength(7);
    expect(pn[0][0]).toBe("2026-10-26");
    // 1 listopada 2026 to niedziela, więc przy week_start = sun siatka zaczyna się od niego
    expect(monthGrid("2026-11", "sun")[0][0]).toBe("2026-11-01");
    expect(monthGrid("2026-10", "sun")[0][0]).toBe("2026-09-27");
  });
});

describe("templateSets i firstReps", () => {
  const poz: TemplateItemRow = {
    id: "i1",
    user_id: "u",
    template_id: "t1",
    exercise_id: "e1",
    position: 3,
    sets_count: 3,
    reps_text: "8–10",
    rest_s: 120,
  };
  it("serie z historii, brakujące kopiują ostatnią", () => {
    const hist = new Map([
      [
        "e1",
        [
          set({ set_no: 1, weight_kg: 60, reps: 8 }),
          set({ set_no: 2, weight_kg: 62.5, reps: 6 }),
        ],
      ],
    ]);
    expect(templateSets([poz], hist)).toEqual([
      {
        exercise_id: "e1",
        exercise_position: 3,
        set_no: 1,
        weight_kg: 60,
        reps: 8,
      },
      {
        exercise_id: "e1",
        exercise_position: 3,
        set_no: 2,
        weight_kg: 62.5,
        reps: 6,
      },
      {
        exercise_id: "e1",
        exercise_position: 3,
        set_no: 3,
        weight_kg: 62.5,
        reps: 6,
      },
    ]);
  });
  it("bez historii kg puste, powtórzenia z reps_text", () => {
    const w = templateSets([poz], new Map());
    expect(w).toHaveLength(3);
    expect(w.every((s) => s.weight_kg === null && s.reps === 8)).toBe(true);
  });
  it("null powt. w historii wraca do reps_text", () => {
    const hist = new Map([
      ["e1", [set({ set_no: 1, weight_kg: 60, reps: null })]],
    ]);
    const w = templateSets([poz], hist);
    expect(w[0]).toMatchObject({ weight_kg: 60, reps: 8 });
  });
  it("firstReps", () => {
    expect(firstReps("8–10")).toBe(8);
    expect(firstReps("12")).toBe(12);
    expect(firstReps("AMRAP")).toBeNull();
  });
});

describe("searchExercises", () => {
  it("bez duplikatów i wykluczonych", () => {
    const w = searchExercises(
      "wyc",
      [{ id: "1", name: "Wyciskanie na ławce", muscle_group: "klatka" }],
      ["Wyciskanie żołnierskie"],
    );
    const nazwy = w.map((e) => e.name.toLowerCase());
    expect(nazwy.filter((n) => n === "wyciskanie na ławce")).toHaveLength(1);
    expect(nazwy).not.toContain("wyciskanie żołnierskie");
    expect(w[0].id).toBe("1");
    expect(w.find((e) => e.name === "Wyciskanie hantli skos")?.id).toBeNull();
  });
  it("biblioteka nie ma duplikatów", () => {
    const n = EXERCISE_LIBRARY.map((e) => e.name.toLowerCase());
    expect(new Set(n).size).toBe(n.length);
  });
});

describe("parseDuration i parseKm", () => {
  it("czas: mm:ss i h:mm:ss, zły zapis → null", () => {
    expect(parseDuration("58:00")).toBe(3480);
    expect(parseDuration("1:02:05")).toBe(3725);
    expect(parseDuration(" 0:56:40 ")).toBe(3400);
    expect(parseDuration("58")).toBeNull();
    expect(parseDuration("58:70")).toBeNull();
    expect(parseDuration("1:75:00")).toBeNull();
    expect(parseDuration("abc")).toBeNull();
  });

  it("dystans: przecinek lub kropka, zły zapis → null", () => {
    expect(parseKm("10,5")).toBe(10.5);
    expect(parseKm("10.5")).toBe(10.5);
    expect(parseKm("8")).toBe(8);
    expect(parseKm("-1")).toBeNull();
    expect(parseKm("x")).toBeNull();
  });
});

describe("pola treningu siłowego", () => {
  it("parseKgInput: przecinek, kropka, puste i „mc” to masa ciała, zły zapis → undefined", () => {
    expect(parseKgInput("72,5")).toBe(72.5);
    expect(parseKgInput(" 70.25 ")).toBe(70.25);
    expect(parseKgInput("0")).toBe(0);
    expect(parseKgInput("")).toBeNull();
    expect(parseKgInput("MC")).toBeNull();
    expect(parseKgInput("1000,5")).toBeUndefined();
    expect(parseKgInput("7,555")).toBeUndefined();
    expect(parseKgInput("abc")).toBeUndefined();
    expect(parseKgInput("-5")).toBeUndefined();
  });

  it("parseRepsInput: liczby całkowite 0–999, puste → null, zły zapis → undefined", () => {
    expect(parseRepsInput("8")).toBe(8);
    expect(parseRepsInput(" 12 ")).toBe(12);
    expect(parseRepsInput("")).toBeNull();
    expect(parseRepsInput("1000")).toBeUndefined();
    expect(parseRepsInput("8,5")).toBeUndefined();
    expect(parseRepsInput("x")).toBeUndefined();
  });
});

describe("kgVsLast", () => {
  const historia = [
    {
      sessionId: "s1",
      startLocal: "2026-11-03T10:00:00",
      sets: [set({ id: "a1", weight_kg: 65 })],
    },
    {
      sessionId: "s2",
      startLocal: "2026-11-10T10:00:00",
      sets: [
        set({ id: "b1", weight_kg: 70 }),
        set({ id: "b2", weight_kg: 75, done: false, set_no: 2 }),
      ],
    },
    {
      sessionId: "s3",
      startLocal: "2026-11-17T10:00:00",
      sets: [
        set({ id: "c1", weight_kg: 70 }),
        set({ id: "c2", weight_kg: 72.5, set_no: 2 }),
        set({ id: "c3", weight_kg: 80, done: false, set_no: 3 }),
      ],
    },
  ];

  it("maks. zrobionej serii teraz − maks. w poprzedniej sesji z ćwiczeniem", () => {
    expect(kgVsLast(historia, "s3", "e1")).toBe(2.5);
    expect(kgVsLast(historia, "s2", "e1")).toBe(5);
  });

  it("pierwsza sesja, brak zrobionych serii z ciężarem albo inne ćwiczenie → null", () => {
    expect(kgVsLast(historia, "s1", "e1")).toBeNull();
    expect(kgVsLast(historia, "s3", "e2")).toBeNull();
    expect(
      kgVsLast(
        [
          historia[0],
          {
            sessionId: "s4",
            startLocal: "2026-11-20T10:00:00",
            sets: [set({ id: "d1", weight_kg: null })],
          },
        ],
        "s4",
        "e1",
      ),
    ).toBeNull();
  });

  it("poprzednia sesja bez zrobionych serii z ciężarem jest pomijana", () => {
    expect(
      kgVsLast(
        [
          historia[0],
          {
            sessionId: "s2",
            startLocal: "2026-11-10T10:00:00",
            sets: [set({ id: "b1", weight_kg: 90, done: false })],
          },
          {
            sessionId: "s3",
            startLocal: "2026-11-17T10:00:00",
            sets: [set({ id: "c1", weight_kg: 62.5 })],
          },
        ],
        "s3",
        "e1",
      ),
    ).toBe(-2.5);
  });
});

describe("szablony — przerwa, odmiana, „ostatnio”", () => {
  it("parseRest: m:ss → sekundy, do 30:00; zły zapis → null", () => {
    expect(parseRest("2:00")).toBe(120);
    expect(parseRest(" 1:30 ")).toBe(90);
    expect(parseRest("0:45")).toBe(45);
    expect(parseRest("30:00")).toBe(1800);
    expect(parseRest("30:01")).toBeNull();
    expect(parseRest("2:60")).toBeNull();
    expect(parseRest("2")).toBeNull();
    expect(parseRest("")).toBeNull();
    expect(parseRest("abc")).toBeNull();
  });

  it("formatRest: sekundy → m:ss", () => {
    expect(formatRest(120)).toBe("2:00");
    expect(formatRest(90)).toBe("1:30");
    expect(formatRest(45)).toBe("0:45");
    expect(formatRest(parseRest("3:05") as number)).toBe("3:05");
  });

  it("plPlural: 1 / 2–4 (bez 12–14) / reszta", () => {
    const cw = (n: number) => plPlural(n, "ćwiczenie", "ćwiczenia", "ćwiczeń");
    expect(cw(1)).toBe("1 ćwiczenie");
    expect(cw(4)).toBe("4 ćwiczenia");
    expect(cw(5)).toBe("5 ćwiczeń");
    expect(cw(12)).toBe("12 ćwiczeń");
    expect(cw(22)).toBe("22 ćwiczenia");
    expect(cw(0)).toBe("0 ćwiczeń");
    expect(plPlural(13, "seria", "serie", "serii")).toBe("13 serii");
  });

  it("formatLastUsed: dzień w strefie profilu, brak → —", () => {
    expect(formatLastUsed("2026-11-12T10:00:00.000Z", "Europe/Warsaw")).toBe(
      "czw 12.11",
    );
    // 23:30 UTC to już piątek w Warszawie
    expect(formatLastUsed("2026-11-12T23:30:00+00:00", "Europe/Warsaw")).toBe(
      "pt 13.11",
    );
    expect(formatLastUsed(null, "Europe/Warsaw")).toBe("—");
  });
});

describe("sportItemHref", () => {
  it("prowadzi do miesiąca treningu z kluczem w `wybrany`", () => {
    expect(sportItemHref({ date: "2026-11-19", key: "t:t1:2026-11-19" })).toBe(
      "/sport?miesiac=2026-11&wybrany=t:t1:2026-11-19",
    );
    expect(sportItemHref({ date: "2026-12-01", key: "s:abc" })).toBe(
      "/sport?miesiac=2026-12&wybrany=s:abc",
    );
  });
});
