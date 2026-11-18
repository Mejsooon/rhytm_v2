import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFound, loadHabitDetail } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  loadHabitDetail: vi.fn(),
}));
vi.mock("next/navigation", () => ({ notFound, redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) } }),
}));
vi.mock("@/features/habits/load-habits", () => ({ loadHabitDetail }));
vi.mock("@/features/habits/habit-detail", () => ({ HabitDetail: () => null }));

import NawykPage from "./page";

// Strona opakowuje dane w Suspense; wywołujemy wewnętrzny komponent serwerowy wprost
async function wyrenderujWewnetrzny(id: string) {
  const suspense = NawykPage({ params: Promise.resolve({ id }) }) as ReactElement<{ children: ReactElement }>;
  const wewnetrzny = suspense.props.children as ReactElement<Record<string, unknown>> & {
    type: (p: Record<string, unknown>) => Promise<unknown>;
  };
  return wewnetrzny.type(wewnetrzny.props);
}

beforeEach(() => vi.clearAllMocks());

describe("/nawyki/[id]", () => {
  it("nieistniejące id → notFound()", async () => {
    loadHabitDetail.mockResolvedValue(null);
    await expect(wyrenderujWewnetrzny("00000000-0000-4000-8000-000000000000")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
    expect(loadHabitDetail).toHaveBeenCalledWith(expect.anything(), "u1", "00000000-0000-4000-8000-000000000000");
  });

  it("istniejący nawyk renderuje HabitDetail", async () => {
    loadHabitDetail.mockResolvedValue({ habits: [] });
    await expect(wyrenderujWewnetrzny("x")).resolves.toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
