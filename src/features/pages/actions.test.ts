import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";

const { getUser, from, rpc, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  addBlock,
  addRow,
  createBlankPage,
  createPageFromTemplate,
  deleteField,
  deletePage,
  deleteRow,
  renamePage,
  restoreRow,
  saveTableSettings,
  updateRow,
  addField,
  changeFieldType,
} from "./actions";
import { buildTemplateBlocks } from "./templates";

const STRONA = "a1000000-0000-4000-8000-000000000001";
const BLOK = "a2000000-0000-4000-8000-000000000001";
const POLE_TYTUL = "a3000000-0000-4000-8000-000000000001";
const POLE_LICZBA = "a3000000-0000-4000-8000-000000000002";
const POLE_DATA = "a3000000-0000-4000-8000-000000000003";
const WIERSZ = "a4000000-0000-4000-8000-000000000001";

type Fake = ReturnType<typeof fakeTable>;
let tables: Record<string, Fake>;

const pola = [
  {
    id: POLE_TYTUL,
    name: "Nazwa",
    type: "text",
    config: { empty_label: "Bez nazwy" },
    position: 0,
    is_title: true,
  },
  { id: POLE_LICZBA, name: "Cena", type: "number", config: {}, position: 1, is_title: false },
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-19T10:00:00Z"));
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  rpc.mockResolvedValue({ data: STRONA, error: null });
  tables = {
    pages: fakeTable({ single: { id: STRONA } }),
    page_blocks: fakeTable({ single: { type: "table", content: {}, position: 0 } }),
    page_fields: fakeTable({ data: pola, single: { block_id: BLOK, is_title: false } }),
    page_rows: fakeTable({
      data: [],
      single: { block_id: BLOK, values: { [POLE_TYTUL]: "Dune" } },
    }),
  };
  from.mockImplementation((nazwa: string) => tables[nazwa]);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("bez sesji", () => {
  it.each([
    ["createBlankPage", () => createBlankPage()],
    ["createPageFromTemplate", () => createPageFromTemplate("books", "")],
    ["deleteRow", () => deleteRow(WIERSZ)],
    ["updateRow", () => updateRow(WIERSZ, {})],
    ["deleteField", () => deleteField(POLE_LICZBA)],
  ])("%s przekierowuje na /logowanie", async (_nazwa, akcja) => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(akcja()).rejects.toThrow("REDIRECT:/logowanie");
  });
});

