import * as React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Okno resetu sejfu odświeża dane strony routerem
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/hasla" }));

const vault = vi.hoisted(() => ({
  state: {} as Record<string, unknown>,
  lock: vi.fn(),
  unlock: vi.fn(),
  setup: vi.fn(),
}));
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => ({ ...vault.state, lock: vault.lock, unlock: vault.unlock, setup: vault.setup }) }));
vi.mock("@/features/vault/actions", () => ({ countSecrets: vi.fn().mockResolvedValue({ ok: true, count: 1 }) }));

// Tabela jest testowana osobno; tu sprawdzamy tylko jej podpięcie: tryb modułu, stan tylko do odczytu
// i funkcje magazynu przekazane do paska (Kategorie)
const tabela = vi.hoisted(() => ({
  createOption: vi.fn(),
  removeOption: vi.fn(),
  newRow: vi.fn(),
  editRow: vi.fn(),
  readOnly: false,
}));
vi.mock("@/features/pages/table/page-table", () => ({
  PageTable: ({
    module,
    moduleTools,
    moduleRowFilter,
    onLiveRowCount,
    renderPhone,
  }: {
    module?: string;
    moduleTools?: (api: unknown) => React.ReactNode;
    moduleRowFilter?: (row: unknown, fields: unknown[]) => boolean;
    onLiveRowCount?: (n: number) => void;
    renderPhone?: (api: unknown) => React.ReactNode;
  }) => {
    const pola = [
      { id: "f-serwis", name: "Serwis", type: "text", config: {}, position: 0, isTitle: true },
      {
        id: "f-kat",
        name: "Kategoria",
        type: "select",
        config: { options: [{ id: "k1", label: "Praca", color: "#525252" }] },
        position: 4,
        isTitle: false,
      },
    ];
    // Wiersze atrapy: sekret (Hasło) to szyfrogram, który wyszukiwarka ma ignorować
    const wiersze = [
      { id: "r1", values: { "f-serwis": "GitHub", "f-login": "mejson", "f-url": "github.com", "f-haslo": "sekretny-szyfrogram", "f-kat": "k1" }, position: 0, deletedAt: null },
      { id: "r2", values: { "f-serwis": "Bank", "f-login": "jan", "f-url": "bank.pl", "f-kat": "k2" }, position: 1, deletedAt: null },
      { id: "r3", values: { "f-serwis": "Poczta", "f-login": "anna", "f-kat": null }, position: 2, deletedAt: null },
    ];
    const pola2 = [
      ...pola,
      { id: "f-login", name: "Login", type: "text", config: {}, position: 1, isTitle: false },
      { id: "f-url", name: "URL", type: "url", config: {}, position: 3, isTitle: false },
      { id: "f-haslo", name: "Hasło", type: "secret", config: {}, position: 2, isTitle: false },
    ];
    pola2[1] = {
      ...pola[1],
      config: { options: [{ id: "k1", label: "Praca", color: "#525252" }, { id: "k2", label: "Bank", color: "#525252" }] },
    };
    React.useEffect(() => {
      onLiveRowCount?.(wiersze.length);
    }, [onLiveRowCount, wiersze.length]);
    return (
      <div data-testid="tabela" data-module={module}>
        <ul aria-label="Wiersze">
          {wiersze.filter((w) => !moduleRowFilter || moduleRowFilter(w, pola2)).map((w) => (
            <li key={w.id}>{String(w.values["f-serwis"])}</li>
          ))}
        </ul>
        {moduleTools?.({
          fields: pola2,
          readOnly: tabela.readOnly,
          createOption: tabela.createOption,
          removeOption: tabela.removeOption,
        })}
        {/* Układ telefonu z tych samych wierszy co tabela (po filtrze modułu) */}
        {renderPhone && <div className="min-[800px]:hidden">{renderPhone({
          fields: pola2,
          rows: wiersze.filter((w) => !moduleRowFilter || moduleRowFilter(w, pola2)),
          readOnly: tabela.readOnly,
          createOption: tabela.createOption,
          removeOption: tabela.removeOption,
          newRow: tabela.newRow,
          editRow: tabela.editRow,
          planClipboardClear: () => true,
        })}</div>}
      </div>
    );
  },
}));

import type { LoadedPage } from "@/features/pages/load-page";
import { SidebarStateProvider } from "@/components/shell/sidebar-state";
import { PasswordsView } from "./passwords-view";

