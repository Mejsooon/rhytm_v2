import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, back, createPageFromTemplate, toast } = vi.hoisted(() => ({
  push: vi.fn(),
  back: vi.fn(),
  createPageFromTemplate: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, back }) }));
vi.mock("sonner", () => ({ toast }));
vi.mock("./actions", () => ({ createPageFromTemplate }));

import { NewPageView } from "./new-page-view";

describe("NewPageView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPageFromTemplate.mockResolvedValue({ ok: true, id: "nowa" });
  });

  it("pokazuje 4 szablony (Pusta strona, Books, Projects, Websites)", () => {
    render(<NewPageView />);
    const karty = screen.getAllByRole("button", { pressed: false }).concat(
      screen.getAllByRole("button", { pressed: true }),
    );
    const nazwy = ["Pusta strona", "Books", "Projects", "Websites"];
    for (const n of nazwy) {
      expect(karty.some((k) => k.textContent?.includes(n))).toBe(true);
    }
    expect(screen.queryByText("Subscriptions")).toBeNull();
    expect(screen.queryByText("Passwords")).toBeNull();
    expect(screen.getByText("Tabela bez pól. Budujesz ją sama od zera.")).toBeInTheDocument();
  });

  it("wybór szablonu zmienia panel „Pola, które powstaną”", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    // Domyślnie Pusta strona
    expect(screen.getByText("Tylko kolumna „Nazwa”. Pola dodajesz przyciskiem „+ Pole”.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Books/ }));
    const lista = screen.getByText("Pola, które powstaną").parentElement!;
    const wiersze = Array.from(lista.querySelectorAll("div.justify-between")).map((w) => w.textContent);
    expect(wiersze).toEqual([
      "TytułTekst",
      "AutorTekst",
      "StatusStatus",
      "OcenaOcena",
      "PrzeczytanaData",
    ]);
    expect(screen.getByText("Σ Liczba przeczytanych w tym roku.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nazwa strony" })).toHaveValue("Books");

    await user.click(screen.getByRole("button", { name: /Projects/ }));
    expect(screen.getByText("Data · w kalendarzu")).toBeInTheDocument();
    expect(screen.getByText("↻ Terminy trafią do kalendarza głównego.")).toBeInTheDocument();
  });

  it("wyszukiwarka filtruje szablony", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    await user.type(screen.getByRole("textbox", { name: "Szukaj szablonu" }), "web");
    expect(screen.getByRole("button", { name: /Websites/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Books/ })).toBeNull();
  });

  it("„Utwórz stronę” woła createPageFromTemplate(key, nazwa) i przechodzi do strony", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    await user.click(screen.getByRole("button", { name: /Books/ }));
    const nazwa = screen.getByRole("textbox", { name: "Nazwa strony" });
    await user.clear(nazwa);
    await user.type(nazwa, "Lektury");
    await user.click(screen.getByRole("button", { name: "Utwórz stronę" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/strony/nowa"));
    expect(createPageFromTemplate).toHaveBeenCalledWith("books", "Lektury");
  });

  it("błąd tworzenia pokazuje toast i zostaje na miejscu", async () => {
    createPageFromTemplate.mockResolvedValue({ ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." });
    const user = userEvent.setup();
    render(<NewPageView />);
    await user.click(screen.getByRole("button", { name: "Utwórz stronę" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."));
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Utwórz stronę" })).toBeEnabled();
  });

  it("„Anuluj”, „Zamknij” i Esc wracają (router.back)", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    await user.keyboard("{Escape}");
    expect(back).toHaveBeenCalledTimes(3);
  });
});
