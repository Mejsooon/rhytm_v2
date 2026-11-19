import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, createBlankPage, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  createBlankPage: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast }));
vi.mock("../actions", () => ({ createBlankPage }));

import type { PageSummary } from "../load-pages";
import { MPages } from "./m-pages";

function strona(id: string, title: string, reszta: Partial<PageSummary> = {}): PageSummary {
  return { id, title, icon: "▦", favorite: false, templateKey: "books", position: 0, rowCount: 0, ...reszta };
}

const STRONY = [
  strona("b", "Books", { favorite: true, rowCount: 11 }),
  strona("p", "Projects", { rowCount: 8 }),
  strona("w", "Websites", { rowCount: 1 }),
  strona("t", "Tasks", { rowCount: 3 }),
  strona("x", "", { templateKey: null, rowCount: 0 }),
];

describe("MPages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createBlankPage.mockResolvedValue({ ok: true, id: "nowa" });
  });

  it("„Ulubione” zawiera tylko ulubione, „Wszystkie strony” — pozostałe", () => {
    render(<MPages pages={STRONY} />);
    const ulubione = screen.getByText("Ulubione").closest("section")!;
    const wszystkie = screen.getByText("Wszystkie strony").closest("section")!;
    expect(within(ulubione).getAllByRole("link")).toHaveLength(1);
    expect(within(ulubione).getByRole("link", { name: /Books/ })).toHaveAttribute("href", "/strony/b");
    expect(within(wszystkie).queryByText("Books")).toBeNull();
    expect(within(wszystkie).getAllByRole("link")).toHaveLength(4);
  });

  it("bez ulubionych nie ma sekcji „Ulubione”", () => {
    render(<MPages pages={[strona("p", "Projects", { rowCount: 2 })]} />);
    expect(screen.queryByText("Ulubione")).toBeNull();
    expect(screen.getByText("Wszystkie strony")).toBeInTheDocument();
  });

  it("dopisek: „N wierszy” z odmianą albo „pusta strona”; pusty tytuł to „Bez tytułu”", () => {
    render(<MPages pages={STRONY} />);
    expect(screen.getByText("11 wierszy")).toBeInTheDocument();
    expect(screen.getByText("8 wierszy")).toBeInTheDocument();
    expect(screen.getByText("1 wiersz")).toBeInTheDocument();
    expect(screen.getByText("3 wiersze")).toBeInTheDocument();
    const pusta = screen.getByRole("link", { name: /Bez tytułu/ });
    expect(within(pusta).getByText("pusta strona")).toBeInTheDocument();
  });

  it("wyszukiwarka filtruje po tytule", async () => {
    const user = userEvent.setup();
    render(<MPages pages={STRONY} />);
    await user.type(screen.getByRole("searchbox", { name: "Szukaj stron" }), "proj");
    expect(screen.getByRole("link", { name: /Projects/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Books/ })).toBeNull();
    expect(screen.queryByText("Ulubione")).toBeNull();
    await user.clear(screen.getByRole("searchbox", { name: "Szukaj stron" }));
    await user.type(screen.getByRole("searchbox", { name: "Szukaj stron" }), "zzz");
    expect(screen.getByText("Nic nie znaleziono.")).toBeInTheDocument();
  });

  it("„Nowa strona” (nagłówek i kafel) tworzy stronę i przechodzi do niej", async () => {
    const user = userEvent.setup();
    render(<MPages pages={STRONY} />);
    const przyciski = screen.getAllByRole("button", { name: "Nowa strona" });
    expect(przyciski).toHaveLength(2);
    await user.click(przyciski[1]);
    await waitFor(() => expect(push).toHaveBeenCalledWith("/strony/nowa"));
    expect(createBlankPage).toHaveBeenCalledTimes(1);
  });

  it("błąd tworzenia pokazuje toast", async () => {
    createBlankPage.mockResolvedValue({ ok: false, message: "x" });
    const user = userEvent.setup();
    render(<MPages pages={STRONY} />);
    await user.click(screen.getAllByRole("button", { name: "Nowa strona" })[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalled();
  });

  it("⚙ prowadzi do /ustawienia", () => {
    render(<MPages pages={STRONY} />);
    expect(screen.getByRole("link", { name: "Ustawienia" })).toHaveAttribute("href", "/ustawienia");
  });
});
