import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFound, loadPasswordsModule } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  loadPasswordsModule: vi.fn(),
}));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/features/passwords/load-passwords", () => ({ loadPasswordsModule }));
vi.mock("@/features/passwords/passwords-view", () => ({ PasswordsView: () => null }));

import { PasswordsView } from "@/features/passwords/passwords-view";
import HaslaPage from "./page";

// Strona opakowuje dane w Suspense; wywołujemy wewnętrzny komponent serwerowy wprost
async function wyrenderujWewnetrzny() {
  const suspense = HaslaPage() as ReactElement<{ children: ReactElement }>;
  const wewnetrzny = suspense.props.children as ReactElement<Record<string, unknown>> & {
    type: (p: Record<string, unknown>) => Promise<ReactElement>;
  };
  return wewnetrzny.type(wewnetrzny.props);
}

describe("/hasla", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renderuje ekran modułu z danymi strony systemowej", async () => {
    const dane = { page: { id: "p" }, blocks: [] };
    loadPasswordsModule.mockResolvedValue(dane);
    const el = await wyrenderujWewnetrzny();
    expect(el.type).toBe(PasswordsView);
    expect(el.props).toEqual({ data: dane });
  });

  it("brak danych: notFound", async () => {
    loadPasswordsModule.mockResolvedValue(null);
    await expect(wyrenderujWewnetrzny()).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
