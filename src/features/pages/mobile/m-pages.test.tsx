import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { status } = vi.hoisted(() => ({ status: { value: "zablokowany" } }));
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => ({ status: status.value }) }));

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
    status.value = "zablokowany";
  });

  it("„Hasła” to pozycja na górze listy, przed „Ulubione”, prowadzi do /hasla", () => {
    render(<MPages pages={STRONY} />);
    const hasla = screen.getByRole("link", { name: /Hasła/ });
    expect(hasla).toHaveAttribute("href", "/hasla");
    const ulubione = screen.getByText("Ulubione");
    expect(hasla.compareDocumentPosition(ulubione) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Nie wchodzi do żadnej z sekcji stron
    expect(within(screen.getByText("Wszystkie strony").closest("section")!).queryByText("Hasła")).toBeNull();
  });

  it("wyszukiwarka chowa „Hasła”, gdy fraza nie pasuje, i pokazuje je dla „has”", async () => {
    const user = userEvent.setup();
    render(<MPages pages={STRONY} />);
    await user.type(screen.getByRole("searchbox", { name: "Szukaj stron" }), "proj");
    expect(screen.queryByRole("link", { name: /Hasła/ })).toBeNull();
    await user.clear(screen.getByRole("searchbox", { name: "Szukaj stron" }));
    await user.type(screen.getByRole("searchbox", { name: "Szukaj stron" }), "has");
    expect(screen.getByRole("link", { name: /Hasła/ })).toBeInTheDocument();
    expect(screen.queryByText("Nic nie znaleziono.")).toBeNull();
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

  it("kafelek 40 px pokazuje ikonę strony 18 px: emoji, ikonę Lucide albo domyślną tabelę", () => {
    render(
      <MPages
        pages={[
          strona("a", "Alfa", { icon: "lucide:book-open" }),
          strona("b", "Beta", { icon: "lucide:globe" }),
          strona("c", "Gamma", { icon: "📚" }),
        ]}
      />,
    );
    const ikona = (nazwa: RegExp) => screen.getByRole("link", { name: nazwa }).querySelector("[data-page-icon]")!;
    expect(ikona(/Alfa/).getAttribute("data-page-icon")).toBe("book-open");
    expect(ikona(/Beta/).getAttribute("data-page-icon")).toBe("globe");
    expect(ikona(/Gamma/).getAttribute("data-page-icon")).toBe("table");
    expect(ikona(/Alfa/)).toHaveStyle({ width: "18px", height: "18px" });
    expect(ikona(/Alfa/).parentElement!.className).toContain("size-10");
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

  it("„Nowa strona” (nagłówek i przycisk przerywany) prowadzi do wyboru szablonu /strony/nowa", () => {
    render(<MPages pages={STRONY} />);
    const linki = screen.getAllByRole("link", { name: "Nowa strona" });
    expect(linki).toHaveLength(2);
    for (const l of linki) expect(l).toHaveAttribute("href", "/strony/nowa");
    expect(linki[0]).toHaveClass("max-[799px]:w-11", "max-[799px]:h-11");
    expect(linki[1]).toHaveClass("h-14", "border-dashed");
  });

  it("„Hasła” pokazują stan sejfu: zablokowany / odblokowany", () => {
    const { rerender } = render(<MPages pages={STRONY} />);
    expect(within(screen.getByRole("link", { name: /Hasła/ })).getByText("sejf · zablokowany")).toBeInTheDocument();
    status.value = "odblokowany";
    rerender(<MPages pages={STRONY} />);
    expect(within(screen.getByRole("link", { name: /Hasła/ })).getByText("sejf · odblokowany")).toBeInTheDocument();
  });

  it("szukajka ma 44 px i pole 16 px; ikona Subscriptions jest zielona", () => {
    render(<MPages pages={[strona("s", "Subscriptions", { templateKey: "subscriptions", rowCount: 7 })]} />);
    const pole = screen.getByRole("searchbox", { name: "Szukaj stron" });
    expect(pole).toHaveAttribute("placeholder", "Szukaj stron i wierszy");
    expect(pole).toHaveClass("text-base");
    expect(pole.closest("label")).toHaveClass("h-11");
    const kafelek = screen.getByRole("link", { name: /Subscriptions/ }).querySelector("[data-page-icon]")!.parentElement!;
    expect(kafelek).toHaveClass("text-success");
  });

  it("⚙ prowadzi do /ustawienia", () => {
    render(<MPages pages={STRONY} />);
    expect(screen.getByRole("link", { name: "Ustawienia" })).toHaveAttribute("href", "/ustawienia");
  });
});
