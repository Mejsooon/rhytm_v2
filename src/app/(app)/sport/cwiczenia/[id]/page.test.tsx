import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFound, loadExercise } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  loadExercise: vi.fn(),
}));
vi.mock("next/navigation", () => ({ notFound, redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  }),
}));
vi.mock("@/features/sport/load-sport", () => ({ loadExercise }));
vi.mock("@/features/sport/exercise-detail", () => ({
  ExerciseDetail: () => null,
}));

import CwiczeniePage from "./page";

// Strona opakowuje dane w Suspense; wywołujemy wewnętrzny komponent serwerowy wprost
async function wyrenderujWewnetrzny(id: string) {
  const suspense = CwiczeniePage({
    params: Promise.resolve({ id }),
  }) as ReactElement<{ children: ReactElement }>;
  const wewnetrzny = suspense.props.children as ReactElement<
    Record<string, unknown>
  > & {
    type: (p: Record<string, unknown>) => Promise<unknown>;
  };
  return wewnetrzny.type(wewnetrzny.props);
}

beforeEach(() => vi.clearAllMocks());

describe("/sport/cwiczenia/[id]", () => {
  it("brak albo cudze ćwiczenie → notFound()", async () => {
    loadExercise.mockResolvedValue(null);
    await expect(
      wyrenderujWewnetrzny("00000000-0000-4000-8000-000000000000"),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
    expect(loadExercise).toHaveBeenCalledWith(
      expect.anything(),
      "u1",
      "00000000-0000-4000-8000-000000000000",
    );
  });

  it("istniejące ćwiczenie renderuje ExerciseDetail", async () => {
    loadExercise.mockResolvedValue({ history: [] });
    await expect(wyrenderujWewnetrzny("x")).resolves.toBeTruthy();
    expect(notFound).not.toHaveBeenCalled();
  });
});
