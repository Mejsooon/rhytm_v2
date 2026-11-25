import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";

const { getUser, from } = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { searchAll } from "./actions";

const STRONA = "a1000000-0000-4000-8000-000000000001";
const STRONA_SYS = "a1000000-0000-4000-8000-000000000002";
const BLOK_TAB = "a2000000-0000-4000-8000-000000000001";
const BLOK_SYS = "a2000000-0000-4000-8000-000000000002";
const POLE = "a3000000-0000-4000-8000-000000000001";
const POLE_SYS = "a3000000-0000-4000-8000-000000000002";
const NAWYK = "a5000000-0000-4000-8000-000000000001";

type Fake = ReturnType<typeof fakeTable>;
let tables: Record<string, Fake>;

// Dziś: czwartek 2026-11-26, 10:00 UTC
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-26T10:00:00Z"));
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  tables = {
    profiles: fakeTable({ single: { timezone: "Europe/Warsaw", week_start: "mon", clock: "24" } }),
    pages: fakeTable({ data: [] }),
    page_fields: fakeTable({ data: [] }),
    page_rows: fakeTable({ data: [] }),
    blocks: fakeTable({ data: [] }),
    habits: fakeTable({ data: [] }),
    habit_checks: fakeTable({ data: [] }),
    sport_sessions: fakeTable({ data: [] }),
  };
  from.mockImplementation((nazwa: string) => tables[nazwa]);
});

