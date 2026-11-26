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
// i funkcje magazynu przekazane do listy telefonu
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
    renderPhone,
    newRowRef,
  }: {
    newRowRef?: React.RefObject<(() => void) | null>;
    module?: string;
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
      if (newRowRef) newRowRef.current = tabela.newRow;
    });
    return (
      <div data-testid="tabela" data-module={module}>
        <ul aria-label="Wiersze">
          {wiersze.map((w) => (
            <li key={w.id}>{String(w.values["f-serwis"])}</li>
          ))}
        </ul>
        {/* Układ telefonu z tych samych wierszy co tabela */}
        {renderPhone && <div className="min-[800px]:hidden">{renderPhone({
          fields: pola2,
          rows: wiersze,
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

  it("odblokowany (S2Passwords): okruszki „Moduły / Hasła”, „Zablokuj teraz”, „Nowe hasło”, plakietka i opis, tabela modułu", async () => {
    const user = userEvent.setup();
    pokaz();
    const naglowek = screen.getByText("Moduły").closest("header")!;
    expect(within(naglowek).getByRole("heading", { level: 1, name: "Hasła" })).toBeInTheDocument();
    expect(screen.getByText("Hasła", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByText("Odblokowany · blokada po 5 min")).toBeInTheDocument();
    expect(screen.getByText("Zaszyfrowane w przeglądarce Twoim hasłem głównym.")).toBeInTheDocument();
    // Bez dawnego banera z odliczaniem, plakietek z liczbą i paska modułu (szukajka jest w pasku tabeli)
    expect(screen.queryByText("Sejf odblokowany")).not.toBeInTheDocument();
    expect(screen.queryByText("Szyfrowane")).not.toBeInTheDocument();
    expect(screen.queryByText("Kolumny modułu są stałe")).not.toBeInTheDocument();
    expect(screen.getByTestId("tabela")).toHaveAttribute("data-module", "passwords");
    expect(screen.queryByRole("heading", { name: "Odblokuj sejf" })).not.toBeInTheDocument();
    await user.click(within(naglowek).getByRole("button", { name: "Nowe hasło" }));
    expect(tabela.newRow).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Zablokuj teraz" }));
    expect(vault.lock).toHaveBeenCalledTimes(1);
  });
  it("zablokowany przy schowanym pasku: moduł nie ma własnego „Pokaż pasek boczny” (jest w szynie poza modułem)", () => {
    vault.state = { status: "zablokowany", remainingMs: 0 };
    pokaz(DANE, true);
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
    // Brak wiersza tytułu i opisu (S2Vault); okruszki zostają pod rozmyciem, „Nowe hasło” wyłączone
    expect(screen.queryByText("Hasła", { selector: "p" })).not.toBeInTheDocument();
    expect(screen.queryByText("Odblokowany · blokada po 5 min")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zablokuj teraz", hidden: true })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nowe hasło", hidden: true })).toBeDisabled();
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

  it("brak sejfu (S2VaultSetup): okno nad tabelą z przyciemnieniem, treść pod nim inert, fokus w „Hasło główne”; „Anuluj” i Esc z dowolnego miejsca je chowają", async () => {
    vault.state = { status: "brak", remainingMs: 0 };
    tabela.readOnly = true;
    const user = userEvent.setup();
    const { container } = pokaz();
    // Okno webu i ekran telefonu są oba w DOM (przełącza je CSS); tabela pod oknem
    expect(screen.getAllByRole("heading", { name: "Ustaw hasło główne sejfu" })).toHaveLength(2);
    const okno = screen.getByRole("dialog", { name: "Ustaw hasło główne sejfu" });
    expect(okno).toHaveAttribute("aria-modal", "true");
    expect(okno).toHaveClass("max-[799px]:hidden");
    expect(container.querySelector(".bg-black\\/\\[\\.32\\]")).not.toBeNull();
    expect(within(okno).getByLabelText("Hasło główne")).toHaveFocus();
    // Treść pod oknem (nagłówek, tabela) jest inert i aria-hidden; okno i ekran telefonu są poza nią
    const tresc = screen.getByTestId("tabela").closest("[inert]");
    expect(tresc).not.toBeNull();
    expect(tresc).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByRole("button", { name: "Nowe hasło", hidden: true }).closest("[inert]")).toBe(tresc);
    expect(screen.getByRole("button", { name: "Nowe hasło", hidden: true })).toBeDisabled();
    expect(okno.closest("[inert]")).toBeNull();
    expect(screen.getAllByRole("form", { name: "Ustaw hasło główne sejfu" }).every((f) => f.closest("[inert]") === null)).toBe(true);
    await user.click(within(okno).getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("heading", { name: "Ustaw hasło główne sejfu" })).not.toBeInTheDocument();
    expect(container.querySelector(".bg-black\\/\\[\\.32\\]")).toBeNull();
    expect(container.querySelector("[inert]")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Ustaw hasło główne" }));
    expect(screen.getAllByRole("heading", { name: "Ustaw hasło główne sejfu" })).toHaveLength(2);
    // Esc z fokusem poza oknem (na body) też zamyka
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Ustaw hasło główne sejfu" })).not.toBeInTheDocument();
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

  it("telefon: „Szukaj haseł” zawęża listę po Serwis, Login i URL i ignoruje sekrety", async () => {
    const user = userEvent.setup();
    pokaz();
    const telefon = screen.getAllByRole("button", { name: "Nowe hasło" }).map((b) => b.closest(".min-\\[800px\\]\\:hidden")).find((e) => e !== null) as HTMLElement;
    const lista = () => within(telefon).queryAllByRole("button").filter((b) => b.hasAttribute("aria-controls")).map((b) => b.textContent);
    expect(lista()).toHaveLength(3);
    const pole = within(telefon).getByRole("searchbox", { name: "Szukaj haseł" });
    await user.type(pole, "MEJS");
    expect(lista()).toEqual([expect.stringContaining("GitHub")]);
    await user.clear(pole);
    await user.type(pole, "bank.pl");
    expect(lista()).toEqual([expect.stringContaining("Bank")]);
    await user.clear(pole);
    await user.type(pole, "szyfrogram");
    expect(lista()).toHaveLength(0);
  });
  it("telefon, odblokowany: lista MPasswords z tych samych wierszy co tabela; nagłówek webu bez nagłówka telefonu", async () => {
    const user = userEvent.setup();
    const { container } = pokaz();
    // Lista telefonu w układzie widocznym tylko na telefonie, z własnym nagłówkiem (Strony, Zablokuj sejf, Nowe hasło)
    // Web ma swój „Nowe hasło” w nagłówku; telefon w MPasswords
    const telefon = screen.getAllByRole("button", { name: "Nowe hasło" }).map((b) => b.closest(".min-\\[800px\\]\\:hidden")).find((e) => e !== null) as HTMLElement;
    expect(telefon).toBeTruthy();
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

  it("telefon: chipy Kategorii zawężają listę telefonu i łączą się z szukajką; tabela webu dostaje wszystkie wiersze", async () => {
    const user = userEvent.setup();
    pokaz();
    const telefon = screen.getAllByRole("button", { name: "Nowe hasło" }).map((b) => b.closest(".min-\\[800px\\]\\:hidden")).find((e) => e !== null) as HTMLElement;
    const lista = () => within(telefon).queryAllByRole("button").filter((b) => b.hasAttribute("aria-controls")).map((b) => b.textContent);
    await user.click(within(telefon).getByRole("button", { name: "Praca" }));
    expect(lista()).toEqual([expect.stringContaining("GitHub")]);
    expect(within(telefon).getByRole("button", { name: "Praca" })).toHaveAttribute("aria-pressed", "true");
    await user.type(within(telefon).getByRole("searchbox", { name: "Szukaj haseł" }), "bank");
    expect(lista()).toHaveLength(0);
    // Tabela webu (atrapa) nie jest zawężana stanem telefonu
    expect(within(screen.getByRole("list", { name: "Wiersze" })).getAllByRole("listitem")).toHaveLength(3);
  });
  it("telefon, nieobsługiwany i zablokowany: bez listy telefonu (hasła tylko po odblokowaniu)", () => {
    vault.state = { status: "zablokowany", remainingMs: 0 };
    pokaz();
    // Został tylko wyłączony „Nowe hasło” nagłówka webu (pod nakładką)
    expect(screen.getAllByRole("button", { name: "Nowe hasło", hidden: true })).toHaveLength(1);
    expect(screen.queryByRole("searchbox", { name: "Szukaj haseł", hidden: true })).not.toBeInTheDocument();
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
