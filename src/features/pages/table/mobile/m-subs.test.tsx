import * as React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PageRow } from "../../table-model";
import { stronaTestowa } from "../test-page";
import { MSubs } from "./m-subs";

const DZIS = "2026-11-15";

// Cztery subskrypcje (Strava-podobne dane z makiety): dwie miesięczne i jedna roczna aktywne, Disney+ anulowana
const WIERSZE = [
  { Nazwa: "Google One", "Kwota cykliczna": { amount: 99.99, cycle: "year" }, "Data odnowienia": "2027-03-12", Kategoria: "Chmura", Aktywna: true },
  { Nazwa: "Netflix", "Kwota cykliczna": { amount: 43, cycle: "month" }, "Data odnowienia": "2026-11-18", Kategoria: "Rozrywka", Aktywna: true },
  { Nazwa: "Disney+", "Kwota cykliczna": { amount: 37.99, cycle: "month" }, "Data odnowienia": "2026-12-01", Kategoria: "Rozrywka", Aktywna: false },
  { Nazwa: "Spotify", "Kwota cykliczna": { amount: 23.99, cycle: "month" }, "Data odnowienia": "2026-11-27", Kategoria: "Rozrywka", Aktywna: true },
];

function widok(wiersze: Record<string, unknown>[] = WIERSZE) {
  const strona = stronaTestowa("subscriptions", "Subscriptions", wiersze);
  const blok = strona.blocks.find((b) => b.type === "table")!;
  const onNewRow = vi.fn();
  const onEditRow = vi.fn();
  render(
    <MSubs
      title="Subscriptions"
      fields={blok.fields}
      rows={blok.rows}
      today={DZIS}
      onNewRow={onNewRow}
      onEditRow={onEditRow}
    />,
  );
  return { blok, onNewRow, onEditRow };
}

// Nazwy wierszy listy w kolejności na ekranie (przyciski z awatarem; pomijamy „Nowy wiersz” i segment)
function nazwyListy(): string[] {
  return screen
    .getAllByRole("button")
    .filter((b) => b.className.includes("m-row"))
    .map((b) => b.querySelector(".block.truncate")?.textContent ?? "");
}

