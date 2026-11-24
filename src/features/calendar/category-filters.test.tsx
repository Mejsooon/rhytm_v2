import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CategoryRow, RenewalSource } from "./load-calendar";
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
  kat({
    id: "c3",
    name: "Sport",
    color: "#c2410c",
    is_system: true,
    position: 3,
  }),
];

describe("CategoryFilters (przycisk „Kategorie” na webie)", () => {
  it("przycisk pokazuje widoczne/wszystkie i kropki widocznych kategorii", () => {
    render(
      <CategoryFilters
        categories={kategorie}
        onToggle={() => {}}
        onAdd={() => {}}
      />,
    );
    const przycisk = screen.getByRole("button", {
      name: /^Kategorie, widoczne/,
    });
    // Nazwa dostępna czytelna dla czytnika, licznik widać na przycisku
    expect(przycisk).toHaveAccessibleName("Kategorie, widoczne 2 z 3");
    expect(przycisk).toHaveTextContent("Kategorie2/3");
    // Kropki tylko widocznych (Studia, Sport), najwyżej 4
    expect(screen.getByTestId("kropki-kategorii").children).toHaveLength(2);
    expect(
      (screen.getByTestId("kropki-kategorii").children[0] as HTMLElement)
        .className,
    ).toContain("size-3");
  });

  it("najwyżej 4 kropki przy wielu widocznych kategoriach", () => {
    const duzo = Array.from({ length: 6 }, (_, i) =>
      kat({ id: `k${i}`, name: `K${i}`, position: i }),
    );
    render(
      <CategoryFilters
        categories={duzo}
        onToggle={() => {}}
        onAdd={() => {}}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Kategorie, widoczne 6 z 6" }),
    ).toHaveTextContent("6/6");
    expect(screen.getByTestId("kropki-kategorii").children).toHaveLength(4);
  });

  it("menu ma pole wyboru przy każdej kategorii; klik woła onToggle i menu zostaje otwarte", async () => {
    const onToggle = vi.fn();
    render(
      <CategoryFilters
        categories={kategorie}
        onToggle={onToggle}
        onAdd={() => {}}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^Kategorie, widoczne/ }),
    );
    // Menu jest opisane przyciskiem (aria-labelledby z Radix): „Kategorie 2/3”
    const menu = await screen.findByRole("menu", {
      name: "Kategorie, widoczne 2 z 3",
    });
    expect(menu).toBeInTheDocument();
    expect(
      screen.getByRole("menuitemcheckbox", { name: /Studia/ }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("menuitemcheckbox", { name: /Dom/ }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("menuitemcheckbox", { name: /Sport/ }),
    ).toHaveAttribute("aria-checked", "true");

    await userEvent.click(
      screen.getByRole("menuitemcheckbox", { name: /Dom/ }),
    );
    expect(onToggle).toHaveBeenCalledWith(kategorie[1]);
    expect(
      screen.getByRole("menu", { name: "Kategorie, widoczne 2 z 3" }),
    ).toBeInTheDocument();
  });

  it("Esc zamyka menu, a fokus wraca na przycisk", async () => {
    render(
      <CategoryFilters
        categories={kategorie}
        onToggle={() => {}}
        onAdd={() => {}}
      />,
    );
    const przycisk = screen.getByRole("button", {
      name: /^Kategorie, widoczne/,
    });
    await userEvent.click(przycisk);
    await screen.findByRole("menu", { name: "Kategorie, widoczne 2 z 3" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("menu")).not.toBeInTheDocument(),
    );
    expect(przycisk).toHaveFocus();
  });

  it("„+ Kategoria” zamyka menu i woła onAdd", async () => {
    const onAdd = vi.fn();
    render(
      <CategoryFilters
        categories={kategorie}
        onToggle={() => {}}
        onAdd={onAdd}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^Kategorie, widoczne/ }),
    );
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "+ Kategoria" }),
    );
    await waitFor(() => expect(onAdd).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
  it("wygląd COSS: przycisk .btn z plakietką licznika, menu .pop z etykietą i polami .cbx", async () => {
    render(
      <CategoryFilters
        categories={kategorie}
        onToggle={() => {}}
        onAdd={() => {}}
      />,
    );
    const przycisk = screen.getByRole("button", {
      name: /^Kategorie, widoczne/,
    });
    expect(przycisk.className).toContain("h-8");
    expect(przycisk.className).toContain("shadow-btn");
    expect(screen.getByText("2/3").className).toContain("bg-muted");
    await userEvent.click(przycisk);
    const menu = await screen.findByRole("menu", {
      name: "Kategorie, widoczne 2 z 3",
    });
    expect(menu.className).toContain("rounded-lg");
    expect(menu.className).toContain("shadow-lg");
    expect(menu.className).toContain("w-[230px]");
    // Etykieta .mi-lbl „Pokaż w kalendarzu” nad listą kategorii (CCalendar.dc.html)
    const etykieta = screen.getByText("Pokaż w kalendarzu");
    expect(etykieta).toHaveClass("text-xs", "font-medium", "text-muted-foreground");
    expect(menu.firstElementChild).toBe(etykieta);
    const studia = screen.getByRole("menuitemcheckbox", { name: /Studia/ });
    expect(studia.className).toContain("min-h-8");
    expect(studia.className).toContain("data-[highlighted]:bg-accent");
    // Zaznaczone pole wyboru: czarny kwadrat z ikoną ptaszka
    expect(studia.querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });
});

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
    // Wiersz ma co najmniej 52 px wysokości (pole dotyku)
    expect(screen.getByTestId("wiersz-kategorii-c2").className).toContain(
      "min-h-[52px]",
    );
  });

  it("„+ Kategoria” zamyka arkusz i woła onAdd", async () => {
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
      await screen.findByRole("button", { name: "+ Kategoria" }),
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

describe("CategoryFilters: źródła odnowień", () => {
  it("licznik liczy kategorie i źródła, kropki tylko kategorie", () => {
    render(
      <CategoryFilters
        categories={kategorie}
        onToggle={() => {}}
        onAdd={() => {}}
        sources={[zrodlo]}
      />,
    );
    const przycisk = screen.getByRole("button", {
      name: "Kategorie, widoczne 3 z 4",
    });
    expect(przycisk).toHaveTextContent("3/4");
    expect(screen.getByTestId("kropki-kategorii").children).toHaveLength(2);
  });

  it("pozycja źródła pod kategoriami z przerywanym kwadratem; klik woła onToggleSource", async () => {
    const onToggleSource = vi.fn();
    render(
      <CategoryFilters
        categories={kategorie}
        onToggle={() => {}}
        onAdd={() => {}}
        sources={[zrodlo, { ...zrodlo, fieldId: "f2", name: "Inne", shown: false }]}
        onToggleSource={onToggleSource}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: /^Kategorie, widoczne/ }),
    );
    const pozycje = await screen.findAllByRole("menuitemcheckbox");
    expect(pozycje.map((p) => p.textContent)).toEqual([
      "Studia",
      "Dom",
      "Sport",
      "Subscriptions",
      "Inne",
    ]);
    expect(pozycje[3]).toHaveAttribute("aria-checked", "true");
    expect(pozycje[4]).toHaveAttribute("aria-checked", "false");
    const znaczniki = screen.getAllByTestId("znacznik-zrodla");
    expect(znaczniki[0].style.borderColor).toBe("rgb(64, 64, 64)");
    expect(znaczniki[1].style.borderColor).toBe("rgb(163, 163, 163)");
    expect(znaczniki[0]).toHaveClass("border-dashed", "h-2", "w-2.5");
    await userEvent.click(pozycje[3]);
    expect(onToggleSource).toHaveBeenCalledWith(zrodlo);
  });

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
      await screen.findByRole("switch", { name: "Pokaż odnowienia Subscriptions" }),
    );
    expect(onToggleSource).toHaveBeenCalledWith(zrodlo);
  });
});
