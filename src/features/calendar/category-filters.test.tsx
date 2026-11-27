import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CategoryRow, RenewalSource } from "./load-calendar";
import { CategorySheet } from "./category-filters";

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
  kat({
    id: "c3",
    name: "Sport",
    color: "#c2410c",
    is_system: true,
    position: 3,
  }),
];

describe("CategorySheet (arkusz kategorii na telefonie)", () => {
  it("ikona ma etykietę i otwiera arkusz z przełącznikiem przy każdej kategorii", async () => {
    render(
      <CategorySheet
        categories={kategorie}
        onToggle={() => {}}
        onAdd={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    const arkusz = await screen.findByRole("dialog", { name: "Kategorie" });
    expect(arkusz).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Pokaż kategorię Studia" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Pokaż kategorię Dom" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByRole("switch")).toHaveLength(3);
  });

  it("przełącznik woła onToggle z kategorią", async () => {
    const onToggle = vi.fn();
    render(
      <CategorySheet
        categories={kategorie}
        onToggle={onToggle}
        onAdd={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    await userEvent.click(
      await screen.findByRole("switch", { name: "Pokaż kategorię Sport" }),
    );
    expect(onToggle).toHaveBeenCalledWith(kategorie[2]);
  });

  it("stuknięcie w cały wiersz (nazwę) przełącza kategorię; przełącznik nie woła onToggle dwa razy", async () => {
    const onToggle = vi.fn();
    render(
      <CategorySheet
        categories={kategorie}
        onToggle={onToggle}
        onAdd={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    await userEvent.click(await screen.findByText("Dom"));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenLastCalledWith(kategorie[1]);
    await userEvent.click(
      screen.getByRole("switch", { name: "Pokaż kategorię Dom" }),
    );
    expect(onToggle).toHaveBeenCalledTimes(2);
    // Wiersz to m-row (min. 48 px wysokości, pole dotyku ≥ 44 px)
    expect(screen.getByTestId("wiersz-kategorii-c2").className).toContain(
      "m-row",
    );
  });

  it("„Kategoria” zamyka arkusz i woła onAdd", async () => {
    const onAdd = vi.fn();
    render(
      <CategorySheet
        categories={kategorie}
        onToggle={() => {}}
        onAdd={onAdd}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Kategoria" }),
    );
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(
      screen.queryByRole("dialog", { name: "Kategorie" }),
    ).not.toBeInTheDocument();
  });

  it("„Zamknij” zamyka arkusz bez wołania onAdd", async () => {
    const onAdd = vi.fn();
    render(
      <CategorySheet
        categories={kategorie}
        onToggle={() => {}}
        onAdd={onAdd}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Zamknij" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(onAdd).not.toHaveBeenCalled();
  });
});

const zrodlo: RenewalSource = {
  fieldId: "f-ren",
  pageId: "p1",
  config: { show_in_calendar: true },
  name: "Subscriptions",
  shown: true,
};

describe("CategorySheet: źródła odnowień", () => {
  it("arkusz na telefonie ma przełącznik źródła", async () => {
    const onToggleSource = vi.fn();
    render(
      <CategorySheet
        categories={kategorie}
        onToggle={() => {}}
        onAdd={() => {}}
        sources={[zrodlo]}
        onToggleSource={onToggleSource}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    await userEvent.click(
      await screen.findByRole("switch", {
        name: "Pokaż odnowienia Subscriptions",
      }),
    );
    expect(onToggleSource).toHaveBeenCalledWith(zrodlo);
  });
});