describe("searchAll", () => {
  it("fraza krótsza niż 2 znaki daje pusty wynik bez zapytań", async () => {
    expect(await searchAll(" a ")).toEqual({ ok: true, groups: [] });
    expect(from).not.toHaveBeenCalled();
  });

  it("za długa fraza to błąd bez zapytań", async () => {
    const wynik = await searchAll("a".repeat(81));
    expect(wynik.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("brak sesji przekierowuje do logowania", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(searchAll("mat")).rejects.toThrow("REDIRECT:/logowanie");
  });

  it("escapuje %, _ i \\ we wzorcu ilike", async () => {
    await searchAll("50%_a\\b");
    expect(tables.pages.ilike).toHaveBeenCalledWith("title", "%50\\%\\_a\\\\b%");
    expect(tables.blocks.ilike).toHaveBeenCalledWith("title", "%50\\%\\_a\\\\b%");
    expect(tables.habits.ilike).toHaveBeenCalledWith("name", "%50\\%\\_a\\\\b%");
    expect(tables.sport_sessions.ilike).toHaveBeenCalledWith("title", "%50\\%\\_a\\\\b%");
  });

  it("każde zapytanie ma user_id i limit 5", async () => {
    tables.page_fields = fakeTable({
      data: [
        {
          id: POLE,
          block_id: BLOK_TAB,
          page_blocks: { id: BLOK_TAB, page_id: STRONA, pages: { id: STRONA, title: "Books", is_system: false } },
        },
      ],
    });
    tables.habits = fakeTable({ data: [{ id: NAWYK, name: "Czytanie", habit_schedules: [] }] });
    await searchAll("czy");
    for (const nazwa of ["profiles", "pages", "page_fields", "page_rows", "blocks", "habits", "habit_checks", "sport_sessions"]) {
      expect(tables[nazwa].eq, nazwa).toHaveBeenCalledWith("user_id", "u1");
    }
    for (const nazwa of ["pages", "blocks", "habits", "sport_sessions", "page_rows"]) {
      expect(tables[nazwa].limit, nazwa).toHaveBeenCalledWith(5);
    }
  });

  it("nie przeszukuje Sekretu ani strony systemowej", async () => {
    tables.page_fields = fakeTable({
      data: [
        {
          id: POLE,
          block_id: BLOK_TAB,
          page_blocks: { id: BLOK_TAB, page_id: STRONA, pages: { id: STRONA, title: "Books", is_system: false } },
        },
        // Gdyby baza zwróciła pole strony systemowej, i tak nie trafia do zapytania o wiersze
        {
          id: POLE_SYS,
          block_id: BLOK_SYS,
          page_blocks: { id: BLOK_SYS, page_id: STRONA_SYS, pages: { id: STRONA_SYS, title: "Hasła", is_system: true } },
        },
      ],
    });
    await searchAll("git");
    expect(tables.page_fields.eq).toHaveBeenCalledWith("page_blocks.pages.is_system", false);
    expect(tables.page_fields.neq).toHaveBeenCalledWith("type", "secret");
    expect(tables.page_rows.in).toHaveBeenCalledWith("block_id", [BLOK_TAB]);
    const filtr = tables.page_rows.or.mock.calls[0][0] as string;
    expect(filtr).toContain(POLE);
    expect(filtr).not.toContain(POLE_SYS);
    // Kolumna secret nie bierze udziału w żadnym zapytaniu
    expect(tables.page_rows.select).toHaveBeenCalledWith(`id,block_id,t0:values->>${POLE}`);
  });

  it("gwiazdki są usuwane z frazy (PostgREST traktuje * jak %)", async () => {
    await searchAll("a*b");
    expect(tables.pages.ilike).toHaveBeenCalledWith("title", "%ab%");
  });

  it("bez pól tytułowych nie pyta o wiersze", async () => {
    await searchAll("git");
    expect(tables.page_rows.select).not.toHaveBeenCalled();
  });

  it("wartość w filtrze or jest w cudzysłowie, a \" i \\ są escapowane", async () => {
    tables.page_fields = fakeTable({
      data: [{ id: POLE, block_id: BLOK_TAB, page_blocks: { id: BLOK_TAB, page_id: STRONA, pages: { id: STRONA, title: "B", is_system: false } } }],
    });
    await searchAll('a,"b)');
    const filtr = tables.page_rows.or.mock.calls[0][0] as string;
    expect(filtr).toBe(`values->>${POLE}.ilike."%a,\\"b)%"`);
  });

  it("grupy w kolejności Strony, Kalendarz, Nawyki, Sport; puste pomijane", async () => {
    tables.pages = fakeTable({
      data: [
        { id: STRONA, title: "Books", is_system: false, page_blocks: [{ page_rows: [{ count: 11 }] }] },
        { id: "p2", title: "Pusta", is_system: false, page_blocks: [] },
        { id: STRONA_SYS, title: "Hasła", is_system: true, page_blocks: [{ page_rows: [{ count: 9 }] }] },
      ],
    });
    tables.page_fields = fakeTable({
      data: [{ id: POLE, block_id: BLOK_TAB, page_blocks: { id: BLOK_TAB, page_id: STRONA, pages: { id: STRONA, title: "Books", is_system: false } } }],
    });
    tables.page_rows = fakeTable({ data: [{ id: "r1", block_id: BLOK_TAB, t0: "Dune" }] });
    tables.blocks = fakeTable({
      data: [
        {
          id: "b1",
          title: "Matematyka",
          start_local: "2026-11-26T10:30:00",
          duration_min: 120,
          recurrence: null,
          category_id: null,
          note: null,
          remind: false,
          block_exceptions: [],
        },
      ],
    });
    tables.habits = fakeTable({
      data: [
        {
          id: NAWYK,
          name: "Czytanie",
          remind_at: null,
          show_on_today: true,
          created_at: "2026-11-01T00:00:00Z",
          habit_schedules: [
            { habit_id: NAWYK, schedule_type: "daily", times_per_week: null, valid_from: "2026-11-01", weekdays: [] },
          ],
        },
      ],
    });
    tables.habit_checks = fakeTable({
      data: [
        { habit_id: NAWYK, date: "2026-11-25" },
        { habit_id: NAWYK, date: "2026-11-24" },
      ],
    });
    tables.sport_sessions = fakeTable({
      data: [
        { id: "s1", title: "Bieg poranny", type: "run", start_local: "2026-11-12T07:00:00", runs: { distance_km: 10.2 } },
        { id: "s2", title: "Push", type: "gym", start_local: "2026-11-10T18:00:00", runs: null },
      ],
    });

    const wynik = await searchAll("ee");
    expect(wynik).toEqual({
      ok: true,
      groups: [
        {
          title: "Strony",
          items: [
            { title: "Books", meta: "11 wierszy", href: `/strony/${STRONA}` },
            { title: "Pusta", meta: "pusta strona", href: "/strony/p2" },
            { title: "Hasła", meta: "moduł", href: "/hasla" },
            { title: "Dune", meta: "w Books", href: `/strony/${STRONA}` },
          ],
        },
        {
          title: "Kalendarz",
          items: [
            { title: "Matematyka", meta: "dziś 10:30–12:30", href: "/kalendarz?widok=dzien&data=2026-11-26" },
          ],
        },
        { title: "Nawyki", items: [{ title: "Czytanie", meta: "seria 2 dni", href: `/nawyki/${NAWYK}` }] },
        {
          title: "Sport",
          items: [
            { title: "Bieg poranny", meta: "czw 12.11 · 10,2 km", href: "/sport?miesiac=2026-11&bieg=s1" },
            { title: "Push", meta: "wt 10.11", href: "/sport/trening/s2" },
          ],
        },
      ],
    });
  });

  it("wynik grupy Strony nie przekracza 5 pozycji", async () => {
    const strony = Array.from({ length: 5 }, (_, i) => ({
      id: `p${i}`,
      title: `Strona ${i}`,
      is_system: false,
      page_blocks: [],
    }));
    tables.pages = fakeTable({ data: strony });
    tables.page_fields = fakeTable({
      data: [{ id: POLE, block_id: BLOK_TAB, page_blocks: { id: BLOK_TAB, page_id: STRONA, pages: { id: STRONA, title: "B", is_system: false } } }],
    });
    tables.page_rows = fakeTable({ data: [{ id: "r1", block_id: BLOK_TAB, t0: "Strona x" }] });
    const wynik = await searchAll("stro");
    expect(wynik.ok && wynik.groups[0].items).toHaveLength(5);
  });

  it("blok bez przyszłego wystąpienia pokazuje datę ostatniego", async () => {
    tables.blocks = fakeTable({
      data: [
        {
          id: "b1",
          title: "Egzamin",
          start_local: "2026-11-20T09:00:00",
          duration_min: 60,
          recurrence: null,
          category_id: null,
          note: null,
          remind: false,
          block_exceptions: [],
        },
      ],
    });
    const wynik = await searchAll("egz");
    expect(wynik.ok && wynik.groups[0]).toEqual({
      title: "Kalendarz",
      items: [{ title: "Egzamin", meta: "pt 20.11 09:00", href: "/kalendarz?widok=dzien&data=2026-11-20" }],
    });
  });

  it("błąd zapytania daje komunikat", async () => {
    tables.pages = fakeTable({ error: { message: "x" } });
    expect(await searchAll("mat")).toEqual({ ok: false, message: "Nie udało się wyszukać." });
  });
});
