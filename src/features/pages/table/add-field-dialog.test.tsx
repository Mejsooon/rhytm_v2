import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PageField } from "../fields";
import { AddFieldDialog } from "./add-field-dialog";

// Pola tabeli Subscriptions: Kwota cykliczna i Checkbox „Aktywna” do wyboru w ustawieniach Daty odnowienia
const POLA: PageField[] = [
  { id: "f-nazwa", name: "Nazwa", type: "text", config: {}, position: 0, isTitle: true },
  { id: "f-cena", name: "Cena", type: "recurring", config: {}, position: 1, isTitle: false },
  { id: "f-akt", name: "Aktywna", type: "checkbox", config: {}, position: 2, isTitle: false },
];

async function otworz(user: ReturnType<typeof userEvent.setup>, fields: PageField[] = POLA) {
  const onAdd = vi.fn();
  render(<AddFieldDialog iconTrigger fields={fields} onAdd={onAdd} />);
  await user.click(screen.getByRole("button", { name: "Dodaj kolumnę" }));
  const okno = await screen.findByRole("dialog", { name: "Nowe pole" });
  return { okno, onAdd };
}

describe("AddFieldDialog: typy inteligentne", () => {
  beforeEach(() => vi.clearAllMocks());

  it("lista ma grupy „Podstawowe” i „Inteligentne”, a oba typy inteligentne zieloną plakietkę „liczy”", async () => {
    const user = userEvent.setup();
    const { okno } = await otworz(user);
    expect(within(okno).getByText("Podstawowe")).toBeInTheDocument();
    expect(within(okno).getByText("Inteligentne")).toBeInTheDocument();
    const kwota = within(okno).getByRole("button", { name: /Kwota cykliczna/ });
    const odnowienie = within(okno).getByRole("button", { name: /Data odnowienia/ });
    expect(kwota).toHaveTextContent("liczy");
    expect(odnowienie).toHaveTextContent("liczy");
    expect(within(kwota).getByText("liczy").className).toContain("bg-success-soft");
    // Wyszukiwarka zawęża także grupę „Inteligentne”
    await user.type(within(okno).getByRole("textbox", { name: "Szukaj typu" }), "odnow");
    expect(within(okno).queryByText("Podstawowe")).not.toBeInTheDocument();
    expect(within(okno).getByRole("button", { name: /Data odnowienia/ })).toBeInTheDocument();
    expect(within(okno).queryByRole("button", { name: /Kwota cykliczna/ })).not.toBeInTheDocument();
  });

  it("Kwota cykliczna: nazwa „Cena”, plakietka „inteligentne”, opis i ustawienia, a cykl zmienia przykład", async () => {
    const user = userEvent.setup();
    const { okno, onAdd } = await otworz(user);
    await user.click(within(okno).getByRole("button", { name: /Kwota cykliczna/ }));
    expect(within(okno).getByRole("textbox", { name: "Nazwa pola" })).toHaveValue("Cena");
    expect(within(okno).getByText("inteligentne")).toBeInTheDocument();
    expect(within(okno).getByText("Kwota z cyklem. Sama przelicza się na miesiąc i rok, a pod tabelą liczy sumy.")).toBeInTheDocument();
    expect(within(okno).getByText("/ mies. i / rok")).toBeInTheDocument();
    expect(within(okno).getByText("Waluta")).toBeInTheDocument();
    expect(within(okno).getByText("50,00 / mies. → 600,00 / rok")).toBeInTheDocument();
    await user.click(within(okno).getByRole("radio", { name: "rok" }));
    expect(within(okno).getByText("600,00 / rok → 50,00 / mies.")).toBeInTheDocument();
    await user.click(within(okno).getByRole("button", { name: "Dodaj pole" }));
    expect(onAdd).toHaveBeenCalledWith({ name: "Cena", type: "recurring", config: { default_cycle: "year" } });
  });

  it("Kwota cykliczna: domyślny cykl to miesiąc", async () => {
    const user = userEvent.setup();
    const { okno, onAdd } = await otworz(user);
    await user.click(within(okno).getByRole("button", { name: /Kwota cykliczna/ }));
    await user.click(within(okno).getByRole("button", { name: "Dodaj pole" }));
    expect(onAdd).toHaveBeenCalledWith({ name: "Cena", type: "recurring", config: { default_cycle: "month" } });
  });

  it("Data odnowienia: domyślnie cykl z pierwszej Kwoty, kalendarz włączony i pierwszy Checkbox", async () => {
    const user = userEvent.setup();
    const { okno, onAdd } = await otworz(user);
    await user.click(within(okno).getByRole("button", { name: /Data odnowienia/ }));
    expect(within(okno).getByRole("textbox", { name: "Nazwa pola" })).toHaveValue("Odnowienie");
    const cykl = within(okno).getByRole("combobox", { name: "Cykl z pola" });
    expect(cykl).toHaveValue("f-cena");
    expect(within(cykl).getAllByRole("option").map((o) => o.textContent)).toEqual(["Cena (Kwota cykliczna)", "własny cykl"]);
    expect(within(okno).getByRole("switch", { name: "Pokaż w kalendarzu" })).toHaveAttribute("aria-checked", "true");
    const aktywne = within(okno).getByRole("combobox", { name: "Tylko gdy zaznaczone" });
    expect(aktywne).toHaveValue("f-akt");
    expect(within(aktywne).getAllByRole("option").map((o) => o.textContent)).toEqual(["Aktywna", "— zawsze —"]);
    // Segment własnego cyklu pojawia się dopiero po wybraniu „własny cykl”
    expect(within(okno).queryByRole("radiogroup", { name: "Własny cykl" })).not.toBeInTheDocument();
    await user.click(within(okno).getByRole("button", { name: "Dodaj pole" }));
    expect(onAdd).toHaveBeenCalledWith({
      name: "Odnowienie",
      type: "renewal",
      config: { cycle_field_id: "f-cena", show_in_calendar: true, active_field_id: "f-akt" },
    });
  });

  it("Data odnowienia: własny cykl (rok), kalendarz wyłączony i „— zawsze —”", async () => {
    const user = userEvent.setup();
    const { okno, onAdd } = await otworz(user);
    await user.click(within(okno).getByRole("button", { name: /Data odnowienia/ }));
    await user.selectOptions(within(okno).getByRole("combobox", { name: "Cykl z pola" }), "własny cykl");
    await user.click(within(within(okno).getByRole("radiogroup", { name: "Własny cykl" })).getByRole("radio", { name: "rok" }));
    await user.click(within(okno).getByRole("switch", { name: "Pokaż w kalendarzu" }));
    await user.selectOptions(within(okno).getByRole("combobox", { name: "Tylko gdy zaznaczone" }), "— zawsze —");
    await user.click(within(okno).getByRole("button", { name: "Dodaj pole" }));
    expect(onAdd).toHaveBeenCalledWith({
      name: "Odnowienie",
      type: "renewal",
      config: { cycle: "year", show_in_calendar: false },
    });
  });

  it("Data odnowienia w tabeli bez Kwoty i Checkboxa: własny cykl miesięczny i „— zawsze —”", async () => {
    const user = userEvent.setup();
    const { okno, onAdd } = await otworz(user, [POLA[0]]);
    await user.click(within(okno).getByRole("button", { name: /Data odnowienia/ }));
    expect(within(okno).getByRole("combobox", { name: "Cykl z pola" })).toHaveValue("");
    expect(within(okno).getByRole("radiogroup", { name: "Własny cykl" })).toBeInTheDocument();
    await user.click(within(okno).getByRole("button", { name: "Dodaj pole" }));
    expect(onAdd).toHaveBeenCalledWith({
      name: "Odnowienie",
      type: "renewal",
      config: { cycle: "month", show_in_calendar: true },
    });
  });
});
