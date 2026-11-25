import * as React from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toast } = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("sonner", () => ({ toast }));

const vault = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => vault.state }));

import type { PageField } from "@/features/pages/fields";
import type { PageRow } from "@/features/pages/table-model";
import { MPasswords } from "./m-passwords";

const IV = btoa("iv-dwanascie");
const SZYFR_GOOGLE = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-google-1") };
const SZYFR_NOTATKA = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-notatka-1") };
const SZYFR_GITHUB = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-github-1") };
const JAWNE: Record<string, string> = {
  [SZYFR_GOOGLE.ct]: "k7#Vq2!mLp9z",
  [SZYFR_NOTATKA.ct]: "Kody zapasowe w sejfie",
  [SZYFR_GITHUB.ct]: "Gh_42!xTr8w",
};

const POLA: PageField[] = [
  { id: "f-serwis", name: "Serwis", type: "text", config: {}, position: 0, isTitle: true },
  { id: "f-login", name: "Login", type: "text", config: {}, position: 1, isTitle: false },
  { id: "f-haslo", name: "Hasło", type: "secret", config: {}, position: 2, isTitle: false },
  { id: "f-url", name: "URL", type: "url", config: {}, position: 3, isTitle: false },
  {
    id: "f-kat",
    name: "Kategoria",
    type: "select",
    config: {
      options: [
        { id: "k-praca", label: "Praca", color: "#0070f3" },
        { id: "k-prywatne", label: "Prywatne", color: "#525252" },
      ],
    },
    position: 4,
    isTitle: false,
  },
  { id: "f-notatka", name: "Notatka", type: "secret", config: {}, position: 5, isTitle: false },
];

const WIERSZE: PageRow[] = [
  {
    id: "r1",
    values: { "f-serwis": "Google", "f-login": "mejson@example.com", "f-haslo": SZYFR_GOOGLE, "f-url": "accounts.google.com", "f-kat": "k-prywatne", "f-notatka": SZYFR_NOTATKA },
    position: 0,
    deletedAt: null,
  },
  {
    id: "r2",
    values: { "f-serwis": "GitHub", "f-login": "Mejsooon", "f-haslo": SZYFR_GITHUB, "f-url": "https://github.com", "f-kat": "k-praca" },
    position: 1,
    deletedAt: null,
  },
];

function stan(status = "odblokowany") {
  const decrypt = vi.fn(async (v: { ct: string }) => JAWNE[v.ct] ?? null);
  vault.state = { status, remainingMs: 292_000, decrypt, lock: vi.fn() };
  return decrypt;
}

function widok(opcje: Partial<React.ComponentProps<typeof MPasswords>> = {}) {
  const props = {
    fields: POLA,
    rows: WIERSZE,
    fraza: "",
    onFraza: vi.fn(),
    kategoriaId: null,
    onKategoria: vi.fn(),
    onNewRow: vi.fn(),
    onEditRow: vi.fn(),
    onCreateOption: vi.fn(),
    onRemoveOption: vi.fn(),
    planClipboardClear: vi.fn(() => true),
    ...opcje,
  };
  const wynik = render(<MPasswords {...props} />);
  return { ...wynik, props, rerenderWidok: () => wynik.rerender(<MPasswords {...props} />) };
}

function wiersz(nazwa: RegExp) {
  return screen.getByRole("button", { name: nazwa });
}

