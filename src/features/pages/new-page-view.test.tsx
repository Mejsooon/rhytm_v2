import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

  it("S2NewPage: lista szablonów (radio) w kolejności makiety, z krótkim podpisem; Pusta strona na całą szerokość", () => {
    render(<NewPageView />);
    const lista = screen.getByRole("radiogroup", { name: "Szablon" });
    const karty = within(lista).getAllByRole("radio");
    expect(karty.map((k) => k.textContent)).toEqual([
      "Pusta stronaZacznij od zera",
      "SubskrypcjeTwoje subskrypcje",
      "KsiążkiTwoje książki",
      "ProjektyTwoje projekty",
      "Strony WWWTwoje strony WWW",
    ]);
    expect(karty[0]).toHaveAttribute("aria-checked", "true");
    expect(karty[0]).toHaveClass("col-span-full");
    // Hasła to moduł, nie szablon
    expect(screen.queryByText("Passwords")).toBeNull();
    expect(screen.queryByText("szyfr.")).toBeNull();
  });

  it("podtytuł z makiety powiązany z oknem jako opis", () => {
    render(<NewPageView />);
    expect(screen.getByRole("dialog", { name: "Nowa strona" })).toHaveAccessibleDescription(
      "Szablon tworzy stronę z gotową tabelą. Pola, widoki i karty zmienisz później.",
    );
  });

  it("Pusta strona: pole „Nazwa strony” puste z „Bez tytułu”, panel z opisem pustej strony", () => {
    render(<NewPageView />);
    const nazwa = screen.getByRole("textbox", { name: "Nazwa strony" });
    expect(nazwa).toHaveValue("");
    expect(nazwa).toHaveAttribute("placeholder", "Bez tytułu");
    const panel = screen.getByRole("complementary", { name: "Co powstanie" });
    expect(within(panel).getByText("Bez tytułu")).toBeInTheDocument();
    expect(
      within(panel).getByText("Pusta strona bez tabeli. Tabelę, listę albo nagłówek wstawisz, wpisując „/”."),
    ).toBeInTheDocument();
    expect(within(panel).queryByText(/^Pola ·/)).toBeNull();
  });

  it("Książki: „Pola · 5” z ikonami typów, „Widoki” z „Wszystkie”, „Grupowanie: Status” i „Dodatkowo”", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    await user.click(screen.getByRole("radio", { name: /Książki/ }));
    expect(screen.getByRole("radio", { name: /Książki/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("textbox", { name: "Nazwa strony" })).toHaveValue("Książki");
    const panel = screen.getByRole("complementary", { name: "Co powstanie" });
    expect(within(panel).getByText("Pola · 5")).toBeInTheDocument();
    const pola = within(panel).getAllByTestId("pole-szablonu").map((w) => w.textContent);
    expect(pola).toEqual(["AaTytułTekst", "AaAutorTekst", "◉StatusWybór", "★OcenaOcena", "31PrzeczytanaData"]);
    const widoki = within(panel).getAllByTestId("widok-szablonu").map((w) => w.textContent);
    expect(widoki).toEqual(["Wszystkie", "Czytam", "Do przeczytania", `Przeczytane w ${new Date().getFullYear()}`]);
    expect(within(panel).getByText("Grupowanie: Status")).toBeInTheDocument();
    expect(within(panel).getByText("Dodatkowo")).toBeInTheDocument();
    expect(within(panel).getByText("Średnia ocena w stopce tabeli.")).toBeInTheDocument();
  });

  it("Subskrypcje: typy inteligentne i trzy linie „Dodatkowo”; Strony WWW bez „Dodatkowo”", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    await user.click(screen.getByRole("radio", { name: /Subskrypcje/ }));
    const panel = screen.getByRole("complementary", { name: "Co powstanie" });
    expect(within(panel).getAllByTestId("pole-szablonu").map((w) => w.textContent)).toEqual([
      "AaNazwaTekst",
      "złKwota cyklicznaKwota cykliczna",
      "31Data odnowieniaData odnowienia",
      "◉KategoriaWybór",
      "✓AktywnaCheckbox",
    ]);
    expect(within(panel).getByText("Grupowanie: Kategoria")).toBeInTheDocument();
    expect(within(panel).getByText("Suma miesięczna w stopce tabeli.")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Strony WWW/ }));
    expect(within(screen.getByRole("complementary", { name: "Co powstanie" })).queryByText("Dodatkowo")).toBeNull();
    expect(screen.getByText("↗", { selector: "span" })).toBeInTheDocument();
  });

  it("nazwa wpisana przez użytkownika trafia do nagłówka panelu; zmiana szablonu przywraca jego nazwę", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    await user.click(screen.getByRole("radio", { name: /Projekty/ }));
    const nazwa = screen.getByRole("textbox", { name: "Nazwa strony" });
    await user.clear(nazwa);
    await user.type(nazwa, "Studia");
    expect(within(screen.getByRole("complementary", { name: "Co powstanie" })).getByText("Studia")).toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: /Książki/ }));
    expect(nazwa).toHaveValue("Książki");
  });

  it("wyszukiwanie filtruje szablony; brak wyniku pokazuje „Pokaż wszystkie”, które czyści frazę", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    const szukaj = screen.getByRole("textbox", { name: "Szukaj szablonu" });
    await user.type(szukaj, "www");
    expect(screen.getByRole("radio", { name: /Strony WWW/ })).toBeInTheDocument();
    expect(screen.queryByRole("radio", { name: /Książki/ })).toBeNull();
    await user.clear(szukaj);
    await user.type(szukaj, "xyz");
    expect(screen.getByText(/Brak szablonu „xyz”\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Pokaż wszystkie" }));
    expect(szukaj).toHaveValue("");
    expect(screen.getAllByRole("radio")).toHaveLength(5);
  });

  it("„Utwórz stronę” woła createPageFromTemplate(key, nazwa) i przechodzi do strony", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    await user.click(screen.getByRole("radio", { name: /Książki/ }));
    const nazwa = screen.getByRole("textbox", { name: "Nazwa strony" });
    await user.clear(nazwa);
    await user.type(nazwa, "Lektury");
    await user.click(screen.getByRole("button", { name: "Utwórz stronę" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/strony/nowa"));
    expect(createPageFromTemplate).toHaveBeenCalledWith("books", "Lektury");
  });

  it("Pusta strona bez nazwy: createPageFromTemplate('empty', '')", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    await user.click(screen.getByRole("button", { name: "Utwórz stronę" }));
    await waitFor(() => expect(createPageFromTemplate).toHaveBeenCalledWith("empty", ""));
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
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    await user.keyboard("{Escape}");
    expect(back).toHaveBeenCalledTimes(3);
  });

  it("karta szablonu .tpl: zaznaczona ma ramkę i obwódkę primary, fokus shadow-focus", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    const karta = screen.getByRole("radio", { name: /Książki/ });
    expect(karta).toHaveClass("rounded-xl", "shadow-xs", "hover:bg-panel", "focus-visible:shadow-focus", "min-h-14");
    await user.click(karta);
    expect(karta).toHaveClass("border-primary", "shadow-[0_0_0_1px_var(--primary)]");
  });

  it("okno jak .dlg 880 px: tło z rozmyciem, promień, cień pop, szara stopka", () => {
    render(<NewPageView />);
    const okno = screen.getByRole("dialog");
    expect(okno.parentElement).toHaveClass("backdrop-blur-[4px]");
    expect(okno).toHaveClass("w-[min(880px,calc(100%-32px))]", "rounded-xl", "border-border", "shadow-pop");
    expect(screen.getByRole("button", { name: "Utwórz stronę" }).parentElement).toHaveClass("border-t", "bg-black/[.025]");
  });
});

