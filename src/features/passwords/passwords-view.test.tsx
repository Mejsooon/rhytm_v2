import * as React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

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
  readOnly: false,
}));
vi.mock("@/features/pages/table/page-table", () => ({
  PageTable: ({
    module,
    moduleTools,
    moduleRowFilter,
    onLiveRowCount,
  }: {
    module?: string;
    moduleTools?: (api: unknown) => React.ReactNode;
    moduleRowFilter?: (row: unknown, fields: unknown[]) => boolean;
    onLiveRowCount?: (n: number) => void;
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

function pokaz(dane: LoadedPage = DANE) {
  return render(
    <SidebarStateProvider initialCollapsed={false}>
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

  it("zablokowany: sama karta „Odblokuj sejf”, bez tabeli, paska, „Zablokuj teraz” i banera", () => {
    vault.state = { status: "zablokowany", remainingMs: 0 };
    pokaz();
    expect(screen.getByRole("heading", { name: "Odblokuj sejf" })).toBeInTheDocument();
    expect(screen.getByText("Blokada po 5 min bezczynności.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nie pamiętam hasła — zresetuj sejf" })).toBeInTheDocument();
    // Tabela zostaje zamontowana (stan po odblokowaniu), ale jest ukryta razem z paskiem
    expect(screen.getByTestId("tabela")).not.toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Szukaj" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kategorie" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zablokuj teraz" })).not.toBeInTheDocument();
    expect(screen.queryByText("Sejf odblokowany")).not.toBeInTheDocument();
  });

  it("brak sejfu: formularz ustawiania hasła głównego zamiast tabeli; „Anuluj” pokazuje tabelę i przycisk powrotu", async () => {
    vault.state = { status: "brak", remainingMs: 0 };
    tabela.readOnly = true;
    const user = userEvent.setup();
    pokaz();
    expect(screen.getByRole("heading", { name: "Ustaw hasło główne sejfu" })).toBeInTheDocument();
    expect(screen.queryByTestId("tabela")).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: "Anuluj" })[0]);
    expect(screen.queryByRole("heading", { name: "Ustaw hasło główne sejfu" })).not.toBeInTheDocument();
    expect(screen.getByTestId("tabela")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ustaw hasło główne" }));
    expect(screen.getByRole("heading", { name: "Ustaw hasło główne sejfu" })).toBeInTheDocument();
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

  it("ładowanie sejfu: ani tabeli, ani karty odblokowania", () => {
    vault.state = { status: "ladowanie", remainingMs: 0 };
    pokaz();
    expect(screen.getByTestId("tabela")).not.toBeVisible();
    expect(screen.queryByRole("heading", { name: "Odblokuj sejf" })).not.toBeInTheDocument();
  });

  it("bez bloku tabeli: komunikat zamiast tabeli", () => {
    pokaz({ ...DANE, blocks: [] });
    expect(screen.getByText(/Nie udało się wczytać tabeli haseł/)).toBeInTheDocument();
    expect(screen.queryByTestId("tabela")).not.toBeInTheDocument();
  });
});
