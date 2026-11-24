import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock klienta: każde from(tabela).select(kolumny).order(...).range(od, do) zapisuje wywołanie
// i zwraca odpowiedź z mapy `odpowiedzi` (funkcja tabeli i zakresu).
type Wywolanie = {
  tabela: string;
  kolumny: string;
  eq: [string, string][];
  order: string[];
  od: number;
  do: number;
};
const { getUser, stan } = vi.hoisted(() => ({
  getUser: vi.fn(),
  stan: {
    wywolania: [] as {
      tabela: string;
      kolumny: string;
      eq: [string, string][];
      order: string[];
      od: number;
      do: number;
    }[],
    odpowiedz: (() => ({ data: [], error: null })) as (
      tabela: string,
      od: number,
    ) => { data: unknown[] | null; error: { message: string } | null },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: (tabela: string) => ({
      select: (kolumny: string) => {
        const w: Wywolanie = {
          tabela,
          kolumny,
          eq: [],
          order: [],
          od: -1,
          do: -1,
        };
        const zapytanie = {
          eq: (k: string, v: string) => {
            w.eq.push([k, v]);
            return zapytanie;
          },
          order: (k: string) => {
            w.order.push(k);
            return zapytanie;
          },
          range: async (od: number, doo: number) => {
            w.od = od;
            w.do = doo;
            stan.wywolania.push(w);
            return stan.odpowiedz(tabela, od);
          },
        };
        return zapytanie;
      },
    }),
  }),
}));

import { GET } from "./route";

describe("GET /api/eksport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stan.wywolania = [];
    stan.odpowiedz = (tabela, od) =>
      tabela === "profiles" && od === 0
        ? { data: [{ user_id: "u1", timezone: "Europe/Warsaw" }], error: null }
        : { data: [], error: null };
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "ala@example.com" } },
    });
  });

  it("bez sesji → 401 JSON", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const odp = await GET();
    expect(odp.status).toBe(401);
    expect(await odp.json()).toEqual({ error: "Brak sesji" });
    expect(stan.wywolania).toHaveLength(0);
  });

  it("nagłówki i kształt JSON", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    // 23:30 UTC 24.11 = 00:30 25.11 w Warszawie → data z profilu
    vi.setSystemTime(new Date("2026-11-24T23:30:00Z"));
    const odp = await GET();
    vi.useRealTimers();

    expect(odp.status).toBe(200);
    expect(odp.headers.get("Content-Type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(odp.headers.get("Content-Disposition")).toBe(
      'attachment; filename="rhytm-export-2026-11-25.json"',
    );
    expect(odp.headers.get("Cache-Control")).toBe("no-store");

    const tekst = await odp.text();
    // Wcięcie 2 spacje
    expect(tekst).toContain('\n  "format": "rhytm-eksport"');
    const json = JSON.parse(tekst);
    expect(json).toMatchObject({
      format: "rhytm-eksport",
      wersja: 1,
      utworzono: "2026-11-24T23:30:00.000Z",
      konto: { id: "u1", email: "ala@example.com" },
      pominiete: [],
    });
    expect(Object.keys(json.tabele)).toEqual([
      "profiles",
      "notification_settings",
      "categories",
      "blocks",
      "block_exceptions",
      "tasks",
      "habits",
      "habit_schedules",
      "habit_checks",
      "habit_notes",
      "sleep_logs",
      "workout_templates",
      "workout_template_items",
      "template_skips",
      "sport_sessions",
      "runs",
      "exercises",
      "gym_sets",
      "pages",
      "page_blocks",
      "page_fields",
      "page_rows",
      "vaults",
      "push_subscriptions",
    ]);
    expect(json.tabele.profiles).toEqual([
      { user_id: "u1", timezone: "Europe/Warsaw" },
    ]);
  });

  it("stronicowanie: 1000 + 1 wiersz → zapytania aż do pustej strony", async () => {
    stan.odpowiedz = (tabela, od) => {
      if (tabela !== "tasks") return { data: [], error: null };
      const ile = od === 0 ? 1000 : od === 1000 ? 1 : 0;
      return {
        data: Array.from({ length: ile }, (_, i) => ({ id: `t${od + i}` })),
        error: null,
      };
    };
    const json = JSON.parse(await (await GET()).text());
    const zadania = stan.wywolania.filter((w) => w.tabela === "tasks");
    expect(zadania.map((w) => [w.od, w.do])).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ]);
    expect(zadania[0].order).toEqual(["id"]);
    expect(json.tabele.tasks).toHaveLength(1001);
  });

  it("każda tabela filtrowana jawnie po user_id zalogowanego", async () => {
    await GET();
    expect(stan.wywolania.length).toBeGreaterThanOrEqual(24);
    for (const w of stan.wywolania) expect(w.eq).toEqual([["user_id", "u1"]]);
  });

  it("niepełna strona nie kończy odczytu — dopiero pusta", async () => {
    stan.odpowiedz = (tabela, od) =>
      tabela === "pages"
        ? { data: od < 1000 ? [{ id: `p${od}` }] : [], error: null }
        : { data: [], error: null };
    const json = JSON.parse(await (await GET()).text());
    expect(
      stan.wywolania.filter((w) => w.tabela === "pages").map((w) => w.od),
    ).toEqual([0, 1000]);
    expect(json.tabele.pages).toEqual([{ id: "p0" }]);
  });

  it("klucz złożony sortowany po wszystkich kolumnach klucza", async () => {
    await GET();
    expect(
      stan.wywolania.find((w) => w.tabela === "habit_checks")?.order,
    ).toEqual(["habit_id", "date"]);
  });

  it("błąd jednej tabeli → `pominiete`, reszta jest", async () => {
    stan.odpowiedz = (tabela, od) =>
      tabela === "push_subscriptions"
        ? { data: null, error: { message: "relation does not exist" } }
        : { data: od === 0 ? [{ id: "x" }] : [], error: null };
    const json = JSON.parse(await (await GET()).text());
    expect(json.pominiete).toEqual(["push_subscriptions"]);
    expect(json.tabele.push_subscriptions).toBeUndefined();
    expect(json.tabele.pages).toEqual([{ id: "x" }]);
  });

  it("push_subscriptions bez kluczy urządzenia", async () => {
    await GET();
    const kolumny = stan.wywolania.find(
      (w) => w.tabela === "push_subscriptions",
    )?.kolumny;
    expect(kolumny).toBe("id, label, enabled, created_at, last_seen_at");
    expect(kolumny).not.toMatch(/endpoint|p256dh|\bauth\b/);
  });
});
