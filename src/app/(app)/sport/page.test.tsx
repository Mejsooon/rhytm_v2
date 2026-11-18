import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadSportMonth, loadSportRun } = vi.hoisted(() => ({
  loadSportMonth: vi.fn(),
  loadSportRun: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  }),
}));
vi.mock("@/features/sport/load-sport", () => ({
  loadSportMonth,
  loadSportRun,
}));
vi.mock("@/features/sport/sport-view", () => ({ SportView: () => null }));

import SportPage from "./page";

type Parametry = Record<string, string>;

// Strona opakowuje dane w Suspense; wywołujemy wewnętrzny komponent serwerowy wprost
async function propsWidoku(parametry: Parametry) {
  const suspense = SportPage({
    searchParams: Promise.resolve(parametry),
  }) as ReactElement<{ children: ReactElement }>;
  const wewnetrzny = suspense.props.children as ReactElement<
    Record<string, unknown>
  > & { type: (p: Record<string, unknown>) => Promise<ReactElement> };
  const widok = await wewnetrzny.type(wewnetrzny.props);
  return widok.props as Record<string, unknown>;
}

beforeEach(() => {
  vi.clearAllMocks();
  loadSportMonth.mockResolvedValue({
    month: "2026-11",
    today: "2026-11-17",
    items: [],
  });
});

describe("/sport", () => {
  it("miesiąc i wybrany z adresu", async () => {
    const p = await propsWidoku({ miesiac: "2026-10", wybrany: "s:abc" });
    expect(loadSportMonth).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "2026-10",
    );
    expect(p.selectedKey).toBe("s:abc");
    expect(p.newGym).toBeNull();
  });

  it("?nowy=silownia&data&godzina → pusty trening na ten termin", async () => {
    const p = await propsWidoku({
      nowy: "silownia",
      data: "2026-11-20",
      godzina: "18:30",
    });
    expect(p.newGym).toEqual({ date: "2026-11-20", start: "18:30" });
  });

  it("?nowy=silownia bez poprawnej daty i godziny → null (widok weźmie dziś i teraz)", async () => {
    const p = await propsWidoku({
      nowy: "silownia",
      data: "x",
      godzina: "25:00",
    });
    expect(p.newGym).toEqual({ date: null, start: null });
  });

  it("?nowy=bieg bez miesiaca bierze miesiąc z daty", async () => {
    const p = await propsWidoku({
      nowy: "bieg",
      data: "2026-12-03",
      godzina: "06:45",
    });
    expect(loadSportMonth).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "2026-12",
    );
    expect(p.newRun).toEqual({ date: "2026-12-03", start: "06:45" });
  });

  it("?nowy=bieg ze złą datą i godziną → null, a jawny miesiac wygrywa", async () => {
    const p = await propsWidoku({
      nowy: "bieg",
      miesiac: "2026-10",
      data: "2026-12-03",
      godzina: "99:00",
    });
    expect(loadSportMonth).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "2026-10",
    );
    expect(p.newRun).toEqual({ date: "2026-12-03", start: null });
  });

  it("?bieg= spoza wczytanych danych wczytuje bieg osobno", async () => {
    const bieg = { sessionId: "abc", kind: "run" };
    loadSportRun.mockResolvedValue(bieg);
    const p = await propsWidoku({ miesiac: "2026-11", bieg: "abc" });
    expect(loadSportRun).toHaveBeenCalledWith(expect.anything(), "u1", "abc");
    expect(p.runId).toBe("abc");
    expect(p.runItem).toBe(bieg);
    expect(p.newRun).toBeNull();
  });
});
