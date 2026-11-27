import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { restorePage, restoreRow, deletePageForever, deleteRowForever, toastError } = vi.hoisted(() => ({
  restorePage: vi.fn(),
  restoreRow: vi.fn(),
  deletePageForever: vi.fn(),
  deleteRowForever: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/features/pages/actions", () => ({ restorePage, restoreRow, deletePageForever, deleteRowForever }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));

import { TrashList } from "./trash-list";

const strony = [{ id: "p1", title: "Books", deletedAt: "2026-11-09T10:00:00Z" }];
const wiersze = [{ id: "w1", title: "Diuna", pageTitle: "Books", deletedAt: "2026-11-18T10:00:00Z" }];
const wiersz = (nazwa: string) => within(screen.getByRole("listitem", { name: nazwa }));

describe("TrashList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-19T12:00:00Z"));
    for (const f of [restorePage, restoreRow, deletePageForever, deleteRowForever]) f.mockResolvedValue({ ok: true });
  });
  afterEach(() => vi.useRealTimers());

  it("opisuje rodzaj, datę i dni do końca; najnowsze na górze", () => {
    render(<TrashList pages={strony} rows={wiersze} />);
    expect(screen.getAllByRole("listitem").map((li) => li.getAttribute("aria-label"))).toEqual(["Diuna", "Books"]);
    expect(screen.getByText("strona · usunięta 09.11 · zostało 20 dni")).toBeInTheDocument();
    expect(screen.getByText("wiersz w Books · usunięty 18.11 · zostało 29 dni")).toBeInTheDocument();
  });

  it("„Przywróć”: strona wraca na koniec listy, wiersz zwyczajnie", async () => {
    const user = userEvent.setup();
    render(<TrashList pages={strony} rows={wiersze} />);
    await user.click(wiersz("Books").getByRole("button", { name: "Przywróć" }));
    expect(restorePage).toHaveBeenCalledWith("p1", true);
    await user.click(wiersz("Diuna").getByRole("button", { name: "Przywróć" }));
    expect(restoreRow).toHaveBeenCalledWith("w1");
    expect(screen.getByText("Kosz jest pusty.")).toBeInTheDocument();
  });

  it("„Usuń na zawsze” usuwa dopiero po potwierdzeniu", async () => {
    const user = userEvent.setup();
    render(<TrashList pages={strony} rows={[]} />);
    await user.click(wiersz("Books").getByRole("button", { name: "Usuń na zawsze" }));
    expect(deletePageForever).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Usuń na zawsze" }));
    expect(deletePageForever).toHaveBeenCalledWith("p1");
    expect(screen.queryByRole("listitem", { name: "Books" })).toBeNull();
  });

  it("przy błędzie pozycja wraca i pojawia się toast", async () => {
    restorePage.mockResolvedValue({ ok: false });
    const user = userEvent.setup();
    render(<TrashList pages={strony} rows={[]} />);
    await user.click(wiersz("Books").getByRole("button", { name: "Przywróć" }));
    expect(await screen.findByRole("listitem", { name: "Books" })).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie.");
  });

  it("błąd odczytu zamiast pustego kosza", () => {
    render(<TrashList pages={[]} rows={[]} loadError />);
    expect(screen.getByRole("alert")).toHaveTextContent("Nie udało się wczytać kosza.");
    expect(screen.queryByText("Kosz jest pusty.")).toBeNull();
  });
});