describe("MPasswords", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("nagłówek: Strony, Zablokuj sejf i Nowe hasło; tytuł, plakietka z odliczaniem i lista zwinięta", async () => {
    const user = userEvent.setup();
    stan();
    const { props } = widok();
    expect(screen.getByRole("link", { name: "Strony" })).toHaveAttribute("href", "/strony");
    expect(screen.getByRole("heading", { level: 1, name: "Hasła" })).toBeInTheDocument();
    expect(screen.getByText("odblokowany · auto-blokada za 4:52")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Zablokuj sejf" }));
    expect((vault.state.lock as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Nowe hasło" }));
    expect(props.onNewRow).toHaveBeenCalledTimes(1);
    expect(wiersz(/Google/)).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("Hasło")).not.toBeInTheDocument();
  });

  it("rozwinięcie nie odszyfrowuje niczego: hasło i notatka są pod maską", async () => {
    const user = userEvent.setup();
    const decrypt = stan();
    widok();
    await user.click(wiersz(/Google/));
    expect(wiersz(/Google/)).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Hasło")).toBeInTheDocument();
    expect(screen.getByText("Notatka")).toBeInTheDocument();
    expect(screen.getAllByText("••••••••••")).toHaveLength(2);
    expect(decrypt).not.toHaveBeenCalled();
    expect(screen.queryByText("k7#Vq2!mLp9z")).not.toBeInTheDocument();
  });

  it("„Pokaż hasło” odszyfrowuje i pokazuje tekst, „Ukryj hasło” go chowa", async () => {
    const user = userEvent.setup();
    const decrypt = stan();
    widok();
    await user.click(wiersz(/Google/));
    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(decrypt).toHaveBeenCalledTimes(1);
    expect(decrypt).toHaveBeenCalledWith(SZYFR_GOOGLE);
    expect(await screen.findByText("k7#Vq2!mLp9z")).toHaveAttribute("translate", "no");
    // Notatka nadal pod maską: oczko hasła jej nie odsłania
    expect(screen.queryByText("Kody zapasowe w sejfie")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Ukryj hasło" }));
    expect(screen.queryByText("k7#Vq2!mLp9z")).not.toBeInTheDocument();
  });

  it("oczko nie ma aria-pressed (nazwa „Pokaż/Ukryj” niesie stan)", async () => {
    const user = userEvent.setup();
    stan();
    widok();
    await user.click(wiersz(/Google/));
    expect(screen.getByRole("button", { name: "Pokaż hasło" })).not.toHaveAttribute("aria-pressed");
    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    await screen.findByText("k7#Vq2!mLp9z");
    expect(screen.getByRole("button", { name: "Ukryj hasło" })).not.toHaveAttribute("aria-pressed");
  });

  it("„Pokaż” odrzuca wynik, gdy szyfrogram zmienił się w trakcie odszyfrowywania", async () => {
    const user = userEvent.setup();
    const decrypt = stan();
    let koniec: (t: string) => void = () => {};
    decrypt.mockImplementationOnce(() => new Promise<string>((r) => (koniec = r)));
    const { props, rerender } = widok();
    await user.click(wiersz(/Google/));
    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    // Zapis z arkusza podmienia szyfrogram, zanim wolne odszyfrowanie starego się skończy
    const nowy = [{ ...WIERSZE[0], values: { ...WIERSZE[0].values, "f-haslo": { ...SZYFR_GITHUB } } }, WIERSZE[1]];
    rerender(<MPasswords {...props} rows={nowy} />);
    await act(async () => koniec("k7#Vq2!mLp9z"));
    expect(screen.queryByText("k7#Vq2!mLp9z")).not.toBeInTheDocument();
    expect(screen.getAllByText("••••••••••").length).toBeGreaterThan(0);
  });

  it("zmiana układu przez próg 800 px zwija rozwinięty wiersz i zrzuca tekst jawny", async () => {
    const user = userEvent.setup();
    stan();
    let zmiana: () => void = () => {};
    vi.stubGlobal("matchMedia", (zapytanie: string) => ({
      matches: false,
      media: zapytanie,
      addEventListener: (_: string, f: () => void) => (zmiana = f),
      removeEventListener: vi.fn(),
    }));
    widok();
    await user.click(wiersz(/Google/));
    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(await screen.findByText("k7#Vq2!mLp9z")).toBeInTheDocument();
    act(() => zmiana());
    expect(screen.queryByText("k7#Vq2!mLp9z")).not.toBeInTheDocument();
    expect(wiersz(/Google/)).toHaveAttribute("aria-expanded", "false");
  });

  it("notatka ma własne „Pokaż notatkę”", async () => {
    const user = userEvent.setup();
    const decrypt = stan();
    widok();
    await user.click(wiersz(/Google/));
    await user.click(screen.getByRole("button", { name: "Pokaż notatkę" }));
    expect(decrypt).toHaveBeenCalledWith(SZYFR_NOTATKA);
    expect(await screen.findByText("Kody zapasowe w sejfie")).toBeInTheDocument();
    expect(screen.queryByText("k7#Vq2!mLp9z")).not.toBeInTheDocument();
  });

  it("zwinięcie czyści tekst jawny: po ponownym rozwinięciu znów maska", async () => {
    const user = userEvent.setup();
    stan();
    widok();
    await user.click(wiersz(/Google/));
    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(await screen.findByText("k7#Vq2!mLp9z")).toBeInTheDocument();
    await user.click(wiersz(/Google/));
    expect(screen.queryByText("k7#Vq2!mLp9z")).not.toBeInTheDocument();
    await user.click(wiersz(/Google/));
    expect(screen.queryByText("k7#Vq2!mLp9z")).not.toBeInTheDocument();
    expect(screen.getAllByText("••••••••••")).toHaveLength(2);
  });

  it("jedno rozwinięcie naraz: otwarcie drugiego wiersza zwija pierwszy i czyści jego tekst", async () => {
    const user = userEvent.setup();
    stan();
    widok();
    await user.click(wiersz(/Google/));
    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(await screen.findByText("k7#Vq2!mLp9z")).toBeInTheDocument();
    await user.click(wiersz(/GitHub/));
    expect(wiersz(/Google/)).toHaveAttribute("aria-expanded", "false");
    expect(wiersz(/GitHub/)).toHaveAttribute("aria-expanded", "true");
    expect(screen.queryByText("k7#Vq2!mLp9z")).not.toBeInTheDocument();
    // GitHub nie ma notatki: pole pominięte
    expect(screen.queryByText("Notatka")).not.toBeInTheDocument();
  });

  it("blokada sejfu czyści odsłonięty tekst", async () => {
    const user = userEvent.setup();
    stan();
    const { rerenderWidok } = widok();
    await user.click(wiersz(/Google/));
    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(await screen.findByText("k7#Vq2!mLp9z")).toBeInTheDocument();
    stan("zablokowany");
    rerenderWidok();
    expect(screen.queryByText("k7#Vq2!mLp9z")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pokaż hasło" })).toBeDisabled();
  });

  it("nowy szyfrogram hasła (zapis z arkusza) zrzuca odsłonięty tekst", async () => {
    const user = userEvent.setup();
    stan();
    const { props, rerender } = widok();
    await user.click(wiersz(/Google/));
    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(await screen.findByText("k7#Vq2!mLp9z")).toBeInTheDocument();
    const nowy = [{ ...WIERSZE[0], values: { ...WIERSZE[0].values, "f-haslo": { ...SZYFR_GITHUB } } }, WIERSZE[1]];
    rerender(<MPasswords {...props} rows={nowy} />);
    expect(screen.queryByText("k7#Vq2!mLp9z")).not.toBeInTheDocument();
  });

  it("kopiowanie: odszyfrowuje, zapisuje do schowka, planuje czyszczenie i pokazuje dopisek, który znika po 30 s", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const decrypt = stan();
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const { props } = widok();
    await user.click(wiersz(/Google/));
    await user.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    expect(decrypt).toHaveBeenCalledWith(SZYFR_GOOGLE);
    expect(writeText).toHaveBeenCalledWith("k7#Vq2!mLp9z");
    expect(props.planClipboardClear).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Skopiowano · schowek wyczyści się za 30 s")).toBeInTheDocument();
    // Kopiowanie nie odsłania hasła na ekranie
    expect(screen.queryByText("k7#Vq2!mLp9z")).not.toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(30_000);
    });
    expect(screen.queryByText("Skopiowano · schowek wyczyści się za 30 s")).not.toBeInTheDocument();
  });

  it("kopiowanie zablokowane w trakcie odszyfrowywania: nic nie trafia do schowka", async () => {
    const user = userEvent.setup();
    const decrypt = stan();
    let odblokuj: (t: string) => void = () => {};
    decrypt.mockImplementationOnce(() => new Promise<string>((r) => (odblokuj = r)));
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const { rerenderWidok, props } = widok();
    await user.click(wiersz(/Google/));
    await user.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    const zablokowany = { ...vault.state, status: "zablokowany" };
    vault.state = zablokowany;
    rerenderWidok();
    await act(async () => odblokuj("k7#Vq2!mLp9z"));
    expect(writeText).not.toHaveBeenCalled();
    expect(props.planClipboardClear).not.toHaveBeenCalled();
  });

  it("nieudany zapis do schowka: toast błędu, bez planu czyszczenia i dopisku", async () => {
    const user = userEvent.setup();
    stan();
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText: vi.fn().mockRejectedValue(new Error("x")) } });
    const { props } = widok();
    await user.click(wiersz(/Google/));
    await user.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    expect(toast.error).toHaveBeenCalledWith("Nie udało się skopiować.");
    expect(props.planClipboardClear).not.toHaveBeenCalled();
    expect(screen.queryByText(/Skopiowano/)).not.toBeInTheDocument();
  });

  it("URL jest linkiem (adres bez schematu dostaje https://), pusty URL i pusta notatka są pomijane", async () => {
    const user = userEvent.setup();
    stan();
    widok({
      rows: [
        WIERSZE[0],
        { id: "r3", values: { "f-serwis": "Poczta", "f-login": "anna", "f-haslo": SZYFR_GITHUB }, position: 2, deletedAt: null },
      ],
    });
    await user.click(wiersz(/Google/));
    const link = screen.getByRole("link", { name: "accounts.google.com" });
    expect(link).toHaveAttribute("href", "https://accounts.google.com");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    await user.click(wiersz(/Poczta/));
    expect(screen.queryByText("URL")).not.toBeInTheDocument();
    expect(screen.queryByText("Notatka")).not.toBeInTheDocument();
  });

  it("wiersz pokazuje Serwis, Login i plakietkę kategorii", () => {
    stan();
    widok();
    const g = wiersz(/Google/);
    expect(within(g).getByText("mejson@example.com")).toBeInTheDocument();
    expect(within(g).getByText("Prywatne")).toBeInTheDocument();
    expect(within(wiersz(/GitHub/)).getByText("Praca")).toBeInTheDocument();
  });

  it("„Edytuj” otwiera arkusz wiersza z tym wierszem", async () => {
    const user = userEvent.setup();
    stan();
    const { props } = widok();
    await user.click(wiersz(/GitHub/));
    await user.click(screen.getByRole("button", { name: "Edytuj" }));
    expect(props.onEditRow).toHaveBeenCalledWith(WIERSZE[1]);
  });

  it("szukajka: pole bez atrybutu name, z atrybutami przeciw menedżerom haseł; wpisanie woła onFraza", async () => {
    const user = userEvent.setup();
    stan();
    const { props } = widok();
    const pole = screen.getByRole("searchbox", { name: "Szukaj haseł" });
    expect(pole).not.toHaveAttribute("name");
    expect(pole).toHaveAttribute("data-1p-ignore");
    expect(pole).toHaveAttribute("autocomplete", "off");
    await user.type(pole, "g");
    expect(props.onFraza).toHaveBeenCalledWith("g");
  });

  it("chipy Kategorii: „Wszystkie” + opcje z aria-pressed; wybór woła onKategoria", async () => {
    const user = userEvent.setup();
    stan();
    const { props } = widok({ kategoriaId: "k-praca" });
    expect(screen.getByRole("button", { name: "Praca" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Wszystkie" })).toHaveAttribute("aria-pressed", "false");
    await user.click(screen.getByRole("button", { name: "Wszystkie" }));
    expect(props.onKategoria).toHaveBeenCalledWith(null);
    await user.click(screen.getByRole("button", { name: "Prywatne" }));
    expect(props.onKategoria).toHaveBeenCalledWith("k-prywatne");
  });

  it("bez opcji Kategorii chipów nie ma, ale „Opcje kategorii” zostaje (da się dodać pierwszą)", async () => {
    const user = userEvent.setup();
    stan();
    const pola = POLA.map((f) => (f.id === "f-kat" ? { ...f, config: { options: [] } } : f));
    const { props } = widok({ fields: pola });
    expect(screen.queryByRole("button", { name: "Wszystkie" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Edytuj kategorie" }));
    await user.type(screen.getByRole("textbox", { name: "Nowa kategoria" }), "Bank");
    await user.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(props.onCreateOption).toHaveBeenCalledWith(expect.objectContaining({ id: "f-kat" }), "Bank");
  });

  it("pusta lista: „Brak haseł…”, a przy zawężeniu „Nic nie znaleziono.”", () => {
    stan();
    const { unmount } = widok({ rows: [] });
    expect(screen.getByText("Brak haseł. Dodaj pierwsze przyciskiem +.")).toBeInTheDocument();
    unmount();
    widok({ rows: [], fraza: "xyz" });
    expect(screen.getByText("Nic nie znaleziono.")).toBeInTheDocument();
  });
});
