import { act, renderHook, waitFor } from "@testing-library/react";
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
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/strony/p1",
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: router.refresh }),
}));
vi.mock("../actions", () => actions);

import type { LoadedBlock } from "../load-page";
import { BLAD_ZAPISU, ZAPIS_W_TOKU } from "../messages";
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

  describe("runda poprawek 1", () => {
    it("A→B i B→C w toku, oba padają: komórka wraca do A (potwierdzonej przez serwer)", async () => {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const doB = odroczona<{ ok: boolean; message?: string }>();
      const doC = odroczona<{ ok: boolean; message?: string }>();
      actions.updateRow.mockReturnValueOnce(doB.obietnica).mockReturnValueOnce(doC.obietnica);
      const { result } = renderHook(() => useTableStore(b));
      let pB: Promise<boolean> | undefined;
      let pC: Promise<boolean> | undefined;
      act(() => {
        pB = result.current.updateCell(result.current.rows[0], autor, "B");
      });
      act(() => {
        pC = result.current.updateCell(result.current.rows[0], autor, "C");
      });
      expect(result.current.rows[0].values[autor.id]).toBe("C");
      await act(async () => {
        doB.rozwiaz({ ok: false, message: "x" });
        await pB;
      });
      // B padło, ale komórka ma już C (zapis w toku) — zostaje
      expect(result.current.rows[0].values[autor.id]).toBe("C");
      await act(async () => {
        doC.rozwiaz({ ok: false, message: "x" });
        await pC;
      });
      expect(result.current.rows[0].values[autor.id]).toBe("James Clear");
    });

    it("A→B się zapisuje, B→C pada: komórka wraca do B", async () => {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      actions.updateRow.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, message: "x" });
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.updateCell(result.current.rows[0], autor, "B");
      });
      await act(async () => {
        await result.current.updateCell(result.current.rows[0], autor, "C");
      });
      expect(result.current.rows[0].values[autor.id]).toBe("B");
    });

    it("dwa szybkie createOption przed rerenderem: obie opcje w ostatnim zapisie", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const { result } = renderHook(() => useTableStore(b));
      const sklep = result.current;
      let id1: string | null | undefined;
      let id2: string | null | undefined;
      await act(async () => {
        const p1 = sklep.createOption(status, "Porzucone");
        const p2 = sklep.createOption(status, "Wstrzymane");
        [id1, id2] = await Promise.all([p1, p2]);
      });
      expect(id1).not.toBeNull();
      expect(id2).not.toBeNull();
      const ostatni = actions.updateField.mock.calls.at(-1)![1] as { config: { options: { label: string }[] } };
      expect(ostatni.config.options.map((o) => o.label)).toEqual([
        "Czytam",
        "Przeczytane",
        "Chcę przeczytać",
        "Porzucone",
        "Wstrzymane",
      ]);
      const opcje = result.current.fields.find((f) => f.id === status.id)!.config.options!;
      expect(opcje.map((o) => o.label)).toContain("Wstrzymane");
      expect(opcje).toHaveLength(5);
    });

    it("patchField X pada, Y (zbudowane na X) się zapisuje: UI ma stan z Y", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const zapisX = odroczona<{ ok: boolean; message?: string }>();
      const zapisY = odroczona<{ ok: boolean; message?: string }>();
      actions.updateField.mockReturnValueOnce(zapisX.obietnica).mockReturnValueOnce(zapisY.obietnica);
      const { result } = renderHook(() => useTableStore(b));
      const configX = { ...status.config, show_in_calendar: true };
      const configY = { ...configX, empty_label: "Y" };
      let pX: Promise<boolean> | undefined;
      let pY: Promise<boolean> | undefined;
      act(() => {
        pX = result.current.patchField(status, { config: configX });
      });
      act(() => {
        pY = result.current.patchField(status, { config: configY });
      });
      await act(async () => {
        zapisX.rozwiaz({ ok: false, message: "x" });
        await pX;
      });
      await act(async () => {
        zapisY.rozwiaz({ ok: true });
        await pY;
      });
      expect(result.current.fields.find((f) => f.id === status.id)!.config).toBe(configY);
      expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it("patchField X się zapisuje, Y pada: UI wraca do X, nie do stanu sprzed X", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      actions.updateField.mockResolvedValueOnce({ ok: true }).mockResolvedValueOnce({ ok: false, message: "x" });
      const { result } = renderHook(() => useTableStore(b));
      const configX = { ...status.config, show_in_calendar: true };
      await act(async () => {
        await result.current.patchField(status, { config: configX });
      });
      await act(async () => {
        await result.current.patchField(status, { config: { ...configX, empty_label: "Y" } });
      });
      expect(result.current.fields.find((f) => f.id === status.id)!.config).toEqual(configX);
    });
  });

  describe("saveRow z sekretami z arkusza", () => {
    it("wysyła szyfrogramy podane przez arkusz razem ze zmienionymi polami", async () => {
      const b = blok();
      const sv = { v: 1, g: 1, iv: btoa("iv-dwanascie"), ct: btoa("szyfrogram-A-szesnascie") };
      const sekret = { id: "f-sekret", name: "Hasło", type: "secret" as const, config: {}, position: 99, isTitle: false };
      const zSekretem = { ...b, fields: [...b.fields, sekret] };
      const { result } = renderHook(() => useTableStore(zSekretem));
      await act(async () => {
        await result.current.startEdit(result.current.rows[0]);
      });
      let wynik: boolean | undefined;
      await act(async () => {
        wynik = await result.current.saveRow({ "f-sekret": sv });
      });
      expect(wynik).toBe(true);
      expect(actions.updateRow).toHaveBeenCalledWith("row-1", { "f-sekret": sv });
      expect(result.current.rows[0].values["f-sekret"]).toEqual(sv);
    });
  });

  describe("zapis wiersza w toku (arkusz telefonu)", () => {
    it("drugi zapis w trakcie pierwszego: toast „Poczekaj, zapisuję poprzednią zmianę.” zamiast cichego false", async () => {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const serwer = odroczona<{ ok: true }>();
      actions.updateRow.mockReturnValue(serwer.obietnica);
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.startEdit(result.current.rows[0]);
      });
      act(() => result.current.setEditValue(autor.id, "Nowy autor"));
      let pierwszy!: Promise<boolean>;
      act(() => {
        pierwszy = result.current.saveRow();
      });
      let drugi: boolean | undefined;
      await act(async () => {
        drugi = await result.current.saveRow();
      });
      expect(drugi).toBe(false);
      expect(toast).toHaveBeenCalledWith(ZAPIS_W_TOKU);
      await act(async () => {
        serwer.rozwiaz({ ok: true });
        await pierwszy;
      });
      expect(actions.updateRow).toHaveBeenCalledTimes(1);
    });

    it("otwarcie innego wiersza w trakcie zapisu czeka na jego koniec i dostaje zapisaną wartość", async () => {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const serwer = odroczona<{ ok: true }>();
      actions.updateRow.mockReturnValue(serwer.obietnica);
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.startEdit(result.current.rows[0]);
      });
      act(() => result.current.setEditValue(autor.id, "Nowy autor"));
      let zapis!: Promise<boolean>;
      act(() => {
        zapis = result.current.saveRow();
      });
      // Klik w ten sam wiersz w trakcie zapisu: edycja jeszcze się nie otwiera
      let otwarcie!: Promise<void>;
      act(() => {
        otwarcie = result.current.startEdit(result.current.rows[0]);
      });
      expect(result.current.editing).toBeNull();
      await act(async () => {
        serwer.rozwiaz({ ok: true });
        await zapis;
        await otwarcie;
      });
      expect(result.current.editing?.rowId).toBe("row-1");
      expect(result.current.editing?.values[autor.id]).toBe("Nowy autor");
    });

    it("otwarcie wiersza po nieudanym zapisie nie nadpisuje przywróconego szkicu", async () => {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const serwer = odroczona<{ ok: false; message: string }>();
      actions.updateRow.mockReturnValue(serwer.obietnica);
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.startEdit(result.current.rows[0]);
      });
      act(() => result.current.setEditValue(autor.id, "Nowy autor"));
      let zapis!: Promise<boolean>;
      act(() => {
        zapis = result.current.saveRow();
      });
      let otwarcie!: Promise<void>;
      act(() => {
        otwarcie = result.current.startEdit(result.current.rows[1]);
      });
      await act(async () => {
        serwer.rozwiaz({ ok: false, message: "x" });
        await zapis;
        await otwarcie;
      });
      expect(toast.error).toHaveBeenCalledWith(BLAD_ZAPISU);
      expect(result.current.editing?.rowId).toBe("row-1");
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

    it("checkbox z default_checked daje nowemu wierszowi true (addRowInline i addRowDraft)", async () => {
      const b = stronaTestowa("subscriptions", "Subskrypcje", []).blocks[0];
      const aktywna = b.fields.find((f) => f.name === "Aktywna")!;
      const kategoria = b.fields.find((f) => f.name === "Kategoria")!;
      actions.addRow.mockImplementation(async (_b: string, values: Record<string, unknown>) => ({
        ok: true,
        row: { id: "srv-1", values, position: 0, deletedAt: null },
      }));
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.addRowInline();
      });
      expect(actions.addRow).toHaveBeenCalledWith(b.id, {
        [kategoria.id]: kategoria.config.default_option,
        [aktywna.id]: true,
      });
      await act(async () => {
        await result.current.addRowDraft();
      });
      expect(result.current.editing?.values[aktywna.id]).toBe(true);
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

  describe("addOption i removeOption na najnowszym configu", () => {
    it("createOption, a potem removeOption innej opcji ze starym obiektem pola zostawia nową opcję", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const czytam = status.config.options!.find((o) => o.label === "Czytam")!;
      const { result } = renderHook(() => useTableStore(b));
      // Stary obiekt pola i stara funkcja (jak w domknięciu sprzed rerenderu)
      const stary = result.current.fields.find((f) => f.id === status.id)!;
      const staryRemove = result.current.removeOption;
      let idNowej: string | null = null;
      await act(async () => {
        idNowej = await result.current.createOption(stary, "Porzucone");
        await staryRemove(stary, czytam.id);
      });
      expect(idNowej).not.toBeNull();
      const ostatni = actions.updateField.mock.calls.at(-1)!;
      const opcje = (ostatni[1] as { config: { options: { id: string }[] } }).config.options;
      expect(opcje.map((o) => o.id)).toContain(idNowej);
      expect(opcje.map((o) => o.id)).not.toContain(czytam.id);
      const wStanie = result.current.fields.find((f) => f.id === status.id)!.config.options!;
      expect(wStanie.map((o) => o.id)).toContain(idNowej);
      expect(wStanie.map((o) => o.id)).not.toContain(czytam.id);
    });

    it("dwa szybkie addOption przed rerenderem: obie opcje są w ostatnim zapisie", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const { result } = renderHook(() => useTableStore(b));
      const stary = result.current.fields.find((f) => f.id === status.id)!;
      const staryAdd = result.current.addOption;
      await act(async () => {
        await Promise.all([staryAdd(stary, "Pierwsza"), staryAdd(stary, "Druga")]);
      });
      expect(actions.updateField).toHaveBeenCalledTimes(2);
      const ostatni = actions.updateField.mock.calls.at(-1)!;
      const etykiety = (ostatni[1] as { config: { options: { label: string }[] } }).config.options.map((o) => o.label);
      expect(etykiety).toEqual(expect.arrayContaining(["Pierwsza", "Druga"]));
      expect(etykiety).toHaveLength(status.config.options!.length + 2);
    });

    it("removeOption czyści wiersze z najnowszego stanu, także ze starego domknięcia", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const czytam = status.config.options!.find((o) => o.label === "Czytam")!;
      const { result } = renderHook(() => useTableStore(b));
      const stary = result.current.fields.find((f) => f.id === status.id)!;
      const staryRemove = result.current.removeOption;
      // Wiersz dodany po renderze, z którego pochodzi staryRemove, też ma zostać wyczyszczony
      await act(async () => {
        await result.current.updateCell(result.current.rows[1], status, czytam.id);
      });
      await act(async () => {
        await staryRemove(stary, czytam.id);
      });
      expect(result.current.rows.every((r) => r.values[status.id] !== czytam.id)).toBe(true);
      expect(actions.updateRow).toHaveBeenCalledWith(result.current.rows[1].id, { [status.id]: null });
    });

    it("removeOption wysyła najpierw pole, potem wiersze", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const czytam = status.config.options!.find((o) => o.label === "Czytam")!;
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.removeOption(result.current.fields.find((f) => f.id === status.id)!, czytam.id);
      });
      expect(actions.updateField).toHaveBeenCalledTimes(1);
      expect(actions.updateRow).toHaveBeenCalledWith("row-1", { [status.id]: null });
      // Kolejność wywołań (= kolejność na serwerze): pole przed każdym wierszem
      const pole = actions.updateField.mock.invocationCallOrder[0];
      for (const wiersz of actions.updateRow.mock.invocationCallOrder) expect(pole).toBeLessThan(wiersz);
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

    it("column_widths z martwym kluczem po wczytaniu zostaje tylko dla pól bloku", () => {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const zMartwym = {
        ...b,
        content: {
          ...b.content,
          settings: { ...(b.content.settings as object), column_widths: { [autor.id]: 240, "nie-ma-takiego-pola": 180 } },
        },
      };
      const { result } = renderHook(() => useTableStore(zMartwym));
      expect(result.current.settings.column_widths).toEqual({ [autor.id]: 240 });
    });
  });

  describe("removeField i column_widths", () => {
    function blokZeSzerokoscia() {
      const b = blok();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      return {
        autor,
        b: {
          ...b,
          content: { ...b.content, settings: { ...(b.content.settings as object), column_widths: { [autor.id]: 240 } } },
        },
      };
    }

    it("po usunięciu pola nie ma jego klucza w column_widths", async () => {
      const { autor, b } = blokZeSzerokoscia();
      const { result } = renderHook(() => useTableStore(b));
      expect(result.current.settings.column_widths).toEqual({ [autor.id]: 240 });
      await act(async () => {
        await result.current.removeField(autor);
      });
      expect(result.current.settings.column_widths).toEqual({});
    });

    it("po błędzie serwera klucz szerokości wraca", async () => {
      const { autor, b } = blokZeSzerokoscia();
      actions.deleteField.mockResolvedValue({ ok: false, message: "x" });
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.removeField(autor);
      });
      expect(result.current.settings.column_widths).toEqual({ [autor.id]: 240 });
      expect(toast.error).toHaveBeenCalledWith(BLAD_ZAPISU);
    });
  });

  describe("renameTable", () => {
    it("„  Lektury  ” zapisuje „Lektury”", async () => {
      const b = blok();
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.renameTable("  Lektury  ");
      });
      expect(actions.updateBlockContent).toHaveBeenCalledWith(b.id, expect.objectContaining({ name: "Lektury" }));
      expect(result.current.tableName).toBe("Lektury");
    });

    it("same spacje przy pustej nazwie nie wysyłają zapisu", async () => {
      // Tabela bez nazwy: same spacje po przycięciu to ta sama (pusta) nazwa
      const b0 = blok();
      const b = { ...b0, content: { ...b0.content, name: "" } };
      const { result } = renderHook(() => useTableStore(b));
      let wynik: boolean | undefined;
      await act(async () => {
        wynik = await result.current.renameTable("   ");
      });
      expect(wynik).toBe(true);
      expect(actions.updateBlockContent).not.toHaveBeenCalled();
    });
  });

  describe("normalizacja nazw opcji", () => {
    it("createOption(„W  toku”) przy istniejącym „W toku” nie tworzy duplikatu", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const zOpcja = {
        ...b,
        fields: b.fields.map((f) =>
          f.id === status.id
            ? { ...f, config: { ...f.config, options: [...f.config.options!, { id: "o-wtoku", label: "W toku", color: "#525252" }] } }
            : f,
        ),
      };
      const { result } = renderHook(() => useTableStore(zOpcja));
      const pole = result.current.fields.find((f) => f.id === status.id)!;
      let id: string | null | undefined;
      await act(async () => {
        id = await result.current.createOption(pole, "W  toku");
      });
      expect(id).toBeNull();
      expect(actions.updateField).not.toHaveBeenCalled();
    });

    it("createOption i updateOption zapisują nazwę ze zwiniętymi spacjami", async () => {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.createOption(status, "  Na   później ");
      });
      const zapisana = actions.updateField.mock.calls[0][1].config.options.find(
        (o: { label: string }) => o.label === "Na później",
      );
      expect(zapisana).toBeDefined();
      const pole = result.current.fields.find((f) => f.id === status.id)!;
      const pierwsza = pole.config.options![0];
      await act(async () => {
        await result.current.updateOption(pole, pierwsza.id, { label: " Nowa   nazwa " });
      });
      const ostatni = actions.updateField.mock.calls.at(-1)![1].config.options;
      expect(ostatni.find((o: { id: string }) => o.id === pierwsza.id).label).toBe("Nowa nazwa");
    });
  });

  describe("widoki szablonu", () => {
    it("blok szablonu bez klucza views: jednorazowy zapis widoków i grupowania", async () => {
      const b = blok();
      renderHook(() => useTableStore(b, undefined, "books"));
      await waitFor(() => expect(actions.saveTableSettings).toHaveBeenCalledTimes(1));
      const [blockId, patch] = actions.saveTableSettings.mock.calls[0];
      expect(blockId).toBe(b.id);
      expect(patch.views.map((w: { name: string }) => w.name)).toEqual([
        "Czytam",
        "Do przeczytania",
        `Przeczytane w ${new Date().getFullYear()}`,
      ]);
      const status = b.fields.find((f) => f.name === "Status")!;
      expect(patch.group_by).toBe(status.id);
    });

    it("widoki trafiają od razu do lokalnych ustawień", async () => {
      const b = blok();
      const { result } = renderHook(() => useTableStore(b, undefined, "books"));
      await waitFor(() => expect(result.current.settings.views).toHaveLength(3));
    });

    it("pusta lista views (użytkownik usunął widoki): bez zapisu", async () => {
      const b = blok();
      b.content = { ...b.content, settings: { ...(b.content.settings as object), views: [] } };
      const { result } = renderHook(() => useTableStore(b, undefined, "books"));
      await act(async () => {});
      expect(actions.saveTableSettings).not.toHaveBeenCalled();
      expect(result.current.settings.views).toEqual([]);
    });

    it("bez szablonu, na pustej stronie i bez opcji templateKey: bez zapisu", async () => {
      const b = blok();
      const { rerender } = renderHook(({ k }: { k: "empty" | null }) => useTableStore(b, undefined, k), {
        initialProps: { k: null as "empty" | null },
      });
      rerender({ k: "empty" });
      await act(async () => {});
      expect(actions.saveTableSettings).not.toHaveBeenCalled();
    });

    it("zapis z onlyIfMissing; serwer pomija (widoki już są): bez widoków lokalnie", async () => {
      actions.saveTableSettings.mockResolvedValue({ ok: true, skipped: true });
      const b = blok();
      const { result } = renderHook(() => useTableStore(b, undefined, "books"));
      await waitFor(() => expect(actions.saveTableSettings).toHaveBeenCalledTimes(1));
      expect(actions.saveTableSettings.mock.calls[0][2]).toEqual({ onlyIfMissing: "views" });
      await act(async () => {});
      expect(result.current.settings.views).toEqual([]);
    });

    it("użytkownik zmienił widoki w trakcie zapisu: domyślne ich nie nadpisują", async () => {
      const d = odroczona<{ ok: true }>();
      actions.saveTableSettings.mockReturnValueOnce(d.obietnica);
      const b = blok();
      const { result } = renderHook(() => useTableStore(b, undefined, "books"));
      await waitFor(() => expect(actions.saveTableSettings).toHaveBeenCalledTimes(1));
      await act(async () => {
        await result.current.patchSettings({ views: [] });
      });
      await act(async () => {
        d.rozwiaz({ ok: true });
      });
      expect(result.current.settings.views).toEqual([]);
    });

    it("zapis zwraca ok: false: bez widoków lokalnie, bez wyjątku i bez toasta", async () => {
      actions.saveTableSettings.mockResolvedValue({ ok: false, message: "x" });
      const b = blok();
      const { result } = renderHook(() => useTableStore(b, undefined, "books"));
      await waitFor(() => expect(actions.saveTableSettings).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(result.current.settings.views).toEqual([]);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("zapis odrzucony wyjątkiem: bez widoków lokalnie, bez wyjątku i bez toasta", async () => {
      actions.saveTableSettings.mockRejectedValue(new Error("sieć"));
      const b = blok();
      const { result } = renderHook(() => useTableStore(b, undefined, "books"));
      await waitFor(() => expect(actions.saveTableSettings).toHaveBeenCalledTimes(1));
      await act(async () => {});
      expect(result.current.settings.views).toEqual([]);
      expect(toast.error).not.toHaveBeenCalled();
    });

    it("ponowny render nie zapisuje drugi raz", async () => {
      const b = blok();
      const { rerender } = renderHook(() => useTableStore(b, undefined, "books"));
      await waitFor(() => expect(actions.saveTableSettings).toHaveBeenCalledTimes(1));
      rerender();
      await act(async () => {});
      expect(actions.saveTableSettings).toHaveBeenCalledTimes(1);
    });
  });

  describe("widoki w zakładkach", () => {
    // Blok „books” z dwoma zapisanymi widokami; drugi aktywny, gdy aktywny = "w2"
    function blokZWidokami(aktywny: string | null = null): LoadedBlock {
      const b = blok();
      const status = b.fields.find((f) => f.name === "Status")!;
      const czytam = status.config.options!.find((o) => o.label === "Czytam")!;
      b.content = {
        ...b.content,
        settings: {
          ...(b.content.settings as object),
          views: [
            {
              id: "w1",
              name: "Czytam",
              filters: [{ field_id: status.id, op: "in", value: [czytam.id] }],
              sort: [],
              group_by: null,
              layout: "table",
              hidden_field_ids: [],
            },
            { id: "w2", name: "Pusty", filters: [], sort: [], group_by: null, layout: "table", hidden_field_ids: [] },
          ],
          active_view_id: aktywny,
        },
      };
      return b;
    }

    it("selectView zapisuje active_view_id i czyści filtr tymczasowy", async () => {
      const { result } = (() => { const bb = blokZWidokami(); return renderHook(() => useTableStore(bb)); })();
      act(() => result.current.setTempFilters([]));
      await act(async () => {
        await result.current.selectView("w1");
      });
      expect(actions.saveTableSettings).toHaveBeenCalledWith("blok-1", { active_view_id: "w1" });
      expect(result.current.settings.active_view_id).toBe("w1");
      expect(result.current.tempFilters).toBeNull();
      expect(result.current.view.filters).toHaveLength(1);
    });

    it("addView kopiuje bieżący widok (filtry, sort, ukryte pola) i go aktywuje", async () => {
      const b = blokZWidokami("w1");
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.patchView({ hidden_field_ids: [autor.id] });
      });
      await act(async () => {
        await result.current.addView("Mój widok 1");
      });
      const patch = actions.saveTableSettings.mock.calls.at(-1)![1];
      expect(patch.views).toHaveLength(3);
      const nowy = patch.views[2];
      expect(nowy.name).toBe("Mój widok 1");
      expect(nowy.filters).toEqual(result.current.settings.views[0].filters);
      expect(nowy.hidden_field_ids).toEqual([autor.id]);
      expect(patch.active_view_id).toBe(nowy.id);
      expect(result.current.settings.active_view_id).toBe(nowy.id);
    });

    it("renameView przycina nazwę; pusta nazwa nic nie zapisuje", async () => {
      const { result } = (() => { const bb = blokZWidokami(); return renderHook(() => useTableStore(bb)); })();
      await act(async () => {
        await result.current.renameView("w2", "  Moje  ");
      });
      expect(result.current.settings.views[1].name).toBe("Moje");
      await act(async () => {
        await result.current.renameView("w2", "   ");
      });
      expect(actions.saveTableSettings).toHaveBeenCalledTimes(1);
    });

    it("duplicateView dopisuje kopię na końcu listy i ją aktywuje", async () => {
      const { result } = (() => { const bb = blokZWidokami(); return renderHook(() => useTableStore(bb)); })();
      await act(async () => {
        await result.current.duplicateView("w1");
      });
      const widoki = result.current.settings.views;
      expect(widoki.map((w) => w.name)).toEqual(["Czytam", "Pusty", "Czytam (kopia)"]);
      expect(widoki[2].id).not.toBe("w1");
      expect(widoki[2].filters).toEqual(widoki[0].filters);
      expect(result.current.settings.active_view_id).toBe(widoki[2].id);
    });

    it("deleteView usuwa aktywny widok (wraca „Wszystkie”), toast „Cofnij” przywraca", async () => {
      const { result } = (() => { const bb = blokZWidokami("w1"); return renderHook(() => useTableStore(bb)); })();
      await act(async () => {
        await result.current.deleteView("w1");
      });
      expect(result.current.settings.views.map((w) => w.id)).toEqual(["w2"]);
      expect(result.current.settings.active_view_id).toBeNull();
      expect(toast).toHaveBeenCalledWith("Usunięto widok „Czytam”", expect.objectContaining({ action: expect.anything() }));
      const cofnij = toast.mock.calls[0][1].action.onClick as () => Promise<void>;
      await act(async () => {
        await cofnij();
      });
      expect(result.current.settings.views.map((w) => w.id)).toEqual(["w1", "w2"]);
      expect(result.current.settings.active_view_id).toBe("w1");
    });

    it("patchView przy aktywnym widoku zapisuje do widoku, przy „Wszystkich” do ustawień bazowych", async () => {
      const b = blokZWidokami("w2");
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.patchView({ hidden_field_ids: [autor.id], sort: [{ field_id: autor.id, dir: "desc" }] });
      });
      expect(result.current.settings.views[1].hidden_field_ids).toEqual([autor.id]);
      expect(result.current.settings.views[1].sort).toEqual([{ field_id: autor.id, dir: "desc" }]);
      expect(result.current.settings.hidden_field_ids).toEqual([]);
      expect(result.current.view.hidden_field_ids).toEqual([autor.id]);

      await act(async () => {
        await result.current.selectView(null);
      });
      await act(async () => {
        await result.current.patchView({ hidden_field_ids: [autor.id] });
      });
      expect(result.current.settings.hidden_field_ids).toEqual([autor.id]);
      expect(actions.saveTableSettings).toHaveBeenLastCalledWith("blok-1", { hidden_field_ids: [autor.id] });
    });

    it("setGroupBy i setLayout trafiają do aktywnego widoku", async () => {
      const b = blokZWidokami("w2");
      const status = b.fields.find((f) => f.name === "Status")!;
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.setGroupBy(status.id);
      });
      await act(async () => {
        await result.current.setLayout("board");
      });
      expect(result.current.settings.views[1].group_by).toBe(status.id);
      expect(result.current.settings.views[1].layout).toBe("board");
      expect(result.current.settings.group_by).toBeNull();
      expect(result.current.view.layout).toBe("board");
    });

    it("setQuery zmienia frazę lokalnie, bez zapisu", () => {
      const { result } = (() => { const bb = blokZWidokami(); return renderHook(() => useTableStore(bb)); })();
      act(() => result.current.setQuery("clear"));
      expect(result.current.query).toBe("clear");
      expect(actions.saveTableSettings).not.toHaveBeenCalled();
    });

    it("toggleGroup zwija i rozwija grupę w kluczu aktywnego widoku („all” dla Wszystkich)", async () => {
      const { result } = (() => { const bb = blokZWidokami(); return renderHook(() => useTableStore(bb)); })();
      await act(async () => {
        await result.current.toggleGroup("opt-1");
      });
      expect(result.current.settings.collapsed_groups).toEqual({ all: ["opt-1"] });
      await act(async () => {
        await result.current.selectView("w1");
      });
      await act(async () => {
        await result.current.toggleGroup("opt-2");
      });
      expect(result.current.settings.collapsed_groups).toEqual({ all: ["opt-1"], w1: ["opt-2"] });
      await act(async () => {
        await result.current.toggleGroup("opt-2");
      });
      expect(result.current.settings.collapsed_groups).toEqual({ all: ["opt-1"], w1: [] });
    });

    it("„Cofnij” po usunięciu wstawia widok na jego miejsce w BIEŻĄCEJ liście (późniejsze zmiany zostają)", async () => {
      const { result } = (() => { const bb = blokZWidokami("w1"); return renderHook(() => useTableStore(bb)); })();
      await act(async () => {
        await result.current.deleteView("w1");
      });
      await act(async () => {
        await result.current.renameView("w2", "Inny");
      });
      await act(async () => {
        await result.current.addView("Mój widok 1");
      });
      const cofnij = toast.mock.calls[0][1].action.onClick as () => Promise<void>;
      await act(async () => {
        await cofnij();
      });
      expect(result.current.settings.views.map((w) => w.name)).toEqual(["Czytam", "Inny", "Mój widok 1"]);
      expect(result.current.settings.active_view_id).toBe("w1");
    });

    it("błąd zapisu przy innym zapisie w toku: bez cofania do starej kopii, po ostatnim zapisie router.refresh()", async () => {
      const b = blokZWidokami();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const ocena = b.fields.find((f) => f.name === "Ocena")!;
      const pierwszy = odroczona<{ ok: boolean; message?: string }>();
      const drugi = odroczona<{ ok: boolean }>();
      actions.saveTableSettings.mockReturnValueOnce(pierwszy.obietnica).mockReturnValueOnce(drugi.obietnica);
      const { result } = renderHook(() => useTableStore(b));
      let a!: Promise<boolean>;
      let c!: Promise<boolean>;
      act(() => {
        a = result.current.patchView({ hidden_field_ids: [autor.id] });
      });
      act(() => {
        c = result.current.patchView({ hidden_field_ids: [autor.id, ocena.id] });
      });
      await act(async () => {
        pierwszy.rozwiaz({ ok: false, message: "x" });
        await a;
      });
      // Drugi zapis w toku: lokalny stan drugiej zmiany zostaje (bez cofania do [])
      expect(result.current.settings.hidden_field_ids).toEqual([autor.id, ocena.id]);
      expect(router.refresh).not.toHaveBeenCalled();
      expect(toast.error).toHaveBeenCalledWith(BLAD_ZAPISU);
      await act(async () => {
        drugi.rozwiaz({ ok: true });
        await c;
      });
      expect(router.refresh).toHaveBeenCalledTimes(1);
    });

    it("błąd zapisu bez innych zapisów w toku cofa zmianę bez odświeżania", async () => {
      actions.saveTableSettings.mockResolvedValue({ ok: false, message: "x" });
      const b = blokZWidokami();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.patchView({ hidden_field_ids: [autor.id] });
      });
      expect(result.current.settings.hidden_field_ids).toEqual([]);
      expect(router.refresh).not.toHaveBeenCalled();
    });

    it("„+ Widok” przed końcem zapisu widoków szablonu: zapis użytkownika czeka i zawiera widoki szablonu", async () => {
      const d = odroczona<{ ok: true }>();
      actions.saveTableSettings.mockReturnValueOnce(d.obietnica);
      const b = blok();
      const { result } = renderHook(() => useTableStore(b, undefined, "books"));
      await waitFor(() => expect(actions.saveTableSettings).toHaveBeenCalledTimes(1));
      let dodanie!: Promise<boolean>;
      act(() => {
        dodanie = result.current.addView("Mój widok 1");
      });
      // Zapis użytkownika jeszcze nie poszedł
      expect(actions.saveTableSettings).toHaveBeenCalledTimes(1);
      await act(async () => {
        d.rozwiaz({ ok: true });
        await dodanie;
      });
      expect(actions.saveTableSettings).toHaveBeenCalledTimes(2);
      const patch = actions.saveTableSettings.mock.calls[1][1];
      expect(patch.views.map((w: { name: string }) => w.name)).toEqual([
        "Czytam",
        "Do przeczytania",
        `Przeczytane w ${new Date().getFullYear()}`,
        "Mój widok 1",
      ]);
      expect(result.current.settings.views).toHaveLength(4);
    });

    it("saveFiltersAsView przy „Wszystkich”: filtry przechodzą do nowego widoku, a „Wszystkie” je tracą", async () => {
      const b = blokZWidokami();
      const autor = b.fields.find((f) => f.name === "Autor")!;
      const warunek = { field_id: autor.id, op: "contains" as const, value: "Clear" };
      const { result } = renderHook(() => useTableStore(b));
      await act(async () => {
        await result.current.patchView({ filters: [warunek] });
      });
      await act(async () => {
        await result.current.saveFiltersAsView("Mój widok 1");
      });
      const patch = actions.saveTableSettings.mock.calls.at(-1)![1];
      expect(patch.filters).toEqual([]);
      expect(patch.views.at(-1).filters).toEqual([warunek]);
      expect(result.current.settings.filters).toEqual([]);
      expect(result.current.view.filters).toEqual([warunek]);
    });

    it("saveFiltersAsView przy zapisanym widoku: widok źródłowy zostaje bez zmian", async () => {
      const b = blokZWidokami("w1");
      const { result } = renderHook(() => useTableStore(b));
      const zrodlo = result.current.settings.views[0];
      await act(async () => {
        await result.current.saveFiltersAsView("Mój widok 1");
      });
      const patch = actions.saveTableSettings.mock.calls.at(-1)![1];
      expect("filters" in patch).toBe(false);
      expect(patch.views[0]).toEqual(zrodlo);
      expect(patch.views.at(-1).filters).toEqual(zrodlo.filters);
      expect(result.current.settings.active_view_id).toBe(patch.views.at(-1).id);
    });
  });
});

