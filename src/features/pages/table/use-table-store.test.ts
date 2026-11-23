import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  addField: vi.fn(),
  addRow: vi.fn(),
  changeFieldType: vi.fn(),
  deleteField: vi.fn(),
  updateField: vi.fn(),
  deleteRow: vi.fn(),
  restoreRow: vi.fn(),
  saveTableSettings: vi.fn(),
  updateRow: vi.fn(),
  updateBlockContent: vi.fn(),
  reorderFields: vi.fn(),
}));
const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("../actions", () => actions);

import type { LoadedBlock } from "../load-page";
import { BLAD_ZAPISU } from "../messages";
import { stronaTestowa } from "./test-page";
import { useTableStore } from "./use-table-store";

const KSIAZKI = [
  { Tytuł: "Atomic Habits", Autor: "James Clear", Status: "Czytam" },
  { Tytuł: "Deep Work", Autor: "Cal Newport", Status: "Przeczytane", Ocena: 4 },
];

// Blok tabeli „books” z dwoma wierszami (row-1, row-2)
function blok(): LoadedBlock {
  return stronaTestowa("books", "Strona", KSIAZKI).blocks[0];
}

// Obietnica rozwiązywana ręcznie z testu (zapis „w toku”)
function odroczona<T>() {
  let rozwiaz!: (v: T) => void;
  const obietnica = new Promise<T>((r) => {
    rozwiaz = r;
  });
  return { obietnica, rozwiaz };
}

