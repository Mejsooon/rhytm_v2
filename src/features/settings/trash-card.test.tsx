import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { restorePage, restoreRow, toastError } = vi.hoisted(() => ({
  restorePage: vi.fn(),
  restoreRow: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/features/pages/actions", () => ({ restorePage, restoreRow }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { TrashCard } from "./trash-card";

const strony = [
  { id: "p1", title: "Books", deletedAt: "2026-11-09T10:00:00Z" },
  { id: "p2", title: "", deletedAt: "2026-10-20T10:00:00Z" },
];
const wiersze = [
  {
    id: "w1",
    title: "Diuna",
    pageTitle: "Books",
    deletedAt: "2026-11-18T10:00:00Z",
  },
];

describe("TrashCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-19T12:00:00Z"));
    restorePage.mockResolvedValue({ ok: true });
    restoreRow.mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.useRealTimers());

  it("pokazuje sekcje Strony i Wiersze z datą usunięcia i liczbą dni do końca", () => {
    render(<TrashCard pages={strony} rows={wiersze} />);
    expect(document.getElementById("kosz")).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Kosz" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Strony" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Wiersze" }),
    ).toBeInTheDocument();
    // 10 dni temu → 20 dni, 30 dni temu → 0 dni (nie ujemne), wczoraj → 29 dni
    expect(
      within(screen.getByRole("listitem", { name: "Books" })).getByText(
        "usunięto 09.11.2026 · zostało 20 dni",
      ),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole("listitem", { name: "Bez tytułu" })).getByText(
        "usunięto 20.10.2026 · zostało 0 dni",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Books · usunięto 18.11.2026 · zostało 29 dni"),
    ).toBeInTheDocument();
  });

  it("„Przywróć” woła akcję i od razu usuwa pozycję z listy", async () => {
    const user = userEvent.setup();
    render(<TrashCard pages={strony} rows={wiersze} />);
    await user.click(
      within(screen.getByRole("listitem", { name: "Books" })).getByRole(
        "button",
        { name: "Przywróć" },
      ),
    );
    expect(restorePage).toHaveBeenCalledWith("p1");
    expect(screen.queryByRole("listitem", { name: "Books" })).toBeNull();

    await user.click(
      within(screen.getByRole("listitem", { name: "Diuna" })).getByRole(
        "button",
        { name: "Przywróć" },
      ),
    );
    expect(restoreRow).toHaveBeenCalledWith("w1");
    expect(screen.queryByRole("listitem", { name: "Diuna" })).toBeNull();
  });

  it("przy błędzie pozycja wraca na miejsce i pojawia się toast", async () => {
    restorePage.mockResolvedValue({ ok: false, message: "x" });
    const user = userEvent.setup();
    render(<TrashCard pages={strony} rows={[]} />);
    await user.click(
      within(screen.getByRole("listitem", { name: "Books" })).getByRole(
        "button",
        { name: "Przywróć" },
      ),
    );
    expect(
      await screen.findByRole("listitem", { name: "Books" }),
    ).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
    const nazwy = screen
      .getAllByRole("listitem")
      .map((li) => li.getAttribute("aria-label"));
    expect(nazwy).toEqual(["Books", "Bez tytułu"]);
  });

  it("pusty kosz: „Kosz jest pusty.”", () => {
    render(<TrashCard pages={[]} rows={[]} />);
    expect(screen.getByText("Kosz jest pusty.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Strony" })).toBeNull();
  });

  it("błąd odczytu: „Nie udało się wczytać kosza.” zamiast pustego kosza", () => {
    render(<TrashCard pages={[]} rows={[]} loadError />);
    expect(screen.getByRole("alert")).toHaveTextContent("Nie udało się wczytać kosza.");
    expect(screen.queryByText("Kosz jest pusty.")).toBeNull();
  });

  it("po przywróceniu ostatniej pozycji pokazuje „Kosz jest pusty.”", async () => {
    const user = userEvent.setup();
    render(<TrashCard pages={[]} rows={wiersze} />);
    await user.click(screen.getByRole("button", { name: "Przywróć" }));
    expect(screen.getByText("Kosz jest pusty.")).toBeInTheDocument();
  });

  it("nagłówki sekcji i daty bez font-mono", () => {
    const { container } = render(<TrashCard pages={strony} rows={wiersze} />);
    const strony_h = screen.getByRole("heading", { name: "Strony" });
    expect(strony_h).toHaveClass("text-xs", "font-medium", "text-muted-foreground");
    expect(strony_h.className).not.toMatch(/uppercase|font-mono|tracking/);
    const data = within(screen.getByRole("listitem", { name: "Books" })).getByText(
      "usunięto 09.11.2026 · zostało 20 dni",
    );
    expect(data).toHaveClass("text-xs", "text-muted-foreground", "tabular-nums");
    expect(container.innerHTML).not.toContain("font-mono");
  });

  it("długi tytuł skraca się (truncate), przycisk Przywróć zostaje w wierszu", () => {
    const dlugi = "Bardzo długi tytuł strony ".repeat(12).trim();
    render(
      <TrashCard
        pages={[{ id: "p9", title: dlugi, deletedAt: "2026-11-09T10:00:00Z" }]}
        rows={[]}
      />,
    );
    const li = screen.getByRole("listitem", { name: dlugi });
    const tytul = within(li).getByText(dlugi);
    expect(tytul).toHaveClass("truncate");
    expect(tytul.parentElement).toHaveClass("min-w-0", "flex-1");
    const przycisk = within(li).getByRole("button", { name: "Przywróć" });
    expect(przycisk).toHaveClass("flex-none", "whitespace-nowrap");
    expect(li).not.toHaveClass("flex-wrap");
  });
});
