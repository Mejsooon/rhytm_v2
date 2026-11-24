import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PageField } from "../fields";
import type { PageRow } from "../table-model";
import { TableCell } from "./table-cell";

// Sekret czyta stan sejfu (VaultProvider jest w powłoce aplikacji); tu sejf jest zamknięty
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => ({ status: "zablokowany" }) }));

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
            fields={[field]}
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
                fields={[f]}
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

    it("link wygląda jak zwykły tekst i podkreśla się dopiero po najechaniu", () => {
      komorka(pole("url", { name: "Repo" }), wiersz("https://github.com/x"));
      const link = screen.getByRole("link", { name: "github.com/x" });
      expect(link).toHaveClass("text-foreground", "hover:underline");
      expect(link.className.split(" ")).not.toContain("underline");
    });
  });

  describe("kolor tekstu", () => {
    it("tekst kolumny innej niż tytuł jest ciemny, nie szary", () => {
      komorka(pole("text", { name: "Autor" }), wiersz("Herbert"));
      const td = screen.getByRole("textbox", { name: "Autor" }).closest("td");
      expect(td).toHaveClass("text-foreground");
      expect(td?.className).not.toContain("text-soft-foreground");
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
      await user.click(screen.getByRole("button", { name: "Przeczytana: puste" }));
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
      await user.click(screen.getByRole("button", { name: "Termin: 16.11.2026" }));
      await user.click(await screen.findByRole("button", { name: "Wyczyść" }));
      expect(onSave).toHaveBeenCalledWith(null);
    });

    it("data bez kroju mono; czas do terminu tuż za datą, a klik w niego też otwiera kalendarz (S2Projects)", async () => {
      const user = userEvent.setup();
      const { onSave } = komorka(
        pole("date", { name: "Termin", config: { show_in_calendar: true } }),
        wiersz("2026-11-16"),
      );
      const wyzwalacz = screen.getByRole("button", { name: "Termin: 16.11.2026" });
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

  describe("data: klik w puste miejsce komórki", () => {
    it("przy otwartym kalendarzu zamyka go i nie otwiera ponownie; przy zamkniętym otwiera", async () => {
      const { container } = komorka(
        pole("date", { name: "Termin", config: { show_in_calendar: true } }),
        wiersz("2026-11-16"),
      );
      const wyzwalacz = screen.getByRole("button", { name: "Termin: 16.11.2026" });
      // Puste miejsce komórki: div z wyzwalaczem (nie sam przycisk)
      const puste = container.querySelector("td > div") as HTMLElement;

      // Zamknięty: klik w puste miejsce otwiera
      fireEvent.pointerDown(puste);
      fireEvent.click(puste);
      expect(wyzwalacz).toHaveAttribute("aria-expanded", "true");
      expect(await screen.findByRole("dialog")).toBeInTheDocument();
      // Radix podpina nasłuch pointerdown poza treścią po setTimeout(0)
      await act(() => new Promise((r) => setTimeout(r, 10)));

      // Otwarty: pointerdown + click w to samo puste miejsce zamyka i zostaje zamknięty
      fireEvent.pointerDown(puste);
      // Radix (popover 1.3.x) zamyka dymek dopiero na click poza treścią, więc w onClick komórki
      // aria-expanded jest jeszcze true, a programowy click() wyzwalacza zamyka, nie otwiera ponownie
      fireEvent.click(puste);
      await act(() => new Promise((r) => setTimeout(r, 10)));
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(wyzwalacz).toHaveAttribute("aria-expanded", "false");

      // Po zamknięciu klik w puste miejsce znów otwiera
      fireEvent.pointerDown(puste);
      fireEvent.click(puste);
      expect(wyzwalacz).toHaveAttribute("aria-expanded", "true");
    });
  });

  it("status pokazuje plakietkę opcji", () => {
    const f = pole("status", {
      config: { options: [{ id: "o1", label: "Czytam", color: "#0070f3" }] },
    });
    const { container } = komorka(f, wiersz("o1"));
    expect(within(container).getByText("Czytam")).toBeInTheDocument();
  });

  it("sekret przy zamkniętym sejfie: „zablokowane”, bez pola tekstowego", () => {
    komorka(
      pole("secret", { name: "Hasło" }),
      wiersz({ v: 1, g: 1, iv: "a", ct: "b" }),
    );
    expect(screen.getByText("zablokowane")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("readOnly: wartość jako tekst, bez pola i przycisków", () => {
    render(
      <table>
        <tbody>
          <tr>
            <TableCell
              row={{ id: "row-1", values: { f1: "GitHub", f2: "o1" }, position: 0, deletedAt: null }}
              field={pole("text", { name: "Serwis" })}
              fields={[]}
              today={TODAY}
              done={null}
              readOnly
              onSave={vi.fn()}
            />
            <TableCell
              row={{ id: "row-1", values: { f1: "GitHub", f2: "o1" }, position: 0, deletedAt: null }}
              field={pole("select", { id: "f2", name: "Kategoria", config: { options: [{ id: "o1", label: "Praca", color: "" }] } })}
              fields={[]}
              today={TODAY}
              done={null}
              readOnly
              onSave={vi.fn()}
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByText("GitHub")).toBeInTheDocument();
    expect(screen.getByText("Praca")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
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
      // Czytnik ekranu słyszy pole i wartość (pusta komórka: „puste”)
      const wyzwalacz = screen.getByRole("button", { name: "Status: puste" });
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
      await user.click(screen.getByRole("button", { name: "Status: Czytam" }));
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

// Subscriptions (S2Main.dc.html): Kwota cykliczna i Data odnowienia z polami „Kwota” i „Aktywna” w tej samej tabeli
describe("TableCell: Subscriptions", () => {
  const kwota: PageField = {
    id: "k",
    name: "Kwota cykliczna",
    type: "recurring",
    config: { default_cycle: "month" },
    position: 0,
    isTitle: false,
  };
  const aktywna: PageField = { id: "a", name: "Aktywna", type: "checkbox", config: {}, position: 2, isTitle: false };
  const odnowienie: PageField = {
    id: "o",
    name: "Data odnowienia",
    type: "renewal",
    config: { cycle_field_id: "k", active_field_id: "a", show_in_calendar: true },
    position: 1,
    isTitle: false,
  };
  const pola = [kwota, odnowienie, aktywna];

  function subskrypcja(values: Record<string, unknown>): PageRow {
    return { id: "row-1", values, position: 0, deletedAt: null };
  }

  function wTabeli(field: PageField, row: PageRow, onSave: (v: unknown) => void) {
    return (
      <table>
        <tbody>
          <tr>
            <TableCell row={row} field={field} fields={pola} today={TODAY} done={null} onSave={onSave} />
          </tr>
        </tbody>
      </table>
    );
  }

  describe("Data odnowienia: kotwica serii", () => {
    it("ponowny wybór daty z serii nie woła zapisu", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const wiersz_ = subskrypcja({ k: { amount: 43, cycle: "month" }, o: "2026-10-21", a: true });
      render(wTabeli(odnowienie, wiersz_, onSave));
      await user.click(screen.getByRole("button", { name: /Data odnowienia: 21\.11\.2026/ }));
      await user.click(await screen.findByRole("button", { name: /^21(\D|$)/ }));
      expect(onSave).not.toHaveBeenCalled();
    });

    it("data spoza serii zapisuje nową kotwicę", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const wiersz_ = subskrypcja({ k: { amount: 43, cycle: "month" }, o: "2026-10-21", a: true });
      render(wTabeli(odnowienie, wiersz_, onSave));
      await user.click(screen.getByRole("button", { name: /Data odnowienia: 21\.11\.2026/ }));
      await user.click(await screen.findByRole("button", { name: /25/ }));
      expect(onSave).toHaveBeenCalledWith("2026-11-25");
    });
  });

  describe("Kwota cykliczna", () => {
    it("pole kwoty do prawej, szare „zł” i przycisk cyklu w kolejności z makiety", () => {
      render(wTabeli(kwota, subskrypcja({ k: { amount: 43, cycle: "month" } }), vi.fn()));
      const pole_ = screen.getByRole("textbox", { name: "Kwota cykliczna" });
      expect(pole_).toHaveValue("43,00");
      expect(pole_).toHaveAttribute("inputmode", "decimal");
      expect(pole_).toHaveAttribute("placeholder", "0,00");
      expect(pole_).toHaveClass("text-right");
      const zl = screen.getByText("zł");
      expect(zl).toHaveClass("text-[13px]", "text-muted-foreground");
      const cykl = screen.getByRole("button", { name: "Cykl: mies. (kliknij, aby zmienić)" });
      expect(cykl).toHaveTextContent("/ mies.");
      // Kolejność w DOM: pole, „zł”, przycisk
      expect(pole_.compareDocumentPosition(zl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(zl.compareDocumentPosition(cykl) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("wpisanie „43,5” zapisuje {amount: 43.5, cycle: month}, a po zapisie i wyjściu pole pokazuje „43,50”", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      const { rerender } = render(wTabeli(kwota, subskrypcja({}), onSave));
      const pole_ = screen.getByRole("textbox", { name: "Kwota cykliczna" });
      await user.type(pole_, "43,5");
      await user.tab();
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({ amount: 43.5, cycle: "month" });
      // Magazyn oddaje zapisaną wartość (jak optymistyczna aktualizacja store)
      rerender(wTabeli(kwota, subskrypcja({ k: { amount: 43.5, cycle: "month" } }), onSave));
      expect(pole_).toHaveValue("43,50");
    });

    it("zapis po 600 ms przerwy w pisaniu; kwota roczna zostaje roczna", () => {
      vi.useFakeTimers();
      try {
        const onSave = vi.fn();
        render(wTabeli(kwota, subskrypcja({ k: { amount: 200, cycle: "year" } }), onSave));
        const pole_ = screen.getByRole("textbox", { name: "Kwota cykliczna" });
        fireEvent.focus(pole_);
        fireEvent.change(pole_, { target: { value: "249,99" } });
        act(() => vi.advanceTimersByTime(599));
        expect(onSave).not.toHaveBeenCalled();
        act(() => vi.advanceTimersByTime(1));
        expect(onSave).toHaveBeenCalledWith({ amount: 249.99, cycle: "year" });
      } finally {
        vi.useRealTimers();
      }
    });

    it("pusty tekst zapisuje null, niepoprawny nic nie zapisuje", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(wTabeli(kwota, subskrypcja({ k: { amount: 43, cycle: "month" } }), onSave));
      const pole_ = screen.getByRole("textbox", { name: "Kwota cykliczna" });
      await user.clear(pole_);
      await user.tab();
      expect(onSave).toHaveBeenCalledWith(null);
      onSave.mockClear();
      await user.click(pole_);
      await user.clear(pole_);
      await user.type(pole_, "abc");
      await user.tab();
      expect(onSave).not.toHaveBeenCalled();
      expect(pole_).toHaveValue("43,00");
    });

    it("kwota z tysiącami (twarda spacja z formatu) da się poprawić", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(wTabeli(kwota, subskrypcja({ k: { amount: 1234.5, cycle: "month" } }), onSave));
      const pole_ = screen.getByRole("textbox", { name: "Kwota cykliczna" });
      expect(pole_).toHaveValue("1\u00a0234,50");
      // Kursor na końcu „1 234,50”: zamiana ostatniej cyfry
      await user.type(pole_, "{Backspace}1");
      await user.tab();
      expect(onSave).toHaveBeenCalledWith({ amount: 1234.51, cycle: "month" });
    });

    it("klik w „/ mies.” zapisuje od razu cykl roczny", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(wTabeli(kwota, subskrypcja({ k: { amount: 43, cycle: "month" } }), onSave));
      await user.click(screen.getByRole("button", { name: "Cykl: mies. (kliknij, aby zmienić)" }));
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({ amount: 43, cycle: "year" });
    });

    it("„/ rok” wraca do miesiąca", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(wTabeli(kwota, subskrypcja({ k: { amount: 249.99, cycle: "year" } }), onSave));
      await user.click(screen.getByRole("button", { name: "Cykl: rok (kliknij, aby zmienić)" }));
      expect(onSave).toHaveBeenCalledWith({ amount: 249.99, cycle: "month" });
    });

    it("klik cyklu w trakcie pisania zapisuje wpisaną kwotę z nowym cyklem (jeden zapis)", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(wTabeli(kwota, subskrypcja({}), onSave));
      await user.type(screen.getByRole("textbox", { name: "Kwota cykliczna" }), "120");
      await user.click(screen.getByRole("button", { name: "Cykl: mies. (kliknij, aby zmienić)" }));
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({ amount: 120, cycle: "year" });
    });

    it("pusty wiersz: przycisk cyklu wyłączony i pokazuje cykl domyślny pola", () => {
      const roczna = { ...kwota, config: { default_cycle: "year" as const } };
      render(wTabeli(roczna, subskrypcja({}), vi.fn()));
      const cykl = screen.getByRole("button", { name: "Cykl: rok (kliknij, aby zmienić)" });
      expect(cykl).toBeDisabled();
      expect(cykl).toHaveTextContent("/ rok");
    });
  });

  describe("Data odnowienia", () => {
    it("kotwica 21.10.2026 przy dziś 15.11.2026: 21.11.2026 i „za 6 dni” w pomarańczowej plakietce", () => {
      render(
        wTabeli(odnowienie, subskrypcja({ k: { amount: 43, cycle: "month" }, o: "2026-10-21", a: true }), vi.fn()),
      );
      expect(screen.getByRole("button", { name: "Data odnowienia: 21.11.2026" })).toHaveTextContent("21.11.2026");
      expect(screen.getByText("za 6 dni")).toHaveClass("bg-warning-soft");
    });

    it("cykl roczny z kwoty: kotwica 03.12.2025 daje 03.12.2026 i szary tekst „za 18 dni”", () => {
      render(
        wTabeli(odnowienie, subskrypcja({ k: { amount: 249.99, cycle: "year" }, o: "2025-12-03", a: true }), vi.fn()),
      );
      expect(screen.getByRole("button", { name: "Data odnowienia: 03.12.2026" })).toBeInTheDocument();
      const tekst = screen.getByText("za 18 dni");
      expect(tekst).toHaveClass("text-muted-foreground");
      expect(tekst).not.toHaveClass("bg-warning-soft");
    });

    it("wiersz nieaktywny: szara plakietka „anulowana” zamiast czasu do odnowienia", () => {
      render(
        wTabeli(odnowienie, subskrypcja({ k: { amount: 37.99, cycle: "month" }, o: "2026-11-24", a: false }), vi.fn()),
      );
      expect(screen.getByText("anulowana")).toHaveClass("bg-muted");
      expect(screen.queryByText("za 9 dni")).not.toBeInTheDocument();
    });

    it("wybór daty zapisuje nową kotwicę", async () => {
      const user = userEvent.setup();
      const onSave = vi.fn();
      render(wTabeli(odnowienie, subskrypcja({ o: "2026-10-21", a: true }), onSave));
      await user.click(screen.getByRole("button", { name: "Data odnowienia: 21.11.2026" }));
      await user.click(await screen.findByRole("button", { name: "Dziś" }));
      expect(onSave).toHaveBeenCalledWith(TODAY);
    });
  });
});