describe("useTableStore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const a of Object.values(actions)) a.mockResolvedValue({ ok: true });
  });

  describe("updateCell", () => {
    it("wysyła tylko jedną komórkę i od razu zmienia widok", async () => {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const { result } = renderHook(() => useTableStore(b));
      let wynik: boolean | undefined;
      await act(async () => {
        wynik = await result.current.updateCell(result.current.rows[0], autor, "J. Clear");
      });
      expect(wynik).toBe(true);
      expect(actions.updateRow).toHaveBeenCalledTimes(1);
      expect(actions.updateRow).toHaveBeenCalledWith("row-1", { [autor.id]: "J. Clear" });
      expect(result.current.rows[0].values[autor.id]).toBe("J. Clear");
    });

    it("pusty tytuł zapisuje empty_label", async () => {
      const b = blok();
      const tytul = b.fields.find((f) => f.isTitle)!;
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.updateCell(result.current.rows[0], tytul, "   ");
      });
      expect(actions.updateRow).toHaveBeenCalledWith("row-1", { [tytul.id]: "Bez tytułu" });
      expect(result.current.rows[0].values[tytul.id]).toBe("Bez tytułu");
    });

    it("wartość bez zmian nie wysyła zapisu i zwraca true", async () => {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const { result } = renderHook(() => useTableStore(b));
      let wynik: boolean | undefined;
      await act(async () => {
        wynik = await result.current.updateCell(result.current.rows[0], autor, "James Clear");
      });
      expect(wynik).toBe(true);
      expect(actions.updateRow).not.toHaveBeenCalled();
    });

    it("wiersz z tymczasowym id: nic nie robi i zwraca false", async () => {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const { result } = renderHook(() => useTableStore(b));
      let wynik: boolean | undefined;
      await act(async () => {
        wynik = await result.current.updateCell(
          { id: "tmp-w1", values: {}, position: 5, deletedAt: null },
          autor,
          "X",
        );
      });
      expect(wynik).toBe(false);
      expect(actions.updateRow).not.toHaveBeenCalled();
    });

    it("dwie szybkie zmiany różnych komórek, druga z błędem: pierwsza zostaje, druga się cofa", async () => {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const ocena = b.fields.find((f) => f.name === "Ocena")!;
      const pierwsza = odroczona<{ ok: boolean }>();
      const druga = odroczona<{ ok: boolean; message?: string }>();
      actions.updateRow.mockReturnValueOnce(pierwsza.obietnica).mockReturnValueOnce(druga.obietnica);
      const { result } = renderHook(() => useTableStore(b));
      let p1: Promise<boolean> | undefined;
      let p2: Promise<boolean> | undefined;
      act(() => {
        p1 = result.current.updateCell(result.current.rows[0], autor, "J. Clear");
      });
      act(() => {
        p2 = result.current.updateCell(result.current.rows[0], ocena, 5);
      });
      expect(result.current.rows[0].values[autor.id]).toBe("J. Clear");
      expect(result.current.rows[0].values[ocena.id]).toBe(5);
      await act(async () => {
        druga.rozwiaz({ ok: false, message: "x" });
        await p2;
      });
      await act(async () => {
        pierwsza.rozwiaz({ ok: true });
        await p1;
      });
      expect(result.current.rows[0].values[autor.id]).toBe("J. Clear");
      expect(result.current.rows[0].values[ocena.id]).toBeUndefined();
      expect(toast.error).toHaveBeenCalledWith(BLAD_ZAPISU);
      expect(toast.error).toHaveBeenCalledTimes(1);
    });
  });

  describe("addRowInline", () => {
    it("zwraca prawdziwe id, a wiersz ma opcję domyślną", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      actions.addRow.mockImplementation(async (_b: string, values: Record<string, unknown>) => ({
        ok: true,
        row: { id: "srv-1", values, position: 2, deletedAt: null },
      }));
      const { result } = renderHook(() => useTableStore(b));
      let id: string | null | undefined;
      await act(async () => {
        id = await result.current.addRowInline();
      });
      expect(id).toBe("srv-1");
      expect(actions.addRow).toHaveBeenCalledWith(b.id, { [status.id]: status.config.default_option });
      const nowy = result.current.rows.find((r) => r.id === "srv-1")!;
      expect(nowy.values[status.id]).toBe(status.config.default_option);
      expect(result.current.rows).toHaveLength(3);
    });

    it("błąd zwraca null i pokazuje toast", async () => {
      actions.addRow.mockResolvedValue({ ok: false, message: "x" });
      const { result } = renderHook(() => useTableStore(blok()));
      let id: string | null | undefined;
      await act(async () => {
        id = await result.current.addRowInline();
      });
      expect(id).toBeNull();
      expect(toast.error).toHaveBeenCalledWith(BLAD_ZAPISU);
      expect(result.current.rows).toHaveLength(2);
    });
  });

  describe("opcje", () => {
    it("createOption z „ Czytam ” przy istniejącym „czytam” daje null", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      // Etykieta istniejącej opcji małymi literami
      const zmienione = {
        ...b,
        fields: b.fields.map((f) =>
          f.id === status.id
            ? {
                ...f,
                config: {
                  ...f.config,
                  options: f.config.options!.map((o) => (o.label === "Czytam" ? { ...o, label: "czytam" } : o)),
                },
              }
            : f,
        ),
      };
      const { result } = renderHook(() => useTableStore(zmienione));
      const pole = result.current.fields.find((f) => f.id === status.id)!;
      let id: string | null | undefined;
      await act(async () => {
        id = await result.current.createOption(pole, " Czytam ");
      });
      expect(id).toBeNull();
      expect(actions.updateField).not.toHaveBeenCalled();
    });

    it("createOption z pustą nazwą daje null", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const { result } = renderHook(() => useTableStore(b));
      let id: string | null | undefined;
      await act(async () => {
        id = await result.current.createOption(status, "   ");
      });
      expect(id).toBeNull();
      expect(actions.updateField).not.toHaveBeenCalled();
    });

    it("createOption(„Porzucone”) zwraca id, a opcja ma kolor #525252", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const { result } = renderHook(() => useTableStore(b));
      let id: string | null | undefined;
      await act(async () => {
        id = await result.current.createOption(status, " Porzucone ");
      });
      expect(typeof id).toBe("string");
      const opcje = result.current.fields.find((f) => f.id === status.id)!.config.options!;
      expect(opcje.at(-1)).toEqual({ id, label: "Porzucone", color: "#525252" });
      expect(actions.updateField).toHaveBeenCalledWith(status.id, {
        config: expect.objectContaining({ options: [...status.config.options!, { id, label: "Porzucone", color: "#525252" }] }),
      });
    });

    it("createOption przy błędzie zapisu daje null", async () => {
      actions.updateField.mockResolvedValue({ ok: false, message: "x" });
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const { result } = renderHook(() => useTableStore(b));
      let id: string | null | undefined;
      await act(async () => {
        id = await result.current.createOption(status, "Porzucone");
      });
      expect(id).toBeNull();
      expect(result.current.fields.find((f) => f.id === status.id)!.config.options).toHaveLength(3);
    });

    it("updateOption zmienia etykietę, a wiersze dalej wskazują to samo id", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const czytam = status.config.options!.find((o) => o.label === "Czytam")!;
      const { result } = renderHook(() => useTableStore(b));
      let wynik: boolean | undefined;
      await act(async () => {
        wynik = await result.current.updateOption(status, czytam.id, { label: " Czytam teraz ", color: "#0e7490" });
      });
      expect(wynik).toBe(true);
      const opcja = result.current.fields.find((f) => f.id === status.id)!.config.options!.find((o) => o.id === czytam.id);
      expect(opcja).toEqual({ id: czytam.id, label: "Czytam teraz", color: "#0e7490" });
      expect(result.current.rows[0].values[status.id]).toBe(czytam.id);
      expect(actions.updateRow).not.toHaveBeenCalled();
    });

    it("updateOption z pustą albo zduplikowaną nazwą daje false bez zapisu", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const czytam = status.config.options!.find((o) => o.label === "Czytam")!;
      const { result } = renderHook(() => useTableStore(b));
      let pusta: boolean | undefined;
      let duplikat: boolean | undefined;
      await act(async () => {
        pusta = await result.current.updateOption(status, czytam.id, { label: "  " });
        duplikat = await result.current.updateOption(status, czytam.id, { label: "przeczytane" });
      });
      expect(pusta).toBe(false);
      expect(duplikat).toBe(false);
      expect(actions.updateField).not.toHaveBeenCalled();
    });

    it("updateOption z tą samą nazwą inną wielkością liter i samym kolorem zapisuje", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const czytam = status.config.options!.find((o) => o.label === "Czytam")!;
      const { result } = renderHook(() => useTableStore(b));
      let wynik: boolean | undefined;
      await act(async () => {
        wynik = await result.current.updateOption(status, czytam.id, { label: "CZYTAM" });
      });
      expect(wynik).toBe(true);
      expect(actions.updateField).toHaveBeenCalledTimes(1);
    });
  });

  describe("moveField", () => {
    it("błąd serwera przy równoległej zmianie nazwy innego pola zostawia nową nazwę", async () => {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const ocena = b.fields.find((f) => f.name === "Ocena")!;
      const przesuniecie = odroczona<{ ok: boolean; message?: string }>();
      actions.reorderFields.mockReturnValueOnce(przesuniecie.obietnica);
      const { result } = renderHook(() => useTableStore(b));
      let p: Promise<boolean> | undefined;
      act(() => {
        p = result.current.moveField(autor, 1);
      });
      expect(result.current.fields.map((f) => f.name).slice(0, 3)).toEqual(["Tytuł", "Status", "Autor"]);
      await act(async () => {
        await result.current.patchField(ocena, { name: "Gwiazdki" });
      });
      let wynik: boolean | undefined;
      await act(async () => {
        przesuniecie.rozwiaz({ ok: false, message: "x" });
        wynik = await p;
      });
      expect(wynik).toBe(false);
      expect(result.current.fields.map((f) => f.name)).toEqual(["Tytuł", "Autor", "Status", "Gwiazdki", "Przeczytana"]);
      expect(toast.error).toHaveBeenCalledWith(BLAD_ZAPISU);
    });

    it("moveField(tytuł, 1) i moveField(pole po tytule, -1) dają false bez zapisu", async () => {
      const b = blok();
      const tytul = b.fields.find((f) => f.isTitle)!;
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const { result } = renderHook(() => useTableStore(b));
      let w1: boolean | undefined;
      let w2: boolean | undefined;
      await act(async () => {
        w1 = await result.current.moveField(tytul, 1);
        w2 = await result.current.moveField(autor, -1);
      });
      expect(w1).toBe(false);
      expect(w2).toBe(false);
      expect(actions.reorderFields).not.toHaveBeenCalled();
      expect(result.current.fields.map((f) => f.name).slice(0, 2)).toEqual(["Tytuł", "Autor"]);
    });
  });

  describe("ustawienia z serwera", () => {
    it("tablica w column_widths i column_summaries daje pusty obiekt", () => {
      const b = blok();
      const zTablicami = {
        ...b,
        content: { ...b.content, settings: { ...(b.content.settings as object), column_widths: [], column_summaries: [] } },
      };
      const { result } = renderHook(() => useTableStore(zTablicami));
      expect(result.current.settings.column_widths).toEqual({});
      expect(result.current.settings.column_summaries).toEqual({});
    });
  });
});
