import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadSportMonth } = vi.hoisted(() => ({ loadSportMonth: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  }),
}));
vi.mock("@/features/sport/load-sport", () => ({ loadSportMonth }));
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
  loadSportMonth.mockResolvedValue({ month: "2026-11", today: "2026-11-17" });
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
});
