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
  movePage,
  renamePage,
  restoreRow,
  saveTableSettings,
  updateRow,
  addField,
  changeFieldType,
  countPageRows,
  loadTrash,
  setFavorite,
  setPageIcon,
  updateBlockContent,
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
      p_icon: "",
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
      p_icon: "📚",
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

describe("countPageRows", () => {
  it("liczy żywe wiersze w żywych blokach strony (head + count, filtry na bloku)", async () => {
    tables.page_rows = fakeTable({ data: null });
    (tables.page_rows as { then: unknown }).then = (ok: (v: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, count: 7 }).then(ok);
    const w = await countPageRows(STRONA);
    expect(w).toEqual({ ok: true, count: 7 });
    const q = tables.page_rows;
    expect(q.select).toHaveBeenCalledWith("id, page_blocks!inner(page_id, deleted_at)", {
      count: "exact",
      head: true,
    });
    expect(q.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(q.is).toHaveBeenCalledWith("deleted_at", null);
    expect(q.eq).toHaveBeenCalledWith("page_blocks.page_id", STRONA);
    expect(q.is).toHaveBeenCalledWith("page_blocks.deleted_at", null);
  });

  it("odrzuca id, które nie jest UUID, bez zapytania", async () => {
    const w = await countPageRows("x");
    expect(w.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("błąd zapytania zwraca ok:false", async () => {
    tables.page_rows = fakeTable({ error: { message: "x" } });
    expect((await countPageRows(STRONA)).ok).toBe(false);
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

  it("deleteField tylko waliduje i woła RPC delete_field", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await deleteField(POLE_LICZBA)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("delete_field", { p_field_id: POLE_LICZBA });
    expect(tables.page_fields.delete).not.toHaveBeenCalled();
  });

  it("deleteField zwraca ok:false, gdy RPC odrzuci pole tytułowe", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Pola tytułowego nie można usunąć" } });
    expect((await deleteField(POLE_TYTUL)).ok).toBe(false);
    expect((await deleteField("nie-uuid")).ok).toBe(false);
  });

  it("changeFieldType na polu tytułowym zwraca ok:false bez RPC", async () => {
    tables.page_fields = fakeTable({ single: { is_title: true } });
    const w = await changeFieldType(POLE_TYTUL, "number", {}, {});
    expect(w.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("changeFieldType woła RPC z wartościami", async () => {
    tables.page_fields = fakeTable({ single: { is_title: false } });
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
  it("updateBlockContent w tabeli zachowuje settings z bazy", async () => {
    tables.page_blocks = fakeTable({
      single: { type: "table", content: { name: "Stara", settings: { sort: [{ field_id: "f", dir: "asc" }] } } },
    });
    const w = await updateBlockContent(BLOK, { name: "Nowa", settings: { sort: [] } });
    expect(w).toEqual({ ok: true });
    expect(tables.page_blocks.update).toHaveBeenCalledWith({
      content: { name: "Nowa", settings: { sort: [{ field_id: "f", dir: "asc" }] } },
    });
  });

  it("updateBlockContent w tekście zapisuje podaną treść", async () => {
    tables.page_blocks = fakeTable({ single: { type: "text", content: { text: "a" } } });
    await updateBlockContent(BLOK, { text: "b" });
    expect(tables.page_blocks.update).toHaveBeenCalledWith({ content: { text: "b" } });
  });

  it("setPageIcon zapisuje emoji, `lucide:…` i pusty tekst; odrzuca dłuższe niż 64 znaki", async () => {
    for (const ikona of ["📚", "lucide:rocket:blue", ""]) {
      expect(await setPageIcon(STRONA, ikona)).toEqual({ ok: true });
      expect(tables.pages.update).toHaveBeenLastCalledWith({ icon: ikona });
    }
    tables.pages.update.mockClear();
    expect((await setPageIcon(STRONA, "x".repeat(65))).ok).toBe(false);
    expect(tables.pages.update).not.toHaveBeenCalled();
  });

  it("movePage woła move_page raz (ulubione + kolejność w jednej transakcji) i odświeża sidebar", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    expect(await movePage([BLOK, STRONA], STRONA, true)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("move_page", { p_ids: [BLOK, STRONA], p_page_id: STRONA, p_favorite: true });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("movePage odrzuca stronę spoza listy, zły id i nie-boolean; błąd bazy → BLAD_ZAPISU", async () => {
    expect((await movePage([BLOK], STRONA, true)).ok).toBe(false);
    expect((await movePage(["x"], "x", true)).ok).toBe(false);
    expect((await movePage([STRONA], STRONA, "tak" as unknown as boolean)).ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(await movePage([STRONA], STRONA, false)).toEqual({ ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." });
  });

  it("setFavorite odrzuca nie-boolean", async () => {
    expect((await setFavorite(STRONA, "tak" as unknown as boolean)).ok).toBe(false);
    expect(tables.pages.update).not.toHaveBeenCalled();
  });

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

describe("loadTrash", () => {
  it("mapuje strony i wiersze z tytułem z pola tytułowego", async () => {
    tables.pages = fakeTable({
      data: [
        {
          id: STRONA,
          title: "Stara",
          deleted_at: "2026-11-18T10:00:00Z",
        },
      ],
    });
    tables.page_rows = fakeTable({
      data: [
        {
          id: WIERSZ,
          values: { [POLE_TYTUL]: "Dune" },
          deleted_at: "2026-11-19T09:00:00Z",
          page_blocks: {
            pages: { title: "Books" },
            page_fields: [{ id: POLE_TYTUL, is_title: true, config: {} }],
          },
        },
        {
          id: STRONA,
          values: {},
          deleted_at: "2026-11-19T08:00:00Z",
          page_blocks: { pages: { title: "Books" }, page_fields: [{ id: POLE_TYTUL, is_title: true, config: {} }] },
        },
      ],
    });
    const w = await loadTrash();
    expect(w).toEqual({
      ok: true,
      pages: [{ id: STRONA, title: "Stara", deletedAt: "2026-11-18T10:00:00Z" }],
      rows: [
        { id: WIERSZ, title: "Dune", pageTitle: "Books", deletedAt: "2026-11-19T09:00:00Z" },
        { id: STRONA, title: "Bez tytułu", pageTitle: "Books", deletedAt: "2026-11-19T08:00:00Z" },
      ],
    });
  });
});

// ---------- Sekret (sejf) ----------

describe("pole Sekret", () => {
  const POLE_SEKRET = "a3000000-0000-4000-8000-000000000009";
  const polaZSekretem = [
    ...pola,
    { id: POLE_SEKRET, name: "Hasło", type: "secret", config: {}, position: 2, is_title: false },
  ];
  const SEKRET = { v: 1 as const, g: 2, iv: "A".repeat(16), ct: "A".repeat(24) };
  const NIEZALOGOWANY = "Nie zapisano. Sejf musi być odblokowany.";
  const INNA_KARTA = "Sejf zmienił się w innej karcie. Odblokuj go ponownie.";

  beforeEach(() => {
    tables.page_fields = fakeTable({ data: polaZSekretem });
    tables.vaults = fakeTable({ single: { status: "active", generation: 2 } });
  });

  it("updateRow odrzuca string w polu secret", async () => {
    const w = await updateRow(WIERSZ, { [POLE_SEKRET]: "tajne-haslo" });
    expect(w).toEqual({ ok: false, message: NIEZALOGOWANY });
    expect(tables.page_rows.update).not.toHaveBeenCalled();
  });

  it("updateRow odrzuca SecretValue z g różnym od vaults.generation", async () => {
    const w = await updateRow(WIERSZ, { [POLE_SEKRET]: { ...SEKRET, g: 1 } });
    expect(w).toEqual({ ok: false, message: INNA_KARTA, code: "stale_generation" });
    expect(tables.page_rows.update).not.toHaveBeenCalled();
  });

  it("updateRow odrzuca SecretValue, gdy sejf nie jest aktywny", async () => {
    tables.vaults = fakeTable({ single: null });
    const w = await updateRow(WIERSZ, { [POLE_SEKRET]: SEKRET });
    expect(w).toEqual({ ok: false, message: NIEZALOGOWANY });
    expect(tables.page_rows.update).not.toHaveBeenCalled();
  });

  it("updateRow: wiersz sejfu ze statusem reset — złe g to „innej karcie”, zgodne g to „odblokowany”", async () => {
    tables.vaults = fakeTable({ single: { status: "reset", generation: 3 } });
    expect(await updateRow(WIERSZ, { [POLE_SEKRET]: { ...SEKRET, g: 2 } })).toEqual({ ok: false, message: INNA_KARTA, code: "stale_generation" });
    expect(await updateRow(WIERSZ, { [POLE_SEKRET]: { ...SEKRET, g: 3 } })).toEqual({ ok: false, message: NIEZALOGOWANY });
    expect(tables.page_rows.update).not.toHaveBeenCalled();
  });

  it("addRow: wiersz sejfu ze statusem reset — złe g to „innej karcie”, zgodne g to „odblokowany”", async () => {
    tables.vaults = fakeTable({ single: { status: "reset", generation: 3 } });
    expect(await addRow(BLOK, { [POLE_SEKRET]: { ...SEKRET, g: 2 } })).toEqual({ ok: false, message: INNA_KARTA, code: "stale_generation" });
    expect(await addRow(BLOK, { [POLE_SEKRET]: { ...SEKRET, g: 3 } })).toEqual({ ok: false, message: NIEZALOGOWANY });
    expect(tables.page_rows.insert).not.toHaveBeenCalled();
  });

  it("updateRow przyjmuje null i SecretValue z aktualnym g", async () => {
    expect(await updateRow(WIERSZ, { [POLE_SEKRET]: SEKRET })).toEqual({ ok: true });
    expect(tables.page_rows.update).toHaveBeenLastCalledWith({
      values: { [POLE_TYTUL]: "Dune", [POLE_SEKRET]: SEKRET },
    });
    // null nie wymaga nawet odczytu sejfu
    tables.vaults = fakeTable({ single: null });
    expect(await updateRow(WIERSZ, { [POLE_SEKRET]: null })).toEqual({ ok: true });
    expect(tables.page_rows.update).toHaveBeenLastCalledWith({
      values: { [POLE_TYTUL]: "Dune", [POLE_SEKRET]: null },
    });
  });

  it("addRow — to samo dla secret", async () => {
    tables.page_rows = fakeTable({ single: { id: WIERSZ, values: {}, position: 0, deleted_at: null } });
    expect(await addRow(BLOK, { [POLE_SEKRET]: "tajne" })).toEqual({ ok: false, message: NIEZALOGOWANY });
    expect(await addRow(BLOK, { [POLE_SEKRET]: { ...SEKRET, g: 9 } })).toEqual({ ok: false, message: INNA_KARTA, code: "stale_generation" });
    expect(tables.page_rows.insert).not.toHaveBeenCalled();

    expect((await addRow(BLOK, { [POLE_SEKRET]: SEKRET })).ok).toBe(true);
    expect(tables.page_rows.insert).toHaveBeenLastCalledWith(
      expect.objectContaining({ values: { [POLE_TYTUL]: "Bez nazwy", [POLE_SEKRET]: SEKRET } }),
    );
    expect((await addRow(BLOK, { [POLE_SEKRET]: null })).ok).toBe(true);
  });

  it("changeFieldType z i na secret zwraca błąd", async () => {
    // Na secret
    tables.page_fields = fakeTable({ single: { is_title: false, type: "text" } });
    expect(await changeFieldType(POLE_LICZBA, "secret", {}, {})).toEqual({
      ok: false,
      message: "Nie można zmienić typu pola Sekret.",
    });
    // Z secret
    tables.page_fields = fakeTable({ single: { is_title: false, type: "secret" } });
    expect(await changeFieldType(POLE_SEKRET, "text", {}, {})).toEqual({
      ok: false,
      message: "Nie można zmienić typu pola Sekret.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("addField secret na stronie bez szablonu zwraca błąd", async () => {
    const BLAD = "Pole Sekret jest dostępne tylko na stronach z szablonu.";
    for (const klucz of [null, "empty"]) {
      tables.page_blocks = fakeTable({ single: { id: BLOK, pages: { template_key: klucz } } });
      const w = await addField(BLOK, { name: "Hasło", type: "secret", config: {} });
      expect(w).toEqual({ ok: false, message: BLAD });
    }
    expect(tables.page_fields.insert).not.toHaveBeenCalled();

    // Strona z szablonu przyjmuje pole Sekret
    tables.page_blocks = fakeTable({ single: { id: BLOK, pages: { template_key: "passwords" } } });
    tables.page_fields = fakeTable({
      single: { id: POLE_SEKRET, name: "Hasło", type: "secret", config: {}, position: 3, is_title: false },
    });
    const w = await addField(BLOK, { name: "Hasło", type: "secret", config: {} });
    expect(w.ok).toBe(true);
  });
});