describe("strony", () => {
  it("createBlankPage woła create_page bez szablonu i bez bloków", async () => {
    const w = await createBlankPage();
    expect(w).toEqual({ ok: true, id: STRONA });
    expect(rpc).toHaveBeenCalledWith("create_page", {
      p_title: "",
      p_icon: "▦",
      p_template_key: null,
      p_blocks: [],
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("createPageFromTemplate('books', '') bierze nazwę szablonu i bloki z buildTemplateBlocks", async () => {
    let n = 0;
    vi.spyOn(crypto, "randomUUID").mockImplementation(
      () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}` as `${string}-${string}-${string}-${string}-${string}`,
    );
    const w = await createPageFromTemplate("books", "  ");
    expect(w).toEqual({ ok: true, id: STRONA });
    let m = 0;
    const oczekiwane = buildTemplateBlocks(
      "books",
      () => `00000000-0000-4000-8000-${String(++m).padStart(12, "0")}`,
    );
    expect(rpc).toHaveBeenCalledWith("create_page", {
      p_title: "Books",
      p_icon: "▦",
      p_template_key: "books",
      p_blocks: oczekiwane,
    });
  });

  it("createPageFromTemplate zostawia własny tytuł", async () => {
    await createPageFromTemplate("projects", "Moje projekty");
    expect(rpc.mock.calls[0][1]).toMatchObject({ p_title: "Moje projekty", p_template_key: "projects" });
  });

  it("zod odrzuca tytuł strony dłuższy niż 200 znaków", async () => {
    const w = await renamePage(STRONA, "x".repeat(201));
    expect(w.ok).toBe(false);
    expect(tables.pages.update).not.toHaveBeenCalled();
    const s = await createPageFromTemplate("books", "x".repeat(201));
    expect(s.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("deletePage ustawia deleted_at i odświeża sidebar", async () => {
    expect(await deletePage(STRONA)).toEqual({ ok: true });
    expect(tables.pages.update).toHaveBeenCalledWith({ deleted_at: "2026-11-19T10:00:00.000Z" });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });
});

describe("pola", () => {
  it("odrzuca pustą nazwę pola i dłuższą niż 60 znaków", async () => {
    for (const nazwa of ["", "   ", "x".repeat(61)]) {
      const w = await addField(BLOK, { name: nazwa, type: "text", config: {} });
      expect(w.ok).toBe(false);
    }
    expect(tables.page_fields.insert).not.toHaveBeenCalled();
  });

  it("addField dopisuje pole na końcu", async () => {
    tables.page_fields = fakeTable({
      single: { id: POLE_DATA, name: "Termin", type: "date", config: {}, position: 2, is_title: false },
    });
    const w = await addField(BLOK, { name: " Termin ", type: "date", config: {} });
    expect(w).toEqual({
      ok: true,
      field: { id: POLE_DATA, name: "Termin", type: "date", config: {}, position: 2, isTitle: false },
    });
    expect(tables.page_fields.insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Termin", type: "date", is_title: false, user_id: "u1" }),
    );
  });

  it("deleteField na polu tytułowym zwraca ok:false bez usuwania", async () => {
    tables.page_fields = fakeTable({ single: { block_id: BLOK, is_title: true } });
    const w = await deleteField(POLE_TYTUL);
    expect(w.ok).toBe(false);
    expect(tables.page_fields.delete).not.toHaveBeenCalled();
    expect(tables.page_blocks.update).not.toHaveBeenCalled();
    expect(tables.page_rows.update).not.toHaveBeenCalled();
  });

  it("deleteField czyści ustawienia bloku i klucz w values wierszy", async () => {
    const inne = "a3000000-0000-4000-8000-0000000000ff";
    tables.page_blocks = fakeTable({
      single: {
        content: {
          name: "X",
          settings: {
            sort: [{ field_id: POLE_LICZBA, dir: "asc" }, { field_id: inne, dir: "desc" }],
            filters: [{ field_id: POLE_LICZBA, op: "gte", value: 1 }],
            hidden_field_ids: [POLE_LICZBA, inne],
            column_summaries: { [POLE_LICZBA]: { kind: "sum" }, [inne]: { kind: "count" } },
            pinned_cards: [
              { label: "A", field_id: POLE_LICZBA, aggregation: "avg" },
              { label: "B", field_id: inne, aggregation: "avg" },
            ],
          },
        },
      },
    });
    tables.page_rows = fakeTable({
      data: [{ id: WIERSZ, values: { [POLE_LICZBA]: 5, [POLE_TYTUL]: "Dune" } }],
    });
    const w = await deleteField(POLE_LICZBA);
    expect(w).toEqual({ ok: true });
    expect(tables.page_fields.delete).toHaveBeenCalled();
    expect(tables.page_blocks.update).toHaveBeenCalledWith({
      content: {
        name: "X",
        settings: {
          sort: [{ field_id: inne, dir: "desc" }],
          filters: [],
          hidden_field_ids: [inne],
          column_summaries: { [inne]: { kind: "count" } },
          pinned_cards: [{ label: "B", field_id: inne, aggregation: "avg" }],
        },
      },
    });
    expect(tables.page_rows.update).toHaveBeenCalledWith({ values: { [POLE_TYTUL]: "Dune" } });
  });

  it("changeFieldType woła RPC z wartościami", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const w = await changeFieldType(POLE_LICZBA, "text", {}, { [WIERSZ]: "5", [STRONA]: null });
    expect(w).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("change_field_type", {
      p_field_id: POLE_LICZBA,
      p_type: "text",
      p_config: {},
      p_values: { [WIERSZ]: "5", [STRONA]: null },
    });
  });
});

describe("wiersze", () => {
  it("updateRow z pustym tytułem zapisuje empty_label, a „abc” w Liczbie zapisuje null", async () => {
    tables.page_fields = fakeTable({ data: pola });
    const w = await updateRow(WIERSZ, { [POLE_TYTUL]: "  ", [POLE_LICZBA]: "abc", nieznane: 1 });
    expect(w).toEqual({ ok: true });
    expect(tables.page_rows.update).toHaveBeenCalledWith({
      values: { [POLE_TYTUL]: "Bez nazwy", [POLE_LICZBA]: null },
    });
  });

  it("updateRow zachowuje pozostałe komórki i liczy liczbę z tekstu", async () => {
    tables.page_fields = fakeTable({ data: pola });
    await updateRow(WIERSZ, { [POLE_LICZBA]: "12,5" });
    expect(tables.page_rows.update).toHaveBeenCalledWith({
      values: { [POLE_TYTUL]: "Dune", [POLE_LICZBA]: 12.5 },
    });
  });

  it("deleteRow ustawia deleted_at, a restoreRow czyści je", async () => {
    expect(await deleteRow(WIERSZ)).toEqual({ ok: true });
    expect(tables.page_rows.update).toHaveBeenCalledWith({ deleted_at: "2026-11-19T10:00:00.000Z" });
    expect(await restoreRow(WIERSZ)).toEqual({ ok: true });
    expect(tables.page_rows.update).toHaveBeenLastCalledWith({ deleted_at: null });
  });

  it("addRow normalizuje wartości, wstawia na koniec i uzupełnia pusty tytuł", async () => {
    tables.page_fields = fakeTable({ data: pola });
    tables.page_rows = fakeTable({
      single: { id: WIERSZ, values: {}, position: 4, deleted_at: null, },
    });
    // maybeSingle (ostatnia pozycja) i single (wstawiony wiersz) dzielą wynik atrapy
    const w = await addRow(BLOK, { [POLE_LICZBA]: "7" });
    expect(w.ok).toBe(true);
    expect(tables.page_rows.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        block_id: BLOK,
        user_id: "u1",
        values: { [POLE_TYTUL]: "Bez nazwy", [POLE_LICZBA]: 7 },
      }),
    );
  });
});

describe("bloki i ustawienia", () => {
  it("addBlock('table') wstawia blok, pola i dwa wiersze", async () => {
    tables.page_blocks = fakeTable({ single: null });
    tables.page_rows = fakeTable({
      data: [
        { id: WIERSZ, values: {}, position: 0, deleted_at: null },
        { id: STRONA, values: {}, position: 1, deleted_at: null },
      ],
    });
    const w = await addBlock(STRONA, "table");
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    expect(w.block.type).toBe("table");
    expect(w.block.fields.map((f) => f.name)).toEqual(["Nazwa", "Status", "Data"]);
    expect(w.block.rows).toHaveLength(2);
    expect(tables.page_fields.insert).toHaveBeenCalledTimes(1);
  });

  it("saveTableSettings scala patch z istniejącymi ustawieniami", async () => {
    tables.page_blocks = fakeTable({
      single: { type: "table", content: { name: "T", settings: { sort: [], hidden_field_ids: ["x"] } } },
    });
    const w = await saveTableSettings(BLOK, {
      sort: [{ field_id: POLE_LICZBA, dir: "desc" }],
    });
    expect(w).toEqual({ ok: true });
    expect(tables.page_blocks.update).toHaveBeenCalledWith({
      content: {
        name: "T",
        settings: { sort: [{ field_id: POLE_LICZBA, dir: "desc" }], hidden_field_ids: ["x"] },
      },
    });
  });

  it("saveTableSettings odrzuca blok, który nie jest tabelą", async () => {
    tables.page_blocks = fakeTable({ single: { type: "text", content: {} } });
    const w = await saveTableSettings(BLOK, { sort: [] });
    expect(w.ok).toBe(false);
    expect(tables.page_blocks.update).not.toHaveBeenCalled();
  });
});
