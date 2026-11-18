import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadTemplates } = vi.hoisted(() => ({ loadTemplates: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  }),
}));
vi.mock("@/features/sport/load-sport", () => ({ loadTemplates }));
vi.mock("@/features/sport/templates-list", () => ({
  TemplatesList: () => null,
}));

import SzablonyPage from "./page";

// Strona opakowuje dane w Suspense; wywołujemy wewnętrzny komponent serwerowy wprost
async function flash(params: Record<string, string>) {
  const suspense = SzablonyPage({
    searchParams: Promise.resolve(params),
  }) as ReactElement<{ children: ReactElement }>;
  const wewnetrzny = suspense.props.children as ReactElement<
    Record<string, unknown>
  > & { type: (p: Record<string, unknown>) => Promise<ReactElement> };
  const wynik = (await wewnetrzny.type(wewnetrzny.props)) as ReactElement<{
    flash: string | null;
  }>;
  return wynik.props.flash;
}

beforeEach(() => {
  vi.clearAllMocks();
  loadTemplates.mockResolvedValue({ templates: [] });
});

describe("/sport/szablony", () => {
  it("komunikaty z makiety po dodaniu, zapisie i usunięciu", async () => {
    expect(await flash({ komunikat: "dodano", nazwa: "Push" })).toBe(
      "Dodano szablon „Push”.",
    );
    expect(await flash({ komunikat: "zapisano", nazwa: "Push" })).toBe(
      "Zapisano zmiany w szablonie „Push”.",
    );
    expect(await flash({ komunikat: "usunieto", nazwa: "Pull" })).toBe(
      "Usunięto szablon „Pull”.",
    );
    expect(loadTemplates).toHaveBeenCalledWith(expect.anything(), "u1");
  });

  it("bez albo z nieznanym komunikatem → brak", async () => {
    expect(await flash({})).toBeNull();
    expect(await flash({ komunikat: "cokolwiek", nazwa: "X" })).toBeNull();
  });
});
