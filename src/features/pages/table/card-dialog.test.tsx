import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { PageField } from "../fields";
import type { PinnedCard } from "../table-model";
import { CardDialog } from "./card-dialog";
import { stronaTestowa, SUBSKRYPCJE } from "./test-page";

const DZIS = "2026-11-15";

const BLOK = stronaTestowa("books", "Books", [
  { Tytuł: "Atomic Habits", Autor: "James Clear", Status: "Czytam" },
  {
    Tytuł: "Deep Work",
    Autor: "Cal Newport",
    Status: "Przeczytane",
    Ocena: 4,
    Przeczytana: "2026-10-12",
  },
  {
    Tytuł: "Diuna",
    Autor: "Frank Herbert",
    Status: "Przeczytane",
    Ocena: 5,
    Przeczytana: "2026-06-15",
  },
  {
    Tytuł: "Stara",
    Autor: "Ktoś",
    Status: "Przeczytane",
    Ocena: 3,
    Przeczytana: "2025-04-20",
  },
]).blocks[0];
const POLA = BLOK.fields;
const WIERSZE = BLOK.rows;
const pole = (nazwa: string) => POLA.find((f) => f.name === nazwa)!;

function pokaz(initial: PinnedCard | null = null, fields: PageField[] = POLA) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  render(
    <CardDialog
      open
      tableName="Books"
      fields={fields}
      rows={WIERSZE}
      today={DZIS}
      initial={initial}
      onCancel={onCancel}
      onSave={onSave}
    />,
  );
  return { onSave, onCancel };
}

