import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFound, loadTemplate } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  loadTemplate: vi.fn(),
}));
vi.mock("next/navigation", () => ({ notFound, redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  }),
}));
vi.mock("@/features/sport/load-sport", () => ({ loadTemplate }));
vi.mock("@/features/sport/template-editor", () => ({
  TemplateEditor: () => null,
}));

import EdycjaSzablonuPage from "./page";

async function wyrenderujWewnetrzny(id: string) {
  const suspense = EdycjaSzablonuPage({
    params: Promise.resolve({ id }),
  }) as ReactElement<{ children: ReactElement }>;
  const wewnetrzny = suspense.props.children as ReactElement<
    Record<string, unknown>
  > & { type: (p: Record<string, unknown>) => Promise<ReactElement> };
  return wewnetrzny.type(wewnetrzny.props);
}

beforeEach(() => vi.clearAllMocks());

describe("/sport/szablony/[id]", () => {
  it("brak albo cudzy szablon → notFound()", async () => {
    loadTemplate.mockResolvedValue(null);
    await expect(wyrenderujWewnetrzny("zly")).rejects.toThrow("NEXT_NOT_FOUND");
    expect(loadTemplate).toHaveBeenCalledWith(expect.anything(), "u1", "zly");
  });

  it("istniejący szablon trafia do edytora", async () => {
    const template = { id: "t1", items: [] };
    loadTemplate.mockResolvedValue({
      profile: { clock: "24" },
      exercises: [],
      template,
    });
    const wynik = (await wyrenderujWewnetrzny("t1")) as ReactElement<{
      data: { template: unknown };
    }>;
    expect(wynik.props.data.template).toBe(template);
    expect(notFound).not.toHaveBeenCalled();
  });
});