const DANE = {
  page: { id: "p", title: "Hasła", icon: "lock", favorite: false, templateKey: "passwords", position: 0, rowCount: 0, createdAt: "", isSystem: true },
  blocks: [{ id: "b", type: "table", position: 0, content: {}, fields: [], rows: [] }],
  today: "2026-11-23",
  currency: "PLN",
} as unknown as LoadedPage;

function pokaz(dane: LoadedPage = DANE, schowany = false) {
  return render(
    <SidebarStateProvider initialCollapsed={schowany}>
      <PasswordsView data={dane} />
    </SidebarStateProvider>,
  );
}

describe("PasswordsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vault.state = { status: "odblokowany", remainingMs: 120_000 };
    tabela.readOnly = false;
  });

  it("odblokowany: okruszki „Moduły / Hasła”, „Zablokuj teraz”, „Szyfrowane”, baner i tabela modułu", async () => {
    const user = userEvent.setup();
    pokaz();
    const naglowek = screen.getByText("Moduły").closest("header")!;
    expect(within(naglowek).getByRole("heading", { level: 1, name: "Hasła" })).toBeInTheDocument();
    expect(screen.getByText("Szyfrowane")).toBeInTheDocument();
    expect(screen.getByText("Sejf odblokowany")).toBeInTheDocument();
    expect(screen.getByTestId("tabela")).toHaveAttribute("data-module", "passwords");
    expect(screen.getByText("Kolumny modułu są stałe")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kategorie" })).toBeEnabled();
    expect(screen.queryByRole("heading", { name: "Odblokuj sejf" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Zablokuj teraz" }));
    expect(vault.lock).toHaveBeenCalledTimes(1);
  });

  it("zablokowany przy schowanym pasku: „Pokaż pasek boczny” nad nakładką (poza inert) i działa", async () => {
    vault.state = { status: "zablokowany", remainingMs: 0 };
    const user = userEvent.setup();
    pokaz(DANE, true);
    // Jedyny dostępny przycisk (ten z nagłówka jest pod inert + aria-hidden)
    const przyciski = screen.getAllByRole("button", { name: "Pokaż pasek boczny", hidden: true });
    const nad = przyciski.filter((b) => b.closest("[inert]") === null);
    expect(nad).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Pokaż pasek boczny" })).toBe(nad[0]);
    await user.click(nad[0]);
    // Pasek pokazany → przycisk znika (SidebarToggle w nagłówku renderuje się tylko przy schowanym pasku)
    expect(screen.queryByRole("button", { name: "Pokaż pasek boczny", hidden: true })).toBeNull();
  });

  it("zablokowany przy widocznym pasku: bez przycisku „Pokaż pasek boczny”", () => {
    vault.state = { status: "zablokowany", remainingMs: 0 };
    pokaz();
    expect(screen.queryByRole("button", { name: "Pokaż pasek boczny", hidden: true })).toBeNull();
  });

  it("zablokowany: tabela tylko do odczytu pod rozmyciem, okno „Odblokuj sejf”, bez tytułu „Hasła” i „Zablokuj teraz”", () => {
    vault.state = { status: "zablokowany", remainingMs: 0 };
    const { container } = pokaz();
    const okno = screen.getByRole("dialog", { name: "Odblokuj sejf" });
    expect(okno).not.toHaveAttribute("aria-modal");
    expect(screen.getByText("Blokada po 5 min bezczynności.")).toBeInTheDocument();
    // Link do resetu jest w oknie webu i na ekranie telefonu (oba w DOM, przełącza je CSS)
    expect(within(okno).getByRole("button", { name: "Nie pamiętam hasła — zresetuj sejf" })).toBeInTheDocument();
    // Tabela widoczna (atrapa), nie ukryta; w treści pod nakładką, która jest inert i aria-hidden
    const tabelaEl = screen.getByTestId("tabela");
    expect(tabelaEl).toBeVisible();
    const tresc = tabelaEl.closest("[inert]");
    expect(tresc).not.toBeNull();
    expect(tresc).toHaveAttribute("aria-hidden", "true");
    expect(okno.closest("[inert]")).toBeNull();
    // Nakładka z rozmyciem
    const nakladka = container.querySelector(".backdrop-blur-\\[3px\\]");
    expect(nakladka).not.toBeNull();
    expect(nakladka).toHaveAttribute("aria-hidden", "true");
    // Brak wiersza tytułu z ikoną; okruszki i plakietki zostają (pod rozmyciem)
    expect(screen.queryByText("Hasła", { selector: "p" })).not.toBeInTheDocument();
    expect(screen.getByText("Szyfrowane")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zablokuj teraz" })).not.toBeInTheDocument();
    expect(screen.queryByText("Sejf odblokowany")).not.toBeInTheDocument();
  });

  it("telefon, zablokowany: pełny ekran „Sejf jest zablokowany” z linkiem „Strony”, okno i nakładka webu chowane CSS", () => {
    vault.state = { status: "zablokowany", remainingMs: 0 };
    const { container } = pokaz();
    const ekran = screen.getByRole("heading", { level: 1, name: "Sejf jest zablokowany" });
    const telefon = ekran.closest(".min-\\[800px\\]\\:hidden")!;
    expect(telefon).not.toBeNull();
    expect(within(telefon as HTMLElement).getByRole("link", { name: "Strony" })).toHaveAttribute("href", "/strony");
    expect(within(telefon as HTMLElement).getByLabelText("Hasło główne")).toHaveAttribute("autocomplete", "current-password");
    // Opakowanie webu (tabela, nagłówek) chowa się na telefonie, a nakładka i okno webu też
    expect(screen.getByTestId("tabela").closest("[inert]")).toHaveClass("max-[799px]:hidden");
    expect(container.querySelector(".backdrop-blur-\\[3px\\]")).toHaveClass("max-[799px]:hidden");
    expect(screen.getByRole("dialog", { name: "Odblokuj sejf" }).parentElement).toHaveClass("max-[799px]:hidden");
  });

  it("zablokowany → odblokowany: nakładka i okno znikają, tytuł wraca, tabela zostaje ta sama", () => {
    vault.state = { status: "zablokowany", remainingMs: 0 };
    const { container, rerender } = pokaz();
    const przed = screen.getByTestId("tabela");
    vault.state = { status: "odblokowany", remainingMs: 120_000 };
    rerender(
      <SidebarStateProvider initialCollapsed={false}>
        <PasswordsView data={DANE} />
      </SidebarStateProvider>,
    );
    expect(screen.queryByRole("dialog", { name: "Odblokuj sejf" })).not.toBeInTheDocument();
    expect(container.querySelector(".backdrop-blur-\\[3px\\]")).toBeNull();
    expect(container.querySelector("[inert]")).toBeNull();
    expect(screen.getByText("Hasła", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByTestId("tabela")).toBe(przed);
    expect(screen.getByRole("button", { name: "Zablokuj teraz" })).toBeInTheDocument();
  });

  it("brak sejfu: formularz ustawiania hasła głównego zamiast tabeli; „Anuluj” pokazuje tabelę i przycisk powrotu", async () => {
    vault.state = { status: "brak", remainingMs: 0 };
    tabela.readOnly = true;
    const user = userEvent.setup();
    pokaz();
    // Karta webu i ekran telefonu są oba w DOM (przełącza je CSS)
    expect(screen.getAllByRole("heading", { name: "Ustaw hasło główne sejfu" })).toHaveLength(2);
    expect(screen.queryByTestId("tabela")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Anuluj" })[0]);
    expect(screen.queryByRole("heading", { name: "Ustaw hasło główne sejfu" })).not.toBeInTheDocument();
    expect(screen.getByTestId("tabela")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ustaw hasło główne" }));
    expect(screen.getAllByRole("heading", { name: "Ustaw hasło główne sejfu" })).toHaveLength(2);
  });

  it("telefon, brak sejfu: ekran ustawiania w układzie tylko dla telefonu, z nagłówkiem „Hasła” i linkiem „Anuluj” do /strony", () => {
    vault.state = { status: "brak", remainingMs: 0 };
    pokaz();
    const ekran = screen.getAllByRole("form", { name: "Ustaw hasło główne sejfu" }).find((f) => f.closest(".min-\\[800px\\]\\:hidden"))!;
    expect(ekran).toBeDefined();
    expect(within(ekran).getByRole("link", { name: "Anuluj" })).toHaveAttribute("href", "/strony");
    // Nagłówek telefonu: link „Strony” i wyśrodkowane „Hasła”
    const naglowek = document.querySelector("header.m-head")!;
    expect(within(naglowek as HTMLElement).getByRole("link", { name: "Strony" })).toHaveAttribute("href", "/strony");
    expect(within(naglowek as HTMLElement).getByRole("heading", { level: 1, name: "Hasła" })).toBeInTheDocument();
  });

  it("nieobsługiwany: komunikat banera i tabela", () => {
    vault.state = { status: "nieobslugiwany", remainingMs: 0 };
    tabela.readOnly = true;
    pokaz();
    expect(screen.getByRole("alert")).toHaveTextContent("Sejf wymaga nowoczesnej przeglądarki i połączenia HTTPS.");
    expect(screen.getByTestId("tabela")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Odblokuj sejf" })).not.toBeInTheDocument();
  });

  it("nagłówek: ikona, h1 „Hasła” i plakietki z liczbą haseł (odmiana) oraz „Szyfrowane”", () => {
    pokaz();
    expect(screen.getAllByRole("heading", { level: 1, name: "Hasła" }).length).toBeGreaterThan(0);
    expect(screen.getByText("3 hasła")).toBeInTheDocument();
    expect(screen.getByText("Szyfrowane")).toBeInTheDocument();
  });

  it("pasek: „Szukaj” zawęża po Serwis, Login i URL i ignoruje sekrety", async () => {
    const user = userEvent.setup();
    pokaz();
    const lista = () => within(screen.getByRole("list", { name: "Wiersze" })).queryAllByRole("listitem").map((e) => e.textContent);
    expect(lista()).toEqual(["GitHub", "Bank", "Poczta"]);
    const pole = screen.getByRole("textbox", { name: "Szukaj" });
    expect(pole).toHaveAttribute("placeholder", "Szukaj serwisu lub loginu");
    await user.type(pole, "MEJS");
    expect(lista()).toEqual(["GitHub"]);
    await user.clear(pole);
    await user.type(pole, "bank.pl");
    expect(lista()).toEqual(["Bank"]);
    await user.clear(pole);
    await user.type(pole, "szyfrogram");
    expect(lista()).toEqual([]);
  });

  it("pasek: segment „Kategoria” (aria-pressed) zawęża po Kategorii, „Wszystkie” przywraca; łączy się z wyszukiwaniem", async () => {
    const user = userEvent.setup();
    pokaz();
    const grupa = screen.getByRole("group", { name: "Kategoria" });
    expect(within(grupa).getByRole("button", { name: "Wszystkie" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(grupa).getByRole("button", { name: "Bank" }));
    expect(within(grupa).getByRole("button", { name: "Bank" })).toHaveAttribute("aria-pressed", "true");
    expect(within(grupa).getByRole("button", { name: "Wszystkie" })).toHaveAttribute("aria-pressed", "false");
    const lista = () => within(screen.getByRole("list", { name: "Wiersze" })).queryAllByRole("listitem").map((e) => e.textContent);
    expect(lista()).toEqual(["Bank"]);
    await user.type(screen.getByRole("textbox", { name: "Szukaj" }), "git");
    expect(lista()).toEqual([]);
    await user.click(within(grupa).getByRole("button", { name: "Wszystkie" }));
    expect(lista()).toEqual(["GitHub"]);
  });

  it("„Kategorie”: dodanie i usunięcie opcji idzie przez funkcje magazynu tabeli", async () => {
    tabela.createOption.mockResolvedValue("nowa");
    const user = userEvent.setup();
    pokaz();
    await user.click(screen.getByRole("button", { name: "Kategorie" }));
    const lista = screen.getByRole("list", { name: "Kategorie haseł" });
    expect(within(lista).getByText("Praca")).toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Nowa kategoria" }), "Bank");
    await user.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(tabela.createOption).toHaveBeenCalledWith(expect.objectContaining({ id: "f-kat", name: "Kategoria" }), "Bank");
    await user.click(screen.getByRole("button", { name: "Usuń kategorię Praca" }));
    expect(tabela.removeOption).toHaveBeenCalledWith(expect.objectContaining({ id: "f-kat" }), "k1");
  });

  it("telefon, odblokowany: lista MPasswords z tych samych wierszy co tabela; nagłówek webu bez nagłówka telefonu", async () => {
    const user = userEvent.setup();
    const { container } = pokaz();
    // Lista telefonu w układzie widocznym tylko na telefonie, z własnym nagłówkiem (Strony, Zablokuj sejf, Nowe hasło)
    const telefon = screen.getByRole("button", { name: "Nowe hasło" }).closest(".min-\\[800px\\]\\:hidden") as HTMLElement;
    expect(telefon).not.toBeNull();
    expect(within(telefon).getByRole("link", { name: "Strony" })).toHaveAttribute("href", "/strony");
    expect(within(telefon).getByText("odblokowany · auto-blokada za 2:00")).toBeInTheDocument();
    expect(within(telefon).getAllByRole("button", { expanded: false }).filter((b) => b.hasAttribute("aria-controls"))).toHaveLength(3);
    // ModuleHeader odblokowanego sejfu ma tylko nagłówek webu (telefon ma swój w MPasswords)
    expect(container.querySelectorAll("header.m-head")).toHaveLength(1);
    await user.click(within(telefon).getByRole("button", { name: "Nowe hasło" }));
    expect(tabela.newRow).toHaveBeenCalledTimes(1);
    await user.click(within(telefon).getByRole("button", { name: /^GitHub/ }));
    await user.click(within(telefon).getByRole("button", { name: "Edytuj" }));
    expect(tabela.editRow).toHaveBeenCalledWith(expect.objectContaining({ id: "r1" }));
    await user.click(within(telefon).getByRole("button", { name: "Zablokuj sejf" }));
    expect(vault.lock).toHaveBeenCalledTimes(1);
  });

  it("telefon: szukajka i chipy Kategorii dzielą stan z paskiem webu i zawężają listę telefonu", async () => {
    const user = userEvent.setup();
    pokaz();
    const telefon = screen.getByRole("button", { name: "Nowe hasło" }).closest(".min-\\[800px\\]\\:hidden") as HTMLElement;
    // Wiersze listy to jedyne przyciski z aria-controls (chipy mają aria-pressed)
    const lista = () => within(telefon).queryAllByRole("button").filter((b) => b.hasAttribute("aria-controls")).map((b) => b.textContent);
    expect(lista()).toHaveLength(3);
    await user.type(within(telefon).getByRole("searchbox", { name: "Szukaj haseł" }), "bank");
    expect(lista()).toHaveLength(1);
    // Ta sama fraza na pasku webu (jeden stan widoku)
    expect(screen.getByRole("textbox", { name: "Szukaj" })).toHaveValue("bank");
    await user.clear(within(telefon).getByRole("searchbox", { name: "Szukaj haseł" }));
    await user.click(within(telefon).getByRole("button", { name: "Praca" }));
    expect(lista()).toHaveLength(1);
    expect(within(telefon).getByRole("button", { name: "Praca" })).toHaveAttribute("aria-pressed", "true");
    // Segment webu pokazuje tę samą kategorię
    expect(within(screen.getByRole("group", { name: "Kategoria" })).getByRole("button", { name: "Praca" })).toHaveAttribute("aria-pressed", "true");
  });

  it("telefon, nieobsługiwany i zablokowany: bez listy telefonu (hasła tylko po odblokowaniu)", () => {
    vault.state = { status: "zablokowany", remainingMs: 0 };
    pokaz();
    expect(screen.queryByRole("button", { name: "Nowe hasło" })).not.toBeInTheDocument();
  });

  it("ładowanie sejfu: tabela ukryta, bez nakładki i okna odblokowania", () => {
    vault.state = { status: "ladowanie", remainingMs: 0 };
    const { container } = pokaz();
    expect(container.querySelector(".backdrop-blur-\\[3px\\]")).toBeNull();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByTestId("tabela")).not.toBeVisible();
    expect(screen.queryByRole("dialog", { name: "Odblokuj sejf" })).not.toBeInTheDocument();
  });

  it("telefon, ładowanie: sam nagłówek z linkiem „Strony”, bez ekranu „zablokowany” ani pola hasła", () => {
    vault.state = { status: "ladowanie", remainingMs: 0 };
    pokaz();
    expect(screen.getByRole("link", { name: "Strony" })).toHaveAttribute("href", "/strony");
    expect(screen.queryByRole("heading", { name: "Sejf jest zablokowany" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Hasło główne")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Odblokuj" })).not.toBeInTheDocument();
  });

  it("bez bloku tabeli: komunikat zamiast tabeli", () => {
    pokaz({ ...DANE, blocks: [] });
    expect(screen.getByText(/Nie udało się wczytać tabeli haseł/)).toBeInTheDocument();
    expect(screen.queryByTestId("tabela")).not.toBeInTheDocument();
  });
});