describe("CardDialog", () => {
  it("pokazuje tytuł, podtytuł i podpowiedź o roku", () => {
    pokaz();
    expect(screen.getByRole("heading", { name: "Nowa karta" })).toBeTruthy();
    expect(
      screen.getByText("Liczba policzona z kolumny tabeli „Books”."),
    ).toBeTruthy();
    expect(screen.getByText("„{year}” pokaże bieżący rok.")).toBeTruthy();
  });

  it("w „Kolumna” są tylko kolumny, z których da się policzyć kartę", () => {
    pokaz();
    const grupa = screen.getByRole("radiogroup", { name: "Kolumna" });
    const nazwy = within(grupa)
      .getAllByRole("radio")
      .map((r) => r.textContent);
    expect(nazwy).toEqual(["Tytuł", "Autor", "Status", "Ocena", "Przeczytana"]);
  });

  it("Status → „Liczba z opcją w tym roku” → Przeczytane → Przeczytana daje kartę z rokiem", async () => {
    const user = userEvent.setup();
    const { onSave } = pokaz();
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Kolumna" })).getByRole(
        "radio",
        { name: "Status" },
      ),
    );
    await user.click(
      screen.getByRole("radio", { name: /^Liczba z opcją w tym roku/ }),
    );
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Opcja" })).getByRole(
        "radio",
        { name: "Przeczytane" },
      ),
    );
    await user.click(
      within(
        screen.getByRole("radiogroup", { name: "Rok liczony z kolumny" }),
      ).getByRole("radio", { name: "Przeczytana" }),
    );
    // Podgląd: dwie przeczytane w 2026 (listopad i czerwiec), etykieta z bieżącym rokiem
    const podglad = screen.getByTestId("podglad-karty");
    expect(within(podglad).getByText("Przeczytane w 2026")).toBeTruthy();
    expect(within(podglad).getByText("2")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Dodaj kartę" }));
    const status = pole("Status");
    expect(onSave).toHaveBeenCalledWith({
      label: "Przeczytane w {year}",
      field_id: status.id,
      aggregation: "count_option_in_year",
      option_id: status.config.options!.find((o) => o.label === "Przeczytane")!
        .id,
      date_field_id: pole("Przeczytana").id,
    });
  });

  it("Ocena daje średnią i napis „Średnia: ocena”", async () => {
    const user = userEvent.setup();
    const { onSave } = pokaz();
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Kolumna" })).getByRole(
        "radio",
        { name: "Ocena" },
      ),
    );
    // Średnia z 4, 5 i 3
    expect(
      within(screen.getByTestId("podglad-karty")).getByText("4,0"),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Dodaj kartę" }));
    expect(onSave).toHaveBeenCalledWith({
      label: "Średnia: ocena",
      field_id: pole("Ocena").id,
      aggregation: "avg",
    });
  });

  it("zmiana kolumny czyści własny napis i ustawia pierwszy sposób liczenia", async () => {
    const user = userEvent.setup();
    pokaz();
    const napis = screen.getByLabelText("Napis") as HTMLInputElement;
    await user.type(napis, "Moja karta");
    expect(napis.value).toBe("Moja karta");
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Kolumna" })).getByRole(
        "radio",
        { name: "Status" },
      ),
    );
    expect(napis.value).toBe("");
    expect(
      screen
        .getByRole("radio", { name: /^Liczba wierszy z opcją/ })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("własny napis trafia do karty, a puste pole daje napis domyślny", async () => {
    const user = userEvent.setup();
    const { onSave } = pokaz();
    // Pierwsza kolumna to Tytuł (text): domyślny napis to nazwa kolumny
    expect(
      (screen.getByLabelText("Napis") as HTMLInputElement).placeholder,
    ).toBe("Tytuł");
    await user.type(screen.getByLabelText("Napis"), "Książki");
    await user.click(screen.getByRole("button", { name: "Dodaj kartę" }));
    expect(onSave).toHaveBeenCalledWith({
      label: "Książki",
      field_id: pole("Tytuł").id,
      aggregation: "count_distinct",
    });
  });

  it("edycja zachowuje width i unit istniejącej karty", async () => {
    const user = userEvent.setup();
    const status = pole("Status");
    const czytam = status.config.options!.find((o) => o.label === "Czytam")!;
    const { onSave } = pokaz({
      label: "Czytam teraz",
      field_id: status.id,
      aggregation: "count_option",
      option_id: czytam.id,
      width: 300,
      unit: ["książka", "książki", "książek"],
    });
    expect(screen.getByRole("heading", { name: "Edytuj kartę" })).toBeTruthy();
    expect((screen.getByLabelText("Napis") as HTMLInputElement).value).toBe(
      "Czytam teraz",
    );
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(onSave).toHaveBeenCalledWith({
      label: "Czytam teraz",
      field_id: status.id,
      aggregation: "count_option",
      option_id: czytam.id,
      width: 300,
      unit: ["książka", "książki", "książek"],
    });
  });

  it("karta z nieistniejącym field_id otwiera się na pierwszej dostępnej kolumnie", () => {
    pokaz({ label: "Stara", field_id: "nie-ma-takiego", aggregation: "avg" });
    const grupa = screen.getByRole("radiogroup", { name: "Kolumna" });
    expect(
      within(grupa)
        .getByRole("radio", { name: "Tytuł" })
        .getAttribute("aria-checked"),
    ).toBe("true");
  });

  it("najbliższa data: opcja „zrobione” z pierwszej kolumny status, tytuł z kolumny tytułu", async () => {
    const user = userEvent.setup();
    const { onSave } = pokaz();
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Kolumna" })).getByRole(
        "radio",
        { name: "Przeczytana" },
      ),
    );
    const status = pole("Status");
    const grupa = screen.getByRole("radiogroup", {
      name: "Pomiń wiersze z opcją",
    });
    expect(
      within(grupa)
        .getByRole("radio", { name: "— żadna —" })
        .getAttribute("aria-checked"),
    ).toBe("true");
    await user.click(within(grupa).getByRole("radio", { name: "Przeczytane" }));
    await user.click(screen.getByRole("button", { name: "Dodaj kartę" }));
    expect(onSave).toHaveBeenCalledWith({
      label: "Najbliższa: przeczytana",
      field_id: status.id,
      aggregation: "nearest_date",
      date_field_id: pole("Przeczytana").id,
      title_field_id: pole("Tytuł").id,
      done_option_id: status.config.options!.find(
        (o) => o.label === "Przeczytane",
      )!.id,
    });
  });

  it("najbliższa data bez kolumny status: brak wyboru opcji, done_option_id puste", async () => {
    const user = userEvent.setup();
    const bezStatusu = POLA.filter((f) => f.name !== "Status");
    const { onSave } = pokaz(null, bezStatusu);
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Kolumna" })).getByRole(
        "radio",
        { name: "Przeczytana" },
      ),
    );
    expect(
      screen.queryByRole("radiogroup", { name: "Pomiń wiersze z opcją" }),
    ).toBeNull();
    await user.click(screen.getByRole("button", { name: "Dodaj kartę" }));
    const karta = onSave.mock.calls[0][0] as PinnedCard;
    expect(karta.aggregation).toBe("nearest_date");
    expect(karta.field_id).toBe(pole("Przeczytana").id);
    expect(karta.done_option_id).toBeUndefined();
  });

  it("bez kolumny daty „Liczba z opcją w tym roku” jest wyłączone", async () => {
    const user = userEvent.setup();
    pokaz(
      null,
      POLA.filter((f) => f.type !== "date"),
    );
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Kolumna" })).getByRole(
        "radio",
        { name: "Status" },
      ),
    );
    expect(
      (
        screen.getByRole("radio", {
          name: /^Liczba z opcją w tym roku/,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it("kolumna bez opcji wyłącza „Dodaj kartę”", async () => {
    const user = userEvent.setup();
    const status = pole("Status");
    const bezOpcji = POLA.map((f) =>
      f.id === status.id ? { ...f, config: { ...f.config, options: [] } } : f,
    );
    pokaz(null, bezOpcji);
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Kolumna" })).getByRole(
        "radio",
        { name: "Status" },
      ),
    );
    expect(
      (screen.getByRole("button", { name: "Dodaj kartę" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("tabela tylko z checkboxem pokazuje komunikat, a „Dodaj kartę” jest wyłączone", () => {
    const tylkoCheckbox: PageField[] = [
      {
        id: "f-1",
        name: "Zrobione",
        type: "checkbox",
        config: {},
        position: 0,
        isTitle: false,
      },
    ];
    pokaz(null, tylkoCheckbox);
    expect(
      screen.getByText(
        "Ta tabela nie ma kolumny, z której da się policzyć kartę.",
      ),
    ).toBeTruthy();
    expect(
      (screen.getByRole("button", { name: "Dodaj kartę" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it("Anuluj wywołuje onCancel", async () => {
    const user = userEvent.setup();
    const { onCancel } = pokaz();
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("edycja karty z „{year}” zachowuje surowy znacznik, a podgląd pokazuje rok", async () => {
    const user = userEvent.setup();
    const status = pole("Status");
    const przeczytane = status.config.options!.find(
      (o) => o.label === "Przeczytane",
    )!;
    const { onSave } = pokaz({
      label: "Przeczytane w {year}",
      field_id: status.id,
      aggregation: "count_option_in_year",
      option_id: przeczytane.id,
      date_field_id: pole("Przeczytana").id,
    });
    expect(
      within(screen.getByTestId("podglad-karty")).getByText(
        "Przeczytane w 2026",
      ),
    ).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect((onSave.mock.calls[0][0] as PinnedCard).label).toBe(
      "Przeczytane w {year}",
    );
  });

  it("zmiana sposobu liczenia gubi unit, a znikła opcja czyści napis", async () => {
    const user = userEvent.setup();
    const status = pole("Status");
    const { onSave } = pokaz({
      label: "Stara",
      field_id: status.id,
      aggregation: "count_option",
      option_id: "nie-ma",
      unit: ["a", "b", "c"],
    });
    expect((screen.getByLabelText("Napis") as HTMLInputElement).value).toBe("");
    await user.click(screen.getByRole("radio", { name: /^Ile z wszystkich/ }));
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect((onSave.mock.calls[0][0] as PinnedCard).unit).toBeUndefined();
  });
});

// Subscriptions (S2Main): sposoby liczenia Kwoty cyklicznej i Daty odnowienia
describe("CardDialog: Subscriptions", () => {
  const SUB = stronaTestowa("subscriptions", "Subscriptions", SUBSKRYPCJE).blocks[0];

  function pokazSub() {
    const onSave = vi.fn();
    render(
      <CardDialog
        open
        tableName="Subscriptions"
        fields={SUB.fields}
        rows={SUB.rows}
        today={DZIS}
        initial={null}
        onCancel={vi.fn()}
        onSave={onSave}
      />,
    );
    return { onSave };
  }

  it("Kwota cykliczna proponuje „Suma na miesiąc” i „Suma na rok”; podgląd liczy aktywne wiersze", async () => {
    const user = userEvent.setup();
    const { onSave } = pokazSub();
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Kolumna" })).getByRole("radio", { name: "Kwota cykliczna" }),
    );
    const sposoby = within(screen.getByRole("radiogroup", { name: "Co policzyć" })).getAllByRole("radio");
    expect(sposoby.map((r) => r.querySelector(".font-medium")?.textContent)).toEqual([
      "Suma na miesiąc",
      "Suma na rok",
    ]);
    expect(sposoby[0]).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("np. „Σ miesięcznie: 437,94 zł”")).toBeTruthy();
    const podglad = screen.getByTestId("podglad-karty");
    expect(within(podglad).getByText("Σ miesięcznie")).toBeTruthy();
    expect(within(podglad).getByText("63,83")).toBeTruthy();
    expect(within(podglad).getByText("zł")).toBeTruthy();
    await user.click(sposoby[1]);
    expect(within(podglad).getByText("765,99")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Dodaj kartę" }));
    expect(onSave).toHaveBeenCalledWith({
      label: "Σ rocznie",
      field_id: SUB.fields.find((f) => f.name === "Kwota cykliczna")!.id,
      aggregation: "sum_year",
    });
  });

  it("Data odnowienia proponuje „Najbliższe odnowienie”", async () => {
    const user = userEvent.setup();
    pokazSub();
    await user.click(
      within(screen.getByRole("radiogroup", { name: "Kolumna" })).getByRole("radio", { name: "Data odnowienia" }),
    );
    const sposoby = within(screen.getByRole("radiogroup", { name: "Co policzyć" })).getAllByRole("radio");
    expect(sposoby).toHaveLength(1);
    expect(sposoby[0]).toHaveTextContent("Najbliższe odnowienie");
    expect(sposoby[0]).toHaveTextContent("najbliższa przyszła data wg cyklu");
    const podglad = screen.getByTestId("podglad-karty");
    expect(within(podglad).getByText("Netflix")).toBeTruthy();
    expect(within(podglad).getByText("za 6 dni")).toBeTruthy();
  });
});

describe("CardDialog na telefonie (CMCardSheet)", () => {
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("przyciski są w nagłówku („Anuluj” i „Dodaj”), bez stopki z dublami", async () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    const { onSave, onCancel } = pokaz();
    expect(screen.getAllByRole("button", { name: "Anuluj" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Dodaj kartę" })).toBeNull();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(onSave).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
