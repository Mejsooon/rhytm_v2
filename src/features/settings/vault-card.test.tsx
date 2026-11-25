import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

// Okno resetu sejfu odświeża dane strony routerem
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn(), replace: vi.fn() }), usePathname: () => "/hasla" }));

const { getVault, createVault, rewrapVaultAction, resetVault, countSecrets } =
  vi.hoisted(() => ({
    getVault: vi.fn(),
    createVault: vi.fn(),
    rewrapVaultAction: vi.fn(),
    resetVault: vi.fn(),
    countSecrets: vi.fn(),
  }));

// Akcje serwerowe są mockowane, kryptografia (PBKDF2, AES-GCM) jest prawdziwa
vi.mock("@/features/vault/actions", () => ({
  getVault,
  createVault,
  rewrapVault: rewrapVaultAction,
  resetVault,
  countSecrets,
}));

// webCryptoAvailable owinięte w vi.fn, żeby w jednym teście wymusić „nieobsługiwany”
vi.mock("@/features/vault/crypto", async (importOriginal) => {
  const oryginal =
    await importOriginal<typeof import("@/features/vault/crypto")>();
  return {
    ...oryginal,
    webCryptoAvailable: vi.fn(oryginal.webCryptoAvailable),
  };
});

import {
  createVaultMaterial,
  unwrapDataKey,
  webCryptoAvailable,
  type VaultMaterial,
} from "@/features/vault/crypto";
import { useVault, VaultProvider } from "@/features/vault/vault-provider";
import { VaultCard } from "./vault-card";

const STARE = "Stare-haslo-glowne-1";
const NOWE = "Nowe-haslo-glowne-22";
let material: VaultMaterial;

function zSejfem() {
  getVault.mockResolvedValue({
    ok: true,
    vault: {
      ...material,
      generation: 1,
      created_at: "2026-11-21T10:00:00Z",
      updated_at: "2026-11-21T10:00:00Z",
    },
  });
}

// Mały komponent testowy: odblokowuje sejf prawdziwym unlock podanym hasłem (karta nie ma własnego pola odblokowania)
function Odblokuj({ haslo, etykieta }: { haslo: string; etykieta: string }) {
  const { unlock } = useVault();
  const [blad, setBlad] = React.useState("");
  return (
    <>
      <button
        onClick={() =>
          void unlock(haslo).then((w) => setBlad(w.ok ? "" : w.message))
        }
      >
        {etykieta}
      </button>
      <span data-testid={`blad-${etykieta}`}>{blad}</span>
    </>
  );
}

// Pokazuje status providera (osobno, żeby nie dublować go przy kilku przyciskach)
function StatusProvidera() {
  const { status } = useVault();
  return <span data-testid="status">{status}</span>;
}

async function zamontuj() {
  render(
    <VaultProvider>
      <Odblokuj haslo={STARE} etykieta="test-odblokuj" />
      <Odblokuj haslo={NOWE} etykieta="test-odblokuj-nowe" />
      <StatusProvidera />
      <VaultCard />
    </VaultProvider>,
  );
  await act(async () => {});
  await act(async () => {});
}

beforeAll(async () => {
  material = (await createVaultMaterial(STARE)).material;
}, 30000);

beforeEach(() => {
  countSecrets.mockResolvedValue({ ok: true, count: 3 });
});

afterEach(() => {
  vi.clearAllMocks();
  getVault.mockReset();
  createVault.mockReset();
  rewrapVaultAction.mockReset();
  resetVault.mockReset();
  // Przywraca prawdziwe webCryptoAvailable po teście „nieobsługiwany”
  vi.mocked(webCryptoAvailable).mockRestore();
});

