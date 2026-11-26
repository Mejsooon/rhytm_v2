import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ importCsvRows: vi.fn() }));
vi.mock("../actions", () => actions);

import type { PageField } from "../fields";
import type { PageRow } from "../table-model";
import { CsvImportDialog } from "./csv-import-dialog";

const pole = (id: string, name: string, type: PageField["type"], config: PageField["config"] = {}): PageField => ({
  id,
  name,
  type,
  config,
  position: 0,
  isTitle: false,
});
const POLA = [
  pole("f-tytul", "Tytuł", "text"),
  pole("f-autor", "Autor", "text"),
  pole("f-status", "Status", "status", { options: [{ id: "o1", label: "Czytam", color: "#0070f3" }] }),
];
const ISTNIEJACE: PageRow[] = [
  { id: "r1", values: { "f-tytul": "Diuna", "f-autor": "Frank Herbert" }, position: 0, deletedAt: null },
];

// File z własnym text() (jsdom nie zawsze je ma)
function plik(tresc: string, nazwa = "ksiazki.csv", rozmiar?: number) {
  const f = new File([tresc], nazwa, { type: "text/csv" });
  Object.defineProperty(f, "text", { value: () => Promise.resolve(tresc) });
  if (rozmiar !== undefined) Object.defineProperty(f, "size", { value: rozmiar });
  return f;
}

function otworz(over: Partial<React.ComponentProps<typeof CsvImportDialog>> = {}) {
  const onOpenChange = vi.fn();
  const onImported = vi.fn();
  render(
    <CsvImportDialog
      open
      onOpenChange={onOpenChange}
      blockId="b1"
      tableName="Książki"
      fields={POLA}
      rows={ISTNIEJACE}
      onImported={onImported}
      {...over}
    />,
  );
  return { onOpenChange, onImported };
}

async function wybierz(user: ReturnType<typeof userEvent.setup>, f: File) {
  await user.upload(screen.getByLabelText("Plik CSV"), f);
}

beforeEach(() => {
  actions.importCsvRows.mockReset();
});

