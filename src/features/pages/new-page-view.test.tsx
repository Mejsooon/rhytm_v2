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

  it("pokazuje 5 szablonów (Pusta strona, Books, Projects, Websites, Passwords z odznaką „szyfr.”)", () => {
    render(<NewPageView />);
    const karty = screen.getAllByRole("button", { pressed: false }).concat(
      screen.getAllByRole("button", { pressed: true }),
    );
    const nazwy = ["Pusta strona", "Books", "Projects", "Websites", "Passwords"];
    for (const n of nazwy) {
      expect(karty.some((k) => k.textContent?.includes(n))).toBe(true);
    }
    expect(screen.queryByText("Subscriptions")).toBeNull();
    const passwords = karty.find((k) => k.textContent?.includes("Passwords"));
    expect(passwords?.textContent).toContain("szyfr.");
    expect(passwords?.textContent).toContain("Hasła szyfrowane w przeglądarce hasłem głównym.");
    // Odznaka tylko przy Passwords
    expect(screen.getAllByText("szyfr.")).toHaveLength(1);
    expect(screen.getByText("Zacznij od zera")).toBeInTheDocument();
    expect(screen.getByText("Twoje książki")).toBeInTheDocument();
  });

  it("pokazuje podtytuł powiązany z oknem jako opis", () => {
    render(<NewPageView />);
    const podtytul = screen.getByText("Szablon wstawia zwykłą stronę z gotową tabelą i kartami. Wszystko zmienisz później.");
    expect(podtytul).toBeVisible();
    expect(screen.getByRole("dialog", { name: "Nowa strona" })).toHaveAccessibleDescription(
      "Szablon wstawia zwykłą stronę z gotową tabelą i kartami. Wszystko zmienisz później.",
    );
  });

  it("wyszukiwanie bez dopasowania pokazuje komunikat z frazą", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    expect(screen.queryByText(/Brak szablonu/)).toBeNull();
    await user.type(screen.getByRole("textbox", { name: "Szukaj szablonu" }), "xyz");
    expect(screen.getByText("Brak szablonu „xyz”.")).toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Szukaj szablonu" }));
    expect(screen.queryByText(/Brak szablonu/)).toBeNull();
  });

  it("wybór szablonu zmienia panel „Pola, które powstaną”", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    // Domyślnie Pusta strona
    expect(screen.getByText("Tylko kolumna „Nazwa”. Kolejne dodasz przyciskiem „+” w nagłówku tabeli.")).toBeInTheDocument();

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
    expect(screen.getByText("Liczba przeczytanych w tym roku.")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nazwa strony" })).toHaveValue("Books");

    await user.click(screen.getByRole("button", { name: /Projects/ }));
    expect(screen.getByText("Data · w kalendarzu")).toBeInTheDocument();
    expect(screen.getByText("Terminy trafią do kalendarza głównego.")).toBeInTheDocument();
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
    // „Anuluj” bez ramki (ghost, .btng z makiet)
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass("border-transparent", "bg-transparent", "hover:bg-accent");
    expect(screen.getByRole("button", { name: "Anuluj" }).className).not.toContain("border-input");
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    await user.keyboard("{Escape}");
    expect(back).toHaveBeenCalledTimes(3);
  });

  it("karta szablonu ma fokus z shadow-focus i hover", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    const karta = screen.getByRole("button", { name: /Books/ });
    expect(karta).toHaveClass("rounded-xl", "shadow-xs", "hover:bg-panel", "focus-visible:shadow-focus", "outline-none");
    // Zaznaczona: obwódka primary + cień zaznaczenia w style, fokus jako obrys
    await user.click(karta);
    expect(karta).toHaveClass("border-primary", "focus-visible:outline-solid", "outline-ring");
    expect(karta.style.boxShadow).toContain("rgba(38, 38, 38, 0.12)");
    expect(karta).not.toHaveClass("focus-visible:shadow-focus");
  });

  it("okno jak .dlg: tło z rozmyciem, promień, cień pop, szara stopka", () => {
    render(<NewPageView />);
    const okno = screen.getByRole("dialog");
    expect(okno.parentElement).toHaveClass("backdrop-blur-[4px]");
    expect(okno).toHaveClass("rounded-xl", "border-border", "shadow-pop");
    expect(screen.getByRole("button", { name: "Utwórz stronę" }).parentElement).toHaveClass(
      "border-t",
      "bg-black/[.025]",
    );
  });

  it("pola i odznaki typów z tokenów (StatusBadge), pole nazwy jak FIELD", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    await user.click(screen.getByRole("button", { name: /Projects/ }));
    expect(screen.getByText("Data · w kalendarzu")).toHaveClass("bg-success-soft", "text-success");
    expect(screen.getByText("Tekst", { selector: "span" })).toHaveClass("bg-white", "text-foreground");
    expect(screen.getByRole("textbox", { name: "Nazwa strony" })).toHaveClass("h-8", "rounded-md", "shadow-xs");
    expect(screen.getByRole("textbox", { name: "Szukaj szablonu" }).parentElement).toHaveClass("h-8", "shadow-xs");
  });
});
