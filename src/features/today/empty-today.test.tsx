import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmptyToday } from "./empty-today";
import { firstSteps } from "./first-steps";

const zera = { blocks: 0, habits: 0, workouts: 0, sleepLogs: 0 };

describe("EmptyToday", () => {
  it("pokazuje powitanie, licznik 0 / 4 i cztery linki Dodaj", () => {
    render(<EmptyToday name="Mejson" steps={firstSteps(zera)} />);
    expect(screen.getByText("Witaj w rhytm, Mejson")).toBeInTheDocument();
    expect(
      screen.getByText("Cztery kroki i Dziś zacznie pokazywać Twój tydzień."),
    ).toBeInTheDocument();
    expect(screen.getByText("0 / 4")).toBeInTheDocument();
    const dodaj = screen.getAllByText("Dodaj", { selector: "span" });
    expect(dodaj).toHaveLength(4);
    const hrefy = dodaj.map((el) => el.closest("a")!.getAttribute("href"));
    expect(hrefy).toEqual([
      "/kalendarz",
      "/nawyki?nowy=nawyk",
      "/sport",
      "/nawyki?nowy=sen",
    ]);
    expect(screen.getByText("Plan dnia jest pusty")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "+ Nowy blok" })).toHaveAttribute(
      "href",
      "/kalendarz",
    );
  });

  it("zrobiony krok ma ✓ i przekreślenie, bez przycisku Dodaj", () => {
    render(<EmptyToday name="M" steps={firstSteps({ ...zera, blocks: 1 })} />);
    expect(screen.getByText("1 / 4")).toBeInTheDocument();
    const tytul = screen.getByText("Dodaj pierwszy blok w kalendarzu");
    expect(tytul.className).toContain("line-through");
    expect(within(tytul.closest("a")!).getByText("✓")).toBeInTheDocument();
    expect(screen.getAllByText("Dodaj", { selector: "span" })).toHaveLength(3);
  });
});
