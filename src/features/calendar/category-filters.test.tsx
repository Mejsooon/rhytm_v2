import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CategoryRow } from "./load-calendar";
import { CategoryFilters } from "./category-filters";

function kat(over: Partial<CategoryRow>): CategoryRow {
  return {
    id: "c1",
    name: "Studia",
    color: "#0070f3",
    hidden: false,
    is_system: false,
    position: 1,
    user_id: "u1",
    created_at: null,
    ...over,
  };
}

describe("CategoryFilters", () => {
  const kategorie = [
    kat({}),
    kat({ id: "c2", name: "Dom", color: "#a16207", hidden: true, position: 2 }),
    kat({ id: "c3", name: "Sport", color: "#c2410c", is_system: true, position: 3 }),
  ];
  const liczniki = { c1: 3, c2: 2 };

  it("pokazuje etykietę POKAŻ, chipy z licznikami i + Kategoria", () => {
    render(<CategoryFilters categories={kategorie} counts={liczniki} onToggle={() => {}} onAdd={() => {}} />);
    expect(screen.getByText("Pokaż")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Studia/ })).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: /Dom/ })).toHaveTextContent("2");
    // Sport (systemowy) bez wystąpień ma licznik 0
    expect(screen.getByRole("button", { name: /Sport/ })).toHaveTextContent("0");
    expect(screen.getByRole("button", { name: "+ Kategoria" })).toBeInTheDocument();
  });

  it("ukryta kategoria ma przerywaną ramkę i aria-pressed=false", () => {
    render(<CategoryFilters categories={kategorie} counts={liczniki} onToggle={() => {}} onAdd={() => {}} />);
    const ukryty = screen.getByRole("button", { name: /Dom/ });
    expect(ukryty).toHaveAttribute("aria-pressed", "false");
    expect(ukryty.className).toContain("border-dashed");
    const widoczny = screen.getByRole("button", { name: /Studia/ });
    expect(widoczny).toHaveAttribute("aria-pressed", "true");
    expect(widoczny.className).not.toContain("border-dashed");
  });

  it("klik woła onToggle z kategorią, + Kategoria woła onAdd", async () => {
    const onToggle = vi.fn();
    const onAdd = vi.fn();
    render(<CategoryFilters categories={kategorie} counts={liczniki} onToggle={onToggle} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: /Studia/ }));
    expect(onToggle).toHaveBeenCalledWith(kategorie[0]);
    await userEvent.click(screen.getByRole("button", { name: "+ Kategoria" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });
});
