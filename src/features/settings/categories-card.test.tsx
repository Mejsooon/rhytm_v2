import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  moveCategory,
  deleteCategory,
  setCategoryHidden,
  createCategory,
  updateCategory,
} = vi.hoisted(() => ({
  moveCategory: vi.fn(),
  deleteCategory: vi.fn(),
  setCategoryHidden: vi.fn(),
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}));
vi.mock("@/features/categories/actions", () => ({
  moveCategory,
  deleteCategory,
  setCategoryHidden,
  createCategory,
  updateCategory,
}));

import { CategoriesCard } from "./categories-card";

const kategorie = [
  {
    id: "k1",
    name: "Nauka",
    color: "#0070f3",
    position: 1,
    is_system: false,
    hidden: false,
  },
  {
    id: "k2",
    name: "Praca",
    color: "#15803d",
    position: 2,
    is_system: false,
    hidden: false,
  },
  {
    id: "k3",
    name: "Sport",
    color: "#c2410c",
    position: 3,
    is_system: true,
    hidden: false,
  },
];

function wiersz(nazwa: string) {
  return screen.getByRole("listitem", { name: nazwa });
}

describe("CategoriesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    moveCategory.mockResolvedValue({ ok: true });
    deleteCategory.mockResolvedValue({ ok: true });
    setCategoryHidden.mockResolvedValue({ ok: true });
  });

  it("pokazuje tytuł, opis i „+ Kategoria”", () => {
    render(<CategoriesCard categories={kategorie} />);
    expect(screen.getByText("Kategorie kalendarza")).toBeInTheDocument();
    expect(
      screen.getByText("Kolory i kolejność kategorii w kalendarzu."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "+ Kategoria" }),
    ).toBeInTheDocument();
  });

  it("systemowa „Sport” ma plakietkę, bez „Usuń” i bez edycji nazwy, ale z ukrywaniem i ruchem", () => {
    render(<CategoriesCard categories={kategorie} />);
    const sport = within(wiersz("Sport"));
    expect(sport.getByText("systemowa")).toBeInTheDocument();
    expect(sport.queryByRole("button", { name: "Usuń" })).toBeNull();
    expect(sport.queryByRole("button", { name: "Sport" })).toBeNull();
    expect(sport.getByRole("button", { name: "Ukryj" })).toBeInTheDocument();
    expect(sport.getByRole("button", { name: "W górę" })).toBeInTheDocument();
  });

  it("pierwsza nie ma „W górę”, ostatnia nie ma „W dół”", () => {
    render(<CategoriesCard categories={kategorie} />);
    expect(
      within(wiersz("Nauka")).queryByRole("button", { name: "W górę" }),
    ).toBeNull();
    expect(
      within(wiersz("Sport")).queryByRole("button", { name: "W dół" }),
    ).toBeNull();
  });

  it("„W dół” przy pierwszej → moveCategory(dir: 1) i od razu nowa kolejność", async () => {
    render(<CategoriesCard categories={kategorie} />);
    await userEvent.click(
      within(wiersz("Nauka")).getByRole("button", { name: "W dół" }),
    );
    expect(moveCategory).toHaveBeenCalledWith({ id: "k1", dir: 1 });
    const nazwy = screen
      .getAllByRole("listitem")
      .map((li) => li.getAttribute("aria-label"));
    expect(nazwy).toEqual(["Praca", "Nauka", "Sport"]);
  });

  it("błąd przesunięcia cofa kolejność i pokazuje komunikat", async () => {
    moveCategory.mockResolvedValue({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    render(<CategoriesCard categories={kategorie} />);
    await userEvent.click(
      within(wiersz("Nauka")).getByRole("button", { name: "W dół" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
    const nazwy = screen
      .getAllByRole("listitem")
      .map((li) => li.getAttribute("aria-label"));
    expect(nazwy).toEqual(["Nauka", "Praca", "Sport"]);
  });

  it("„Ukryj” → setCategoryHidden i przycisk zmienia się na „Pokaż”", async () => {
    render(<CategoriesCard categories={kategorie} />);
    await userEvent.click(
      within(wiersz("Praca")).getByRole("button", { name: "Ukryj" }),
    );
    expect(setCategoryHidden).toHaveBeenCalledWith({ id: "k2", hidden: true });
    expect(
      within(wiersz("Praca")).getByRole("button", { name: "Pokaż" }),
    ).toBeInTheDocument();
  });

  it("błąd ukrywania cofa przycisk", async () => {
    setCategoryHidden.mockResolvedValue({ ok: false, message: "Błąd." });
    render(<CategoriesCard categories={kategorie} />);
    await userEvent.click(
      within(wiersz("Praca")).getByRole("button", { name: "Ukryj" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Błąd.");
    expect(
      within(wiersz("Praca")).getByRole("button", { name: "Ukryj" }),
    ).toBeInTheDocument();
  });

  it("„Usuń” → potwierdzenie → deleteCategory, wiersz znika dopiero po sukcesie", async () => {
    render(<CategoriesCard categories={kategorie} />);
    await userEvent.click(
      within(wiersz("Praca")).getByRole("button", { name: "Usuń" }),
    );
    expect(screen.getByText("Usunąć kategorię „Praca”?")).toBeInTheDocument();
    expect(
      screen.getByText("Bloki zostaną bez kategorii."),
    ).toBeInTheDocument();
    expect(deleteCategory).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(deleteCategory).toHaveBeenCalledWith({ id: "k2" });
    expect(screen.queryByRole("listitem", { name: "Praca" })).toBeNull();
  });

  it("anulowanie potwierdzenia nie usuwa", async () => {
    render(<CategoriesCard categories={kategorie} />);
    await userEvent.click(
      within(wiersz("Praca")).getByRole("button", { name: "Usuń" }),
    );
    // „Anuluj” bez ramki (ghost, .btng z makiet)
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass("border-transparent", "bg-transparent", "hover:bg-accent");
    expect(screen.getByRole("button", { name: "Anuluj" }).className).not.toContain("border-input");
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(deleteCategory).not.toHaveBeenCalled();
    expect(wiersz("Praca")).toBeInTheDocument();
  });

  it("błąd usuwania zostawia wiersz i pokazuje komunikat w oknie", async () => {
    deleteCategory.mockResolvedValue({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    render(<CategoriesCard categories={kategorie} />);
    await userEvent.click(
      within(wiersz("Praca")).getByRole("button", { name: "Usuń" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać",
    );
    // Okno zostaje otwarte, a wiersz istnieje (tło okna jest dla czytników ukryte)
    expect(
      screen.getByRole("listitem", { name: "Praca", hidden: true }),
    ).toBeInTheDocument();
  });

  it("klik w nazwę otwiera edycję i zapis aktualizuje wiersz", async () => {
    updateCategory.mockResolvedValue({ ok: true });
    render(<CategoriesCard categories={kategorie} />);
    await userEvent.click(
      within(wiersz("Praca")).getByRole("button", { name: "Praca" }),
    );
    expect(screen.getByText("Edytuj kategorię")).toBeInTheDocument();
    const pole = screen.getByLabelText("Nazwa");
    await userEvent.clear(pole);
    await userEvent.type(pole, "Biuro");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(updateCategory).toHaveBeenCalledWith({
      id: "k2",
      name: "Biuro",
      color: "#15803d",
    });
    expect(
      await screen.findByRole("listitem", { name: "Biuro" }),
    ).toBeInTheDocument();
  });

  it("„+ Kategoria” dodaje nową kategorię na końcu", async () => {
    createCategory.mockResolvedValue({ ok: true, id: "k9" });
    render(<CategoriesCard categories={kategorie} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Kategoria" }));
    await userEvent.type(screen.getByLabelText("Nazwa"), "Języki");
    await userEvent.click(
      screen.getByRole("button", { name: "Dodaj kategorię" }),
    );
    const nazwy = (await screen.findAllByRole("listitem")).map((li) =>
      li.getAttribute("aria-label"),
    );
    expect(nazwy).toEqual(["Nauka", "Praca", "Sport", "Języki"]);
  });

  it("nowe dane z serwera zastępują stan lokalny", () => {
    const { rerender } = render(<CategoriesCard categories={kategorie} />);
    rerender(<CategoriesCard categories={kategorie.slice(0, 1)} />);
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("systemowa jako StatusBadge", () => {
    render(<CategoriesCard categories={kategorie} />);
    const odznaka = within(wiersz("Sport")).getByText("systemowa");
    expect(odznaka).toHaveClass("bg-muted", "font-medium", "rounded-sm");
    expect(odznaka.className).not.toContain("font-mono");
  });

  it("akcje wyrównane: strzałki kolejności w stałym miejscu w każdym wierszu", () => {
    render(<CategoriesCard categories={kategorie} />);
    for (const nazwa of ["Nauka", "Praca", "Sport"]) {
      const li = wiersz(nazwa);
      // Slot strzałek ma stałą szerokość, także gdy strzałki brak (pierwsza/ostatnia)
      const slot = li.querySelector('[data-slot="kolejnosc"]');
      expect(slot).not.toBeNull();
      expect(slot).toHaveClass("w-[68px]", "flex-none");
      expect(li.querySelector('[data-slot="ukryj"]')).toHaveClass("w-16");
      expect(li.querySelector('[data-slot="usun"]')).toHaveClass("w-16");
    }
    // Przyciski domyślnego rozmiaru (md), „Usuń” jak w karcie Profil
    expect(
      within(wiersz("Praca")).getByRole("button", { name: "Usuń" }),
    ).toHaveClass("h-8", "text-destructive-foreground", "border-input");
    expect(
      within(wiersz("Praca")).getByRole("button", { name: "Ukryj" }),
    ).toHaveClass("h-8");
  });

  it("długa nazwa kategorii skraca się", () => {
    const dluga = "Bardzo długa nazwa kategorii ".repeat(10).trim();
    render(
      <CategoriesCard
        categories={[{ ...kategorie[0], id: "kd", name: dluga }]}
      />,
    );
    const nazwa = within(wiersz(dluga)).getByRole("button", { name: dluga });
    expect(nazwa).toHaveClass("truncate");
    expect(nazwa.parentElement).toHaveClass("min-w-0", "flex-1");
  });
});
