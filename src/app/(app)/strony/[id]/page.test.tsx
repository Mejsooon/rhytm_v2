import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notFound, loadPage, loadPages } = vi.hoisted(() => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
  loadPage: vi.fn(),
  loadPages: vi.fn(),
}));
vi.mock("next/navigation", () => ({ notFound }));
vi.mock("next/server", () => ({ connection: vi.fn(async () => {}) }));
vi.mock("@/features/pages/load-page", () => ({ loadPage }));
vi.mock("@/features/pages/load-pages", () => ({ loadPages }));
vi.mock("@/features/pages/editor/editor-view", () => ({ EditorView: () => null }));
vi.mock("@/features/pages/table/template-page-view", () => ({ TemplatePageView: () => null }));

import { EditorView } from "@/features/pages/editor/editor-view";
import { TemplatePageView } from "@/features/pages/table/template-page-view";
import StronaPage from "./page";

// Strona opakowuje dane w Suspense; wywołujemy wewnętrzny komponent serwerowy wprost
async function wyrenderujWewnetrzny(id: string) {
  const suspense = StronaPage({ params: Promise.resolve({ id }) }) as ReactElement<{ children: ReactElement }>;
  const wewnetrzny = suspense.props.children as ReactElement<Record<string, unknown>> & {
    type: (p: Record<string, unknown>) => Promise<ReactElement>;
  };
  return wewnetrzny.type(wewnetrzny.props);
}

// Blok tabeli z jednym polem danego typu
function tabela(typ: string) {
  return {
    id: "t1",
    type: "table",
    position: 0,
    content: {},
    fields: [{ id: "f1", name: "Pole", type: typ, config: {}, position: 0, isTitle: false }],
    rows: [],
  };
}

function dane(templateKey: string | null, blocks: unknown[] = []) {
  return {
    page: { id: "p1", title: "Strona", icon: "", favorite: false, templateKey, position: 0, rowCount: 0, createdAt: "" },
    blocks,
    today: "2026-11-23",
    currency: "PLN",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadPages.mockResolvedValue([]);
});

describe("/strony/[id] (Review Focus 4)", () => {
  it("nieistniejąca strona → notFound()", async () => {
    loadPage.mockResolvedValue(null);
    await expect(wyrenderujWewnetrzny("x")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("strona Hasła („passwords”) zostaje w TemplatePageView", async () => {
    loadPage.mockResolvedValue(dane("passwords"));
    expect((await wyrenderujWewnetrzny("p1")).type).toBe(TemplatePageView);
  });

  it("strony z pozostałych szablonów i bez szablonu idą do EditorView", async () => {
    for (const klucz of ["books", "projects", "websites", "empty", null]) {
      loadPage.mockResolvedValue(dane(klucz));
      expect((await wyrenderujWewnetrzny("p1")).type).toBe(EditorView);
    }
  });

  it("strona z polem Sekret (np. dawne Books z dodanym Sekretem) zostaje w TemplatePageView z sejfem", async () => {
    loadPage.mockResolvedValue(dane("books", [{ id: "a", type: "text", position: 0, content: {}, fields: [], rows: [] }, tabela("secret")]));
    expect((await wyrenderujWewnetrzny("p1")).type).toBe(TemplatePageView);
  });

  it("strona Books z tabelą bez pola Sekret idzie do EditorView", async () => {
    loadPage.mockResolvedValue(dane("books", [tabela("text")]));
    expect((await wyrenderujWewnetrzny("p1")).type).toBe(EditorView);
  });
});