describe("NewPageView: telefon (CMNewPage)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createPageFromTemplate.mockResolvedValue({ ok: true, id: "nowa" });
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
  });
  afterEach(() => {
    delete (window as { matchMedia?: unknown }).matchMedia;
  });

  it("arkusz „Nowa strona” z paskiem „Anuluj · Nowa strona · Utwórz”, bez okna weba", () => {
    render(<NewPageView />);
    const arkusz = screen.getByRole("dialog", { name: "Nowa strona" });
    expect(arkusz.className).toContain("h-[88%]");
    expect(within(arkusz).getByRole("heading", { name: "Nowa strona" })).toBeInTheDocument();
    expect(within(arkusz).getByRole("button", { name: "Anuluj" })).toBeInTheDocument();
    expect(within(arkusz).getByRole("button", { name: "Utwórz" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Utwórz stronę" })).toBeNull();
    expect(screen.queryByRole("textbox", { name: "Szukaj szablonu" })).toBeNull();
    expect(within(arkusz).getByText("Szablon wstawia zwykłą stronę z gotową tabelą i kartami. Wszystko zmienisz później.")).toBeInTheDocument();
  });

  it("lista szablonów z opisami i aria-pressed; wybór podpowiada nazwę i pola", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    const lista = screen.getByRole("group", { name: "Szablon" });
    expect(within(lista).getByRole("button", { name: /Pusta strona/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(lista).getByText("Zacznij od zera")).toBeInTheDocument();
    expect(screen.getByText("bez pól")).toBeInTheDocument();
    await user.click(within(lista).getByRole("button", { name: /Książki/ }));
    expect(within(lista).getByRole("button", { name: /Książki/ })).toHaveAttribute("aria-pressed", "true");
    expect(within(lista).getByRole("button", { name: /Książki/ }).className).toContain("bg-black/[.03]");
    expect(screen.getByRole("textbox", { name: "Nazwa strony" })).toHaveValue("Książki");
    expect(screen.getByRole("textbox", { name: "Nazwa strony" })).toHaveClass("h-11", "text-base");
    for (const pole of ["Tytuł", "Autor", "Status", "Ocena", "Przeczytana"]) {
      expect(screen.getByText(pole)).toBeInTheDocument();
    }
    expect(screen.getByText("Średnia ocena w stopce tabeli.")).toBeInTheDocument();
    expect(screen.queryByText("bez pól")).toBeNull();
  });

  it("„Utwórz” woła createPageFromTemplate(key, nazwa) i przechodzi do strony; „Anuluj” wraca", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    await user.click(screen.getByRole("button", { name: /Książki/ }));
    const nazwa = screen.getByRole("textbox", { name: "Nazwa strony" });
    await user.clear(nazwa);
    await user.type(nazwa, "Lektury");
    await user.click(screen.getByRole("button", { name: "Utwórz" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/strony/nowa"));
    expect(createPageFromTemplate).toHaveBeenCalledWith("books", "Lektury");
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("Pusta strona na telefonie też bez nazwy („Bez tytułu”): createPageFromTemplate('empty', '')", async () => {
    const user = userEvent.setup();
    render(<NewPageView />);
    expect(screen.getByRole("textbox", { name: "Nazwa strony" })).toHaveValue("");
    await user.click(screen.getByRole("button", { name: "Utwórz" }));
    await waitFor(() => expect(createPageFromTemplate).toHaveBeenCalledWith("empty", ""));
  });
});
