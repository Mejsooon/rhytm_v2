import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CategoryRow } from "./load-calendar";
import { CategoryFilters, CategorySheet } from "./category-filters";

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

const kategorie = [
  kat({}),
  kat({ id: "c2", name: "Dom", color: "#a16207", hidden: true, position: 2 }),
  kat({ id: "c3", name: "Sport", color: "#c2410c", is_system: true, position: 3 }),
];

describe("CategoryFilters (przycisk „Kategorie” na webie)", () => {
  it("przycisk pokazuje widoczne/wszystkie i kropki widocznych kategorii", () => {
    render(<CategoryFilters categories={kategorie} onToggle={() => {}} onAdd={() => {}} />);
    const przycisk = screen.getByRole("button", { name: /^Kategorie/ });
    expect(przycisk).toHaveTextContent("Kategorie2/3");
    // Kropki tylko widocznych (Studia, Sport), najwyżej 4
    expect(screen.getByTestId("kropki-kategorii").children).toHaveLength(2);
  });

  it("najwyżej 4 kropki przy wielu widocznych kategoriach", () => {
    const duzo = Array.from({ length: 6 }, (_, i) => kat({ id: `k${i}`, name: `K${i}`, position: i }));
    render(<CategoryFilters categories={duzo} onToggle={() => {}} onAdd={() => {}} />);
    expect(screen.getByRole("button", { name: /^Kategorie/ })).toHaveTextContent("6/6");
    expect(screen.getByTestId("kropki-kategorii").children).toHaveLength(4);
  });

  it("menu ma pole wyboru przy każdej kategorii; klik woła onToggle i menu zostaje otwarte", async () => {
    const onToggle = vi.fn();
    render(<CategoryFilters categories={kategorie} onToggle={onToggle} onAdd={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: /^Kategorie/ }));
    // Menu jest opisane przyciskiem (aria-labelledby z Radix): „Kategorie 2/3”
    const menu = await screen.findByRole("menu", { name: /^Kategorie/ });
    expect(menu).toBeInTheDocument();
    expect(screen.getByRole("menuitemcheckbox", { name: /Studia/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemcheckbox", { name: /Dom/ })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitemcheckbox", { name: /Sport/ })).toHaveAttribute("aria-checked", "true");

    await userEvent.click(screen.getByRole("menuitemcheckbox", { name: /Dom/ }));
    expect(onToggle).toHaveBeenCalledWith(kategorie[1]);
    expect(screen.getByRole("menu", { name: /^Kategorie/ })).toBeInTheDocument();
  });

  it("Esc zamyka menu, a fokus wraca na przycisk", async () => {
    render(<CategoryFilters categories={kategorie} onToggle={() => {}} onAdd={() => {}} />);
    const przycisk = screen.getByRole("button", { name: /^Kategorie/ });
    await userEvent.click(przycisk);
    await screen.findByRole("menu", { name: /^Kategorie/ });
    await userEvent.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("menu")).not.toBeInTheDocument());
    expect(przycisk).toHaveFocus();
  });

  it("„+ Kategoria” zamyka menu i woła onAdd", async () => {
    const onAdd = vi.fn();
    render(<CategoryFilters categories={kategorie} onToggle={() => {}} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: /^Kategorie/ }));
    await userEvent.click(await screen.findByRole("menuitem", { name: "+ Kategoria" }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});

describe("CategorySheet (arkusz kategorii na telefonie)", () => {
  it("ikona ma etykietę i otwiera arkusz z przełącznikiem przy każdej kategorii", async () => {
    render(<CategorySheet categories={kategorie} onToggle={() => {}} onAdd={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    const arkusz = await screen.findByRole("dialog", { name: "Kategorie" });
    expect(arkusz).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Pokaż kategorię Studia" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("switch", { name: "Pokaż kategorię Dom" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("switch")).toHaveLength(3);
  });

  it("przełącznik woła onToggle z kategorią", async () => {
    const onToggle = vi.fn();
    render(<CategorySheet categories={kategorie} onToggle={onToggle} onAdd={() => {}} />);
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    await userEvent.click(await screen.findByRole("switch", { name: "Pokaż kategorię Sport" }));
    expect(onToggle).toHaveBeenCalledWith(kategorie[2]);
  });

  it("„+ Kategoria” zamyka arkusz i woła onAdd", async () => {
    const onAdd = vi.fn();
    render(<CategorySheet categories={kategorie} onToggle={() => {}} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    await userEvent.click(await screen.findByRole("button", { name: "+ Kategoria" }));
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog", { name: "Kategorie" })).not.toBeInTheDocument();
  });

  it("„Zamknij” zamyka arkusz bez wołania onAdd", async () => {
    const onAdd = vi.fn();
    render(<CategorySheet categories={kategorie} onToggle={() => {}} onAdd={onAdd} />);
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    await userEvent.click(await screen.findByRole("button", { name: "Zamknij" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onAdd).not.toHaveBeenCalled();
  });
});
