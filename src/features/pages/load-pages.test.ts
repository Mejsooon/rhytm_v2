import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";

const { getUser, from, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));

import { loadPages } from "./load-pages";
import { loadPage } from "./load-page";

const STRONA = "a1000000-0000-4000-8000-000000000001";

let tables: Record<string, ReturnType<typeof fakeTable>>;

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  tables = {
    pages: fakeTable({
      data: [
        {
          id: STRONA,
          title: "Books",
          icon: "▦",
          favorite: true,
          template_key: "books",
          position: 0,
          page_blocks: [{ page_rows: [{ count: 3 }] }, { page_rows: [{ count: 2 }] }],
        },
        {
          id: "a1000000-0000-4000-8000-000000000002",
          title: "",
          icon: "▦",
          favorite: false,
          template_key: null,
          position: 1,
          page_blocks: [{ page_rows: [{ count: 0 }] }],
        },
      ],
    }),
  };
  from.mockImplementation((nazwa: string) => tables[nazwa]);
});

describe("loadPages", () => {
  it("claim_pending_pages → ['Projects'] tworzy jedną stronę z szablonu projects", async () => {
    rpc.mockImplementation(async (nazwa: string) =>
      nazwa === "claim_pending_pages"
        ? { data: ["Projects"], error: null }
        : { data: STRONA, error: null },
    );
    await loadPages();
    expect(rpc).toHaveBeenCalledWith("claim_pending_pages", {
      p_available: ["Books", "Projects", "Websites"],
    });
    const utworzenia = rpc.mock.calls.filter((c) => c[0] === "create_page");
    expect(utworzenia).toHaveLength(1);
    expect(utworzenia[0][1]).toMatchObject({
      p_title: "Projects",
      p_template_key: "projects",
    });
  });

  it("przy pustym claim_pending_pages nie woła create_page", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await loadPages();
    expect(rpc.mock.calls.filter((c) => c[0] === "create_page")).toHaveLength(0);
  });

  it("mapuje kolumny na camelCase i sumuje wiersze tabel", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const strony = await loadPages();
    expect(strony).toEqual([
      { id: STRONA, title: "Books", icon: "▦", favorite: true, templateKey: "books", position: 0, rowCount: 5 },
      {
        id: "a1000000-0000-4000-8000-000000000002",
        title: "",
        icon: "▦",
        favorite: false,
        templateKey: null,
        position: 1,
        rowCount: 0,
      },
    ]);
    expect(tables.pages.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("bez sesji zwraca pustą listę bez zapytań", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await loadPages()).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe("loadPage", () => {
  it("zwraca null dla złego id i dla nieistniejącej strony", async () => {
    expect(await loadPage("nie-uuid")).toBeNull();
    tables = {
      pages: fakeTable({ single: null }),
      profiles: fakeTable({ single: null }),
      page_blocks: fakeTable({ data: [] }),
    };
    expect(await loadPage(STRONA)).toBeNull();
  });

  it("składa blok z polami i wierszami w camelCase", async () => {
    tables = {
      pages: fakeTable({
        single: { id: STRONA, title: "T", icon: "▦", favorite: false, template_key: null, position: 0, created_at: "2026-11-19T10:00:00Z" },
      }),
      profiles: fakeTable({ single: { timezone: "Europe/Warsaw", currency: "EUR" } }),
      page_blocks: fakeTable({ data: [{ id: "b1", type: "table", position: 0, content: { name: "" } }] }),
      page_fields: fakeTable({
        data: [{ id: "f1", block_id: "b1", name: "Nazwa", type: "text", config: {}, position: 0, is_title: true }],
      }),
      page_rows: fakeTable({
        data: [{ id: "r1", block_id: "b1", values: { f1: "x" }, position: 0, deleted_at: null }],
      }),
    };
    const w = await loadPage(STRONA);
    expect(w?.currency).toBe("EUR");
    expect(w?.page.rowCount).toBe(1);
    expect(w?.blocks[0].fields[0].isTitle).toBe(true);
    expect(w?.blocks[0].rows[0]).toEqual({ id: "r1", values: { f1: "x" }, position: 0, deletedAt: null });
    expect(tables.page_rows.is).toHaveBeenCalledWith("deleted_at", null);
  });
});