describe("VaultCard", () => {
  it("bez sejfu: Ustaw sejf", async () => {
    const user = userEvent.setup();
    getVault.mockResolvedValue({ ok: true, vault: null });
    await zamontuj();
    expect(screen.getByText("Nie ustawiony")).toBeInTheDocument();
    expect(screen.queryByText("Zmień hasło główne")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Zresetuj sejf" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ustaw sejf" }));
    expect(screen.getByText("Ustaw hasło główne sejfu")).toBeInTheDocument();
    // „Anuluj” wraca do karty ze stanem
    await user.click(screen.getAllByRole("button", { name: "Anuluj" })[0]);
    expect(
      screen.getByRole("button", { name: "Ustaw sejf" }),
    ).toBeInTheDocument();
  });

  it("stan: Ustawiony z datą dd.mm.rrrr, pola hasła z właściwym autoComplete", async () => {
    zSejfem();
    await zamontuj();
    expect(screen.getByText("Ustawiony 21.11.2026")).toBeInTheDocument();
    for (const [nazwa, ac] of [
      ["Obecne hasło główne", "current-password"],
      ["Nowe hasło główne", "new-password"],
      ["Powtórz nowe hasło", "new-password"],
    ] as const) {
      const pole = screen.getByLabelText(nazwa);
      expect(pole).toHaveAttribute("type", "password");
      expect(pole).toHaveAttribute("autocomplete", ac);
    }
    expect(
      screen.getByText("Zmiana hasła głównego nie zmienia klucza szyfrowania — stare kopie zapasowe nadal otwiera stare hasło."),
    ).toBeInTheDocument();
    const pole = screen.getByLabelText("Obecne hasło główne");
    // Ukryta nazwa użytkownika: menedżer haseł zapisuje hasło główne pod osobnym wpisem, nie pod kontem
    const uzytkownik = pole.closest("form")!.querySelector('input[autocomplete="username"]');
    expect(uzytkownik).not.toBeNull();
    expect(uzytkownik).toHaveValue("Sejf rhytm (hasło główne)");
    expect(uzytkownik).toHaveAttribute("readonly");
    expect(uzytkownik).toHaveAttribute("hidden");
    expect(uzytkownik).toHaveAttribute("aria-hidden", "true");
    expect(uzytkownik).toHaveAttribute("tabindex", "-1");
    // Zablokowany: bez „Zablokuj teraz”
    expect(
      screen.queryByRole("button", { name: "Zablokuj teraz" }),
    ).not.toBeInTheDocument();
  });

  it("karty Sejfu to ta sama rodzina co pozostałe: rounded-xl i shadow-card", async () => {
    zSejfem();
    await zamontuj();
    for (const id of ["karta-sejf", "karta-sejf-haslo", "karta-sejf-strefa"]) {
      expect(screen.getByTestId(id)).toHaveClass("rounded-xl", "shadow-card");
    }
  });

  it("zmiana hasła: złe obecne → błąd; dobre → sukces i stare hasło nie odblokowuje", async () => {
    const user = userEvent.setup();
    zSejfem();
    let zapisane: VaultMaterial | null = null;
    rewrapVaultAction.mockImplementation(async (m: VaultMaterial) => {
      zapisane = m;
      return { ok: true, updated_at: "2026-11-21T11:00:00Z" };
    });
    await zamontuj();

    const przycisk = screen.getByRole("button", { name: "Zmień hasło" });
    // Nieaktywny, dopóki nowe jest za słabe lub powtórzenie się różni
    expect(przycisk).toBeDisabled();
    await user.type(
      screen.getByLabelText("Obecne hasło główne"),
      "zle-haslo-glowne-9",
    );
    await user.type(screen.getByLabelText("Nowe hasło główne"), "krotkie");
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), "krotkie");
    expect(przycisk).toBeDisabled();
    await user.clear(screen.getByLabelText("Nowe hasło główne"));
    await user.clear(screen.getByLabelText("Powtórz nowe hasło"));
    await user.type(screen.getByLabelText("Nowe hasło główne"), NOWE);
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), NOWE + "x");
    expect(screen.getByText("Hasła się różnią.")).toBeInTheDocument();
    expect(przycisk).toBeDisabled();
    await user.clear(screen.getByLabelText("Powtórz nowe hasło"));
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), NOWE);
    expect(przycisk).toBeEnabled();

    // Złe obecne hasło: błąd, serwer nie dostaje zapisu, pola wyczyszczone
    await user.click(przycisk);
    expect(
      await screen.findByText("Nieprawidłowe hasło główne."),
    ).toBeInTheDocument();
    expect(rewrapVaultAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Obecne hasło główne")).toHaveValue("");
    expect(screen.getByLabelText("Nowe hasło główne")).toHaveValue("");
    expect(screen.getByLabelText("Powtórz nowe hasło")).toHaveValue("");

    // Dobre obecne hasło: sukces
    await user.type(screen.getByLabelText("Obecne hasło główne"), STARE);
    await user.type(screen.getByLabelText("Nowe hasło główne"), NOWE);
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), NOWE);
    await user.click(screen.getByRole("button", { name: "Zmień hasło" }));
    expect(
      await screen.findByText(
        "Hasło główne zmienione. Odblokuj sejf nowym hasłem.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Nieprawidłowe hasło główne."),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Obecne hasło główne")).toHaveValue("");
    expect(rewrapVaultAction).toHaveBeenCalledTimes(1);

    // Na serwer trafił tylko materiał: nowe hasło odwija klucz, stare już nie
    expect(zapisane).not.toBeNull();
    expect(JSON.stringify(rewrapVaultAction.mock.calls)).not.toContain(NOWE);
    expect(await unwrapDataKey(STARE, zapisane!)).toBeNull();
    expect(await unwrapDataKey(NOWE, zapisane!)).not.toBeNull();
  }, 60000);

  it("reset z RESETUJ", async () => {
    const user = userEvent.setup();
    zSejfem();
    resetVault.mockResolvedValue({ ok: true, cleared: 3 });
    await zamontuj();

    await user.click(screen.getByRole("button", { name: "Zresetuj sejf" }));
    expect(await screen.findByText("Zresetować sejf?")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    const zresetuj = Array.from(dialog.querySelectorAll("button")).find(
      (b) => b.textContent === "Zresetuj sejf",
    )!;
    // Bez słowa RESETUJ reset nie rusza
    await user.click(zresetuj);
    expect(resetVault).not.toHaveBeenCalled();

    await user.type(
      screen.getByLabelText("Wpisz RESETUJ, żeby potwierdzić"),
      "RESETUJ",
    );
    await user.click(zresetuj);
    await waitFor(() => expect(resetVault).toHaveBeenCalledTimes(1));
    // Po resecie karta wraca do stanu bez sejfu
    expect(await screen.findByText("Nie ustawiony")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ustaw sejf" }),
    ).toBeInTheDocument();
  });

  it("po utworzeniu i resecie wraca „Nie ustawiony”, a nie formularz ustawiania", async () => {
    const user = userEvent.setup();
    getVault.mockResolvedValue({ ok: true, vault: null });
    createVault.mockImplementation(async () => {
      // Po utworzeniu serwer zwraca już sejf (provider doczytuje created_at)
      zSejfem();
      return { ok: true, generation: 1 };
    });
    resetVault.mockResolvedValue({ ok: true, cleared: 0 });
    await zamontuj();

    await user.click(screen.getByRole("button", { name: "Ustaw sejf" }));
    await user.type(
      screen.getByLabelText("Hasło główne"),
      "Dobre-haslo-glowne-1",
    );
    await user.type(screen.getByLabelText("Powtórz"), "Dobre-haslo-glowne-1");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Utwórz sejf" }));
    expect(
      await screen.findByText(/^Ustawiony \d{2}\.\d{2}\.\d{4}$/),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Zresetuj sejf" }));
    await screen.findByText("Zresetować sejf?");
    await user.type(
      screen.getByLabelText("Wpisz RESETUJ, żeby potwierdzić"),
      "RESETUJ",
    );
    const dialog = screen.getByRole("dialog");
    await user.click(
      Array.from(dialog.querySelectorAll("button")).find(
        (b) => b.textContent === "Zresetuj sejf",
      )!,
    );
    expect(await screen.findByText("Nie ustawiony")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ustaw sejf" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Ustaw hasło główne sejfu"),
    ).not.toBeInTheDocument();
  }, 60000);

  it("komunikat sukcesu zależy od statusu: zablokowany i odblokowany", async () => {
    const user = userEvent.setup();
    zSejfem();
    // Mock serwera: zapisany materiał wraca z getVault z tym samym updated_at, które zwraca akcja
    let licznik = 0;
    rewrapVaultAction.mockImplementation(async (m: VaultMaterial) => {
      licznik += 1;
      const updatedAt = `2026-11-21T1${licznik}:00:00Z`;
      getVault.mockResolvedValue({
        ok: true,
        vault: {
          ...m,
          generation: 1,
          created_at: "2026-11-21T10:00:00Z",
          updated_at: updatedAt,
        },
      });
      return { ok: true, updated_at: updatedAt };
    });
    await zamontuj();

    async function zmien(stare: string, nowe: string) {
      await user.type(screen.getByLabelText("Obecne hasło główne"), stare);
      await user.type(screen.getByLabelText("Nowe hasło główne"), nowe);
      await user.type(screen.getByLabelText("Powtórz nowe hasło"), nowe);
      await user.click(screen.getByRole("button", { name: "Zmień hasło" }));
    }

    await zmien(STARE, NOWE);
    expect(
      await screen.findByText(
        "Hasło główne zmienione. Odblokuj sejf nowym hasłem.",
      ),
    ).toBeInTheDocument();

    // Stare hasło już nie odblokowuje
    await user.click(screen.getByRole("button", { name: "test-odblokuj" }));
    await waitFor(() =>
      expect(screen.getByTestId("blad-test-odblokuj")).toHaveTextContent(
        "Nieprawidłowe hasło główne.",
      ),
    );
    expect(screen.getByTestId("status")).toHaveTextContent("zablokowany");

    // Nowe hasło odblokowuje
    await user.click(
      screen.getByRole("button", { name: "test-odblokuj-nowe" }),
    );
    await waitFor(() =>
      expect(screen.getByTestId("status")).toHaveTextContent("odblokowany"),
    );

    await zmien(NOWE, NOWE + "2");
    expect(
      await screen.findByText("Hasło główne zmienione."),
    ).toBeInTheDocument();
  }, 90000);

  it("błąd „Nieprawidłowe hasło główne.” znika po wpisaniu znaku w polu obecnego hasła", async () => {
    const user = userEvent.setup();
    zSejfem();
    await zamontuj();
    await user.type(
      screen.getByLabelText("Obecne hasło główne"),
      "zle-haslo-glowne-9",
    );
    await user.type(screen.getByLabelText("Nowe hasło główne"), NOWE);
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), NOWE);
    await user.click(screen.getByRole("button", { name: "Zmień hasło" }));
    expect(
      await screen.findByText("Nieprawidłowe hasło główne."),
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText("Obecne hasło główne"), "a");
    expect(
      screen.queryByText("Nieprawidłowe hasło główne."),
    ).not.toBeInTheDocument();
  }, 60000);

  it("reset odmontowuje formularz: po ponownym ustawieniu pola są puste", async () => {
    const user = userEvent.setup();
    zSejfem();
    resetVault.mockResolvedValue({ ok: true, cleared: 0 });
    await zamontuj();
    await user.type(screen.getByLabelText("Obecne hasło główne"), "cos");
    await user.type(screen.getByLabelText("Nowe hasło główne"), NOWE);
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), NOWE);

    await user.click(screen.getByRole("button", { name: "Zresetuj sejf" }));
    await screen.findByText("Zresetować sejf?");
    await user.type(
      screen.getByLabelText("Wpisz RESETUJ, żeby potwierdzić"),
      "RESETUJ",
    );
    const dialog = screen.getByRole("dialog");
    await user.click(
      Array.from(dialog.querySelectorAll("button")).find(
        (b) => b.textContent === "Zresetuj sejf",
      )!,
    );
    expect(await screen.findByText("Nie ustawiony")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Obecne hasło główne"),
    ).not.toBeInTheDocument();

    // Sejf znów istnieje (np. ustawiony od nowa): formularz startuje pusty
    zSejfem();
    createVault.mockResolvedValue({ ok: true, generation: 1 });
    await user.click(screen.getByRole("button", { name: "Ustaw sejf" }));
    await user.type(
      screen.getByLabelText("Hasło główne"),
      "Dobre-haslo-glowne-1",
    );
    await user.type(screen.getByLabelText("Powtórz"), "Dobre-haslo-glowne-1");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Utwórz sejf" }));
    expect(await screen.findByLabelText("Obecne hasło główne")).toHaveValue("");
    expect(screen.getByLabelText("Nowe hasło główne")).toHaveValue("");
    expect(screen.getByLabelText("Powtórz nowe hasło")).toHaveValue("");
  }, 60000);

  it("Zablokuj teraz: widoczny po odblokowaniu, klik blokuje", async () => {
    const user = userEvent.setup();
    zSejfem();
    await zamontuj();
    expect(
      screen.queryByRole("button", { name: "Zablokuj teraz" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Zablokowany")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "test-odblokuj" }));
    const zablokuj = await screen.findByRole("button", {
      name: "Zablokuj teraz",
    });
    expect(screen.getByText("Odblokowany")).toBeInTheDocument();

    await user.click(zablokuj);
    expect(await screen.findByText("Zablokowany")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Zablokuj teraz" }),
    ).not.toBeInTheDocument();
  }, 60000);

  it("ładowanie: Wczytywanie…, bez formularzy", async () => {
    getVault.mockReturnValue(new Promise(() => {}));
    await zamontuj();
    expect(screen.getByText("Wczytywanie…")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Obecne hasło główne"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ustaw sejf" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Zresetuj sejf" }),
    ).not.toBeInTheDocument();
  });

  it("nieobsługiwany: alert, bez formularzy", async () => {
    vi.mocked(webCryptoAvailable).mockReturnValue(false);
    zSejfem();
    await zamontuj();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sejf wymaga nowoczesnej przeglądarki i połączenia HTTPS.",
    );
    expect(
      screen.queryByLabelText("Obecne hasło główne"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Ustaw sejf" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Zresetuj sejf" }),
    ).not.toBeInTheDocument();
  });
});
