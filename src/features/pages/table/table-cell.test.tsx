import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PageField } from "../fields";
import type { PageRow } from "../table-model";
import { TableCell } from "./table-cell";

const TODAY = "2026-11-15";

function pole(
  type: PageField["type"],
  extra: Partial<PageField> = {},
): PageField {
  return {
    id: "f1",
    name: "Pole",
    type,
    config: {},
    position: 0,
    isTitle: false,
    ...extra,
  };
}

function wiersz(v: unknown): PageRow {
  return { id: "row-1", values: { f1: v }, position: 0, deletedAt: null };
}

// Komórka to <td>, więc renderujemy ją w tabeli
function komorka(
  field: PageField,
  row: PageRow,
  onSave = vi.fn(),
  autoFocus = false,
) {
  const wynik = render(
    <table>
      <tbody>
        <tr>
          <TableCell
            row={row}
            field={field}
            today={TODAY}
            done={null}
            autoFocus={autoFocus}
            onSave={onSave}
          />
        </tr>
      </tbody>
    </table>,
  );
  return { ...wynik, onSave };
}

describe("TableCell", () => {
  describe("tekst", () => {
    it("wpisanie „Diuna” i od razu wyjście daje jedno onSave(„Diuna”)", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(
        pole("text", { name: "Tytuł", isTitle: true }),
        wiersz(null),
      );
      const pole_ = screen.getByRole("textbox", { name: "Tytuł" });
      await user.type(pole_, "Diuna");
      await user.tab();
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith("Diuna");
    });

    it("odmontowanie przed 600 ms też zapisuje szkic (Review Focus 1)", async () => {
      const user = userEvent.setup();
      const { onSave, unmount } = komorka(pole("text"), wiersz("Dun"));
      await user.type(screen.getByRole("textbox", { name: "Pole" }), "a");
      expect(onSave).not.toHaveBeenCalled();
      unmount();
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith("Duna");
    });

    it("po 600 ms przerwy zapisuje bez wychodzenia z komórki", () => {
      vi.useFakeTimers();
      try {
        const { onSave } = komorka(pole("text"), wiersz(""));
        const pole_ = screen.getByRole("textbox", { name: "Pole" });
        act(() => pole_.focus());
        fireEvent.change(pole_, { target: { value: "Diu" } });
        act(() => vi.advanceTimersByTime(599));
        expect(onSave).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(onSave).toHaveBeenCalledWith("Diu");
        expect(pole_).toHaveFocus();
      } finally {
        vi.useRealTimers();
      }
    });

    it("Enter kończy edycję i zapisuje", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(pole("text"), wiersz("Cal"));
      const pole_ = screen.getByRole("textbox", { name: "Pole" });
      await user.type(pole_, " Newport{Enter}");
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith("Cal Newport");
      expect(pole_).not.toHaveFocus();
    });

    it("Esc też kończy edycję i zapisuje", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(pole("text"), wiersz("A"));
      const pole_ = screen.getByRole("textbox", { name: "Pole" });
      await user.type(pole_, "b{Escape}");
      expect(onSave).toHaveBeenCalledWith("Ab");
      expect(pole_).not.toHaveFocus();
    });

    it("komórka w fokusie trzyma szkic, gdy z serwera wróci inna wartość", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const f = pole("text");
      const { rerender } = komorka(f, wiersz("A"), onSave);
      const pole_ = screen.getByRole("textbox", { name: "Pole" });
      await user.type(pole_, "bc");
      const nowa = (v: unknown) => (
        <table>
          <tbody>
            <tr>
              <TableCell
                row={wiersz(v)}
                field={f}
                today={TODAY}
                done={null}
                onSave={onSave}
              />
            </tr>
          </tbody>
        </table>
      );
      rerender(nowa("Ab"));
      expect(pole_).toHaveValue("Abc");
      await user.tab();
      expect(onSave).toHaveBeenLastCalledWith("Abc");
      // Po wyjściu komórka pokazuje wartość z magazynu
      rerender(nowa("Abc"));
      expect(pole_).toHaveValue("Abc");
    });

    it("wyjście bez zmian nic nie zapisuje", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(pole("text"), wiersz("A"));
      await user.click(screen.getByRole("textbox", { name: "Pole" }));
      await user.tab();
      expect(onSave).not.toHaveBeenCalled();
    });

    it("autoFocus stawia kursor w komórce", () => {
      komorka(
        pole("text", { name: "Tytuł", isTitle: true }),
        wiersz(null),
        vi.fn(),
        true,
      );
      expect(screen.getByRole("textbox", { name: "Tytuł" })).toHaveFocus();
    });

    it("pusty tytuł ma podpowiedź z empty_label", () => {
      komorka(
        pole("text", {
          name: "Tytuł",
          isTitle: true,
          config: { empty_label: "Bez nazwy" },
        }),
        wiersz(null),
      );
      expect(screen.getByRole("textbox", { name: "Tytuł" })).toHaveAttribute(
        "placeholder",
        "Bez nazwy",
      );
    });
  });

  describe("liczba", () => {
    it("poza edycją pokazuje format, w edycji surową liczbę; zapis przekazuje tekst", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(
        pole("number", { config: { number_format: "pln" } }),
        wiersz(12.5),
      );
      const pole_ = screen.getByRole("textbox", { name: "Pole" });
      expect(pole_).toHaveValue("12,50 zł");
      await user.click(pole_);
      expect(pole_).toHaveValue("12,5");
      await user.type(pole_, "5");
      await user.tab();
      expect(onSave).toHaveBeenCalledWith("12,55");
    });

    it("niepoprawna liczba wraca do poprzedniej wartości bez zapisu", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(pole("number"), wiersz(7));
      const pole_ = screen.getByRole("textbox", { name: "Pole" });
      await user.clear(pole_);
      await user.type(pole_, "abc");
      await user.tab();
      expect(onSave).not.toHaveBeenCalled();
      expect(pole_).toHaveValue("7");
    });
  });

  describe("link", () => {
    it("poza edycją pokazuje link, w edycji pole z adresem", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(
        pole("url", { name: "Repo" }),
        wiersz("https://github.com/x"),
      );
      const link = screen.getByRole("link", { name: "github.com/x" });
      expect(link).toHaveAttribute("href", "https://github.com/x");
      const pole_ = screen.getByRole("textbox", { name: "Repo" });
      await user.click(pole_);
      expect(pole_).toHaveValue("https://github.com/x");
      expect(screen.queryByRole("link")).not.toBeInTheDocument();
      await user.type(pole_, "/y{Enter}");
      expect(onSave).toHaveBeenCalledWith("https://github.com/x/y");
    });
  });

  describe("ocena", () => {
    it("klik gwiazdki 4 przy ocenie 4 daje onSave(null)", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(pole("rating", { name: "Ocena" }), wiersz(4));
      await user.click(screen.getByRole("button", { name: "Ocena 4 na 5" }));
      expect(onSave).toHaveBeenCalledWith(null);
    });

    it("klik innej gwiazdki ustawia ocenę", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(
        pole("rating", { name: "Ocena" }),
        wiersz(null),
      );
      expect(
        screen.getByRole("button", { name: "Ocena 2 na 5" }),
      ).toHaveAttribute("aria-pressed", "false");
      await user.click(screen.getByRole("button", { name: "Ocena 2 na 5" }));
      expect(onSave).toHaveBeenCalledWith(2);
    });
  });

  it("checkbox zmienia wartość na true", async () => {
    const user = userEvent.setup();
    const { onSave } = komorka(
      pole("checkbox", { name: "Gotowe" }),
      wiersz(null),
    );
    await user.click(screen.getByRole("checkbox", { name: "Gotowe" }));
    expect(onSave).toHaveBeenCalledWith(true);
  });

  describe("data", () => {
    it("„Dziś” daje onSave(today)", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(
        pole("date", { name: "Przeczytana" }),
        wiersz(null),
      );
      await user.click(screen.getByRole("button", { name: "Przeczytana" }));
      await user.click(await screen.findByRole("button", { name: "Dziś" }));
      expect(onSave).toHaveBeenCalledWith(TODAY);
    });

    it("„Wyczyść” daje onSave(null); termin w kalendarzu pokazuje czas do terminu", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(
        pole("date", { name: "Termin", config: { show_in_calendar: true } }),
        wiersz("2026-11-16"),
      );
      expect(screen.getByText("jutro")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Termin" }));
      await user.click(await screen.findByRole("button", { name: "Wyczyść" }));
      expect(onSave).toHaveBeenCalledWith(null);
    });

    it("data bez kroju mono; czas do terminu tuż za datą, a klik w niego też otwiera kalendarz (S2Projects)", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(
        pole("date", { name: "Termin", config: { show_in_calendar: true } }),
        wiersz("2026-11-16"),
      );
      const wyzwalacz = screen.getByRole("button", { name: "Termin" });
      expect(wyzwalacz.querySelector(".font-mono")).toBeNull();
      // Wyzwalacz nie rozciąga się na całą komórkę, gdy obok stoi czas do terminu
      expect(wyzwalacz).toHaveClass("flex-none");
      expect(wyzwalacz).not.toHaveClass("flex-1");
      await user.click(screen.getByText("jutro"));
      expect(wyzwalacz).toHaveAttribute("aria-expanded", "true");
      // Klik w dymku (portal) nie zamyka go przez komórkę: wybór dnia zapisuje
      await user.click(await screen.findByRole("button", { name: "Dziś" }));
      expect(onSave).toHaveBeenCalledWith(TODAY);
    });
  });

  it("status pokazuje plakietkę opcji", () => {
    const f = pole("status", {
      config: { options: [{ id: "o1", label: "Czytam", color: "#0070f3" }] },
    });
    const { container } = komorka(f, wiersz("o1"));
    expect(within(container).getByText("Czytam")).toBeInTheDocument();
  });

  it("sekret jest tylko do odczytu (bez pola tekstowego)", () => {
    komorka(
      pole("secret", { name: "Hasło" }),
      wiersz({ v: 1, g: 1, iv: "a", ct: "b" }),
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  describe("select i status: okienko opcji", () => {
    const opcje = [
      { id: "o1", label: "Czytam", color: "#0070f3" },
      { id: "o2", label: "Bez barwy", color: "" },
    ];

    it("klik otwiera okienko, wybór zapisuje i zamyka, drugi klik w wyzwalacz też zamyka", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(
        pole("status", { name: "Status", config: { options: opcje } }),
        wiersz(null),
      );
      const wyzwalacz = screen.getByRole("button", { name: "Status" });
      await user.click(wyzwalacz);
      await user.click(screen.getByRole("option", { name: "Czytam" }));
      expect(onSave).toHaveBeenCalledWith("o1");
      expect(
        screen.queryByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      ).not.toBeInTheDocument();
      await user.click(wyzwalacz);
      expect(
        screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      ).toBeInTheDocument();
      await user.click(wyzwalacz);
      expect(
        screen.queryByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      ).not.toBeInTheDocument();
    });

    it("select pokazuje kolor opcji (bez obrysu), a zmiana koloru zmienia plakietkę", () => {
      const sel = pole("select", {
        name: "Obszar",
        config: { options: [{ id: "c", label: "Czerwona", color: "#b91c1c" }] },
      });
      komorka(sel, wiersz("c"));
      const plakietka = screen.getByText("Czerwona");
      expect(plakietka.parentElement).toHaveStyle({ color: "#b91c1c" });
      expect(plakietka.parentElement).not.toHaveClass("border-input");
    });

    it("Esc w panelu edycji wraca do listy (okienko zostaje), drugi Esc zamyka okienko", async () => {
      const user = userEvent.setup();
      komorka(
        pole("status", { name: "Status", config: { options: opcje } }),
        wiersz("o1"),
      );
      await user.click(screen.getByRole("button", { name: "Status" }));
      await user.click(screen.getByRole("button", { name: "Edytuj opcję „Czytam”" }));
      expect(
        screen.getByRole("group", { name: "Edycja opcji" }),
      ).toBeInTheDocument();
      await user.keyboard("{Escape}");
      expect(
        screen.queryByRole("group", { name: "Edycja opcji" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      ).toBeInTheDocument();
      await user.keyboard("{Escape}");
      expect(
        screen.queryByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      ).not.toBeInTheDocument();
    });

    it("długa nazwa opcji jest ucinana w komórce", () => {
      const dluga = {
        id: "d",
        label: "Bardzo długa nazwa opcji która nie mieści się w kolumnie",
        color: "#0070f3",
      };
      komorka(
        pole("status", { name: "Status", config: { options: [dluga] } }),
        wiersz("d"),
      );
      expect(screen.getByText(dluga.label)).toHaveClass("truncate");
    });

    it("opcja bez koloru renderuje się jako szara plakietka z obrysem", () => {
      komorka(
        pole("status", { name: "Status", config: { options: opcje } }),
        wiersz("o2"),
      );
      expect(screen.getByText("Bez barwy").parentElement).toHaveClass(
        "border-input",
      );
    });
  });
});
