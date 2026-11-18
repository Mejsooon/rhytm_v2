import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";

const { loadTemplates } = vi.hoisted(() => ({ loadTemplates: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
  }),
}));
vi.mock("@/features/sport/load-sport", () => ({ loadTemplates }));
vi.mock("@/features/sport/template-editor", () => ({
  TemplateEditor: () => null,
}));

import NowySzablonPage from "./page";

describe("/sport/szablony/nowy", () => {
  it("pusty edytor z profilem i ćwiczeniami użytkownika", async () => {
    const profile = { clock: "12" };
    const exercises = [{ id: "e1" }];
    loadTemplates.mockResolvedValue({ profile, exercises, templates: [] });
    const suspense = NowySzablonPage() as ReactElement<{
      children: ReactElement;
    }>;
    const wewnetrzny = suspense.props.children as ReactElement<
      Record<string, unknown>
    > & { type: (p: Record<string, unknown>) => Promise<ReactElement> };
    const wynik = (await wewnetrzny.type(wewnetrzny.props)) as ReactElement<{
      data: unknown;
    }>;
    expect(wynik.props.data).toEqual({ profile, exercises, template: null });
  });
});