describe("CsvImportDialog", () => {
  it("krok 1: tytuł, opis i strefa pliku jak w makiecie", () => {
    otworz();
    const okno = screen.getByRole("dialog", { name: "Importuj z CSV" });
    expect(within(okno).getByText("Dodaj wiersze do tabeli Książki z pliku CSV.")).toBeInTheDocument();
    expect(within(okno).getByText("Przeciągnij plik CSV albo kliknij, żeby wybrać")).toBeInTheDocument();
    expect(within(okno).getByRole("button", { name: "Dalej" })).toHaveAttribute("aria-disabled", "true");
  });

  it("wybór pliku → krok 2 z mapowaniem po nazwie i nowym polem dla nieznanej kolumny", async () => {
    const user = userEvent.setup();
    otworz();
    await wybierz(user, plik("Tytuł,Autor,ISBN\nDeep Work,Cal Newport,123\nSapiens,Yuval Harari,456\n"));
    const okno = await screen.findByRole("dialog", { name: "Importuj z CSV" });
    expect(within(okno).getByText("Sprawdź, które kolumny trafią do których pól.")).toBeInTheDocument();
    expect(within(okno).getByText("ksiazki.csv")).toBeInTheDocument();
    expect(within(okno).getByText("2 wiersze · 3 kolumny")).toBeInTheDocument();
    expect(within(okno).getByLabelText("Pole dla kolumny Tytuł")).toHaveValue("field:f-tytul");
    expect(within(okno).getByLabelText("Pole dla kolumny Autor")).toHaveValue("field:f-autor");
    expect(within(okno).getByLabelText("Pole dla kolumny ISBN")).toHaveValue("new:text");
    expect(within(okno).getByRole("button", { name: "Importuj 2 wiersze" })).toBeInTheDocument();
  });

  it("Importuj: woła importCsvRows z nowym polem i wierszami, zamyka okno i zgłasza liczbę", async () => {
    const user = userEvent.setup();
    actions.importCsvRows.mockResolvedValue({ ok: true, fieldIds: ["f-nowe"], count: 2 });
    const { onOpenChange, onImported } = otworz();
    await wybierz(user, plik("Tytuł,ISBN\nDeep Work,123\nSapiens,456\n"));
    await user.selectOptions(await screen.findByLabelText("Pole dla kolumny ISBN"), "new:number");
    await user.click(screen.getByRole("button", { name: "Importuj 2 wiersze" }));
    await waitFor(() => expect(actions.importCsvRows).toHaveBeenCalledTimes(1));
    const [blockId, nowe, wiersze] = actions.importCsvRows.mock.calls[0];
    expect(blockId).toBe("b1");
    expect(nowe).toEqual([{ name: "ISBN", type: "number" }]);
    expect(wiersze).toEqual([
      { "f-tytul": "Deep Work", "new:0": 123 },
      { "f-tytul": "Sapiens", "new:0": 456 },
    ]);
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(2, 0));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("„Nie importuj” pomija kolumnę; „Pomiń wiersze, które już są w tabeli” pomija duplikaty po tytule", async () => {
    const user = userEvent.setup();
    actions.importCsvRows.mockResolvedValue({ ok: true, fieldIds: [], count: 1 });
    const { onImported } = otworz();
    await wybierz(user, plik("Tytuł,Autor,ISBN\nDiuna,F. Herbert,1\nDeep Work,Cal Newport,2\n"));
    await user.selectOptions(await screen.findByLabelText("Pole dla kolumny ISBN"), "skip");
    expect(screen.getByRole("button", { name: "Importuj 1 wiersz" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Importuj 1 wiersz" }));
    await waitFor(() => expect(actions.importCsvRows).toHaveBeenCalled());
    const [, nowe, wiersze] = actions.importCsvRows.mock.calls[0];
    expect(nowe).toEqual([]);
    expect(wiersze).toEqual([{ "f-tytul": "Deep Work", "f-autor": "Cal Newport" }]);
    await waitFor(() => expect(onImported).toHaveBeenCalledWith(1, 1));
  });

  it("wyłączone pomijanie duplikatów importuje wszystkie wiersze", async () => {
    const user = userEvent.setup();
    actions.importCsvRows.mockResolvedValue({ ok: true, fieldIds: [], count: 2 });
    otworz();
    await wybierz(user, plik("Tytuł\nDiuna\nDeep Work\n"));
    await user.click(await screen.findByRole("switch", { name: "Pomiń duplikaty" }));
    await user.click(screen.getByRole("button", { name: "Importuj 2 wiersze" }));
    await waitFor(() => expect(actions.importCsvRows.mock.calls[0][2]).toHaveLength(2));
  });

  it("nieznana etykieta statusu trafia do newOptions", async () => {
    const user = userEvent.setup();
    actions.importCsvRows.mockResolvedValue({ ok: true, fieldIds: [], count: 1 });
    otworz();
    await wybierz(user, plik("Tytuł,Status\nDeep Work,Przeczytana\n"));
    await user.click(await screen.findByRole("button", { name: "Importuj 1 wiersz" }));
    await waitFor(() => expect(actions.importCsvRows).toHaveBeenCalled());
    const [, , wiersze, opcje] = actions.importCsvRows.mock.calls[0];
    expect(Object.keys(opcje)).toEqual(["f-status"]);
    expect(wiersze[0]["f-status"]).toBe(opcje["f-status"][0].id);
  });

  it("plik większy niż 1 MB: komunikat w oknie i zostaje krok 1", async () => {
    const user = userEvent.setup();
    otworz();
    await wybierz(user, plik("Tytuł\nA\n", "duzy.csv", 1_048_577));
    expect(await screen.findByText("Plik jest większy niż 1 MB.")).toBeInTheDocument();
    expect(screen.getByText("Przeciągnij plik CSV albo kliknij, żeby wybrać")).toBeInTheDocument();
  });

  it("plik bez wierszy z danymi: komunikat w oknie", async () => {
    const user = userEvent.setup();
    otworz();
    await wybierz(user, plik("Tytuł,Autor\n"));
    expect(await screen.findByText("Plik nie ma wierszy z danymi.")).toBeInTheDocument();
  });

  it("błąd serwera: komunikat w oknie, okno zostaje otwarte", async () => {
    const user = userEvent.setup();
    actions.importCsvRows.mockResolvedValue({ ok: false, message: "Nie udało się zapisać." });
    const { onOpenChange, onImported } = otworz();
    await wybierz(user, plik("Tytuł\nDeep Work\n"));
    await user.click(await screen.findByRole("button", { name: "Importuj 1 wiersz" }));
    expect(await screen.findByText("Nie udało się zapisać.")).toBeInTheDocument();
    expect(onImported).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("„Zmień plik” wraca do kroku 1", async () => {
    const user = userEvent.setup();
    otworz();
    await wybierz(user, plik("Tytuł\nA\n"));
    await user.click(await screen.findByRole("button", { name: "Zmień plik" }));
    expect(screen.getByText("Przeciągnij plik CSV albo kliknij, żeby wybrać")).toBeInTheDocument();
  });
});