describe("MSubs (CMSubs)", () => {
  it("nagłówek: link „Strony”, „Nowy wiersz” otwiera pusty arkusz, tytuł 24 px", async () => {
    const user = userEvent.setup();
    const { onNewRow } = widok();
    expect(screen.getByRole("link", { name: "Strony" })).toHaveAttribute("href", "/strony");
    expect(screen.getByRole("heading", { level: 1, name: "Subscriptions" })).toHaveClass("text-2xl");
    await user.click(screen.getByRole("button", { name: "Nowy wiersz" }));
    expect(onNewRow).toHaveBeenCalledTimes(1);
  });

  it("sumy z modelu: tylko aktywne wiersze (dwie miesięczne, jedna roczna, jedna anulowana)", () => {
    widok();
    // 43 + 23,99 + 99,99 / 12 = 75,32 zł / mies.; × 12 = 903,87 zł / rok. Anulowana (37,99) nie wchodzi
    const miesiecznie = screen.getByText("Miesięcznie").parentElement!;
    const rocznie = screen.getByText("Rocznie").parentElement!;
    expect(within(miesiecznie).getByText("75,32 zł")).toBeInTheDocument();
    expect(within(rocznie).getByText("903,87 zł")).toBeInTheDocument();
  });

  it("pasek „Najbliżej”: aktywny wiersz z najwcześniejszym odnowieniem, kwota i czas", () => {
    widok();
    expect(screen.getByText(/Najbliżej:/)).toHaveTextContent("Najbliżej: Netflix · 43,00 zł");
    // Plakietka z czasem (ostrzegawcza, pomarańczowa)
    const plakietka = screen.getAllByText("za 3 dni").find((e) => e.className.includes("bg-warning-soft"));
    expect(plakietka).toBeDefined();
  });

  it("bez aktywnych wierszy z datą: „Brak odnowień” i bez plakietki", () => {
    widok(WIERSZE.map((w) => ({ ...w, Aktywna: false })));
    expect(screen.getByText("Brak odnowień")).toBeInTheDocument();
    expect(screen.queryByText(/Najbliżej:/)).not.toBeInTheDocument();
    expect(document.querySelector(".bg-warning-soft")).toBeNull();
  });

  it("lista jest posortowana po następnym odnowieniu (anulowana też stoi wg daty)", () => {
    widok();
    expect(nazwyListy()).toEqual(["Netflix", "Spotify", "Disney+", "Google One"]);
  });

  it("wiersz: data „dd.mm · za N dni”, kwota „/m” albo „/r”, plakietka kategorii", () => {
    widok();
    const netflix = screen.getByRole("button", { name: /Netflix/ });
    expect(netflix).toHaveTextContent("18.11");
    expect(netflix).toHaveTextContent("za 3 dni");
    expect(netflix).toHaveTextContent("43,00 zł/m");
    expect(netflix).toHaveTextContent("Rozrywka");
    const google = screen.getByRole("button", { name: /Google One/ });
    expect(google).toHaveTextContent("12.03");
    expect(google).toHaveTextContent("99,99 zł/r");
    expect(google).toHaveTextContent("Chmura");
  });

  it("czas do odnowienia ≤ 7 dni jest na czerwono, dalszy nie", () => {
    widok();
    const blisko = within(screen.getByRole("button", { name: /Netflix/ })).getByText("za 3 dni");
    const daleko = within(screen.getByRole("button", { name: /Spotify/ })).getByText("za 12 dni");
    expect(blisko).toHaveClass("text-destructive-foreground");
    expect(daleko).not.toHaveClass("text-destructive-foreground");
  });

  it("wiersz anulowany: opacity-55 i plakietka „anulowana” zamiast czasu", () => {
    widok();
    const disney = screen.getByRole("button", { name: /Disney\+/ });
    expect(disney).toHaveClass("opacity-55");
    expect(disney).toHaveTextContent("anulowana");
    expect(disney).not.toHaveTextContent("za 16 dni");
    expect(screen.getByRole("button", { name: /Netflix/ })).not.toHaveClass("opacity-55");
  });

  it("filtr: Miesięczne i Roczne zawężają listę, Wszystkie ją przywraca; licznik „N z M”", async () => {
    const user = userEvent.setup();
    widok();
    expect(screen.getByText("4 z 4 subskrypcji")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Roczne" }));
    expect(nazwyListy()).toEqual(["Google One"]);
    expect(screen.getByText("1 z 4 subskrypcji")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Miesięczne" }));
    expect(nazwyListy()).toEqual(["Netflix", "Spotify", "Disney+"]);
    expect(screen.getByText("3 z 4 subskrypcji")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Wszystkie" }));
    expect(nazwyListy()).toHaveLength(4);
  });

  it("filtr nie zmienia sum ani paska „Najbliżej”", async () => {
    const user = userEvent.setup();
    widok();
    await user.click(screen.getByRole("radio", { name: "Roczne" }));
    expect(screen.getByText("75,32 zł")).toBeInTheDocument();
    expect(screen.getByText(/Najbliżej:/)).toHaveTextContent("Netflix");
  });

  it("stuknięcie wiersza otwiera arkusz tego wiersza", async () => {
    const user = userEvent.setup();
    const { blok, onEditRow } = widok();
    await user.click(screen.getByRole("button", { name: /Spotify/ }));
    const spotify = blok.rows.find((r: PageRow) => Object.values(r.values).includes("Spotify"));
    expect(onEditRow).toHaveBeenCalledWith(spotify);
  });

  it("brak wierszy: zachęta i „0 z 0 subskrypcji”", () => {
    widok([]);
    expect(screen.getByText("Brak subskrypcji. Dodaj pierwszą przyciskiem +.")).toBeInTheDocument();
    expect(screen.getByText("0 z 0 subskrypcji")).toBeInTheDocument();
    expect(screen.getAllByText("0,00 zł")).toHaveLength(2);
  });
});
