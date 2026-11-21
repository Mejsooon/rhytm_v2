import * as React from "react";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getVault, createVault, rewrapVaultAction, resetVault, countSecrets } = vi.hoisted(() => ({
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

import { createVaultMaterial, unwrapDataKey, type VaultMaterial } from "@/features/vault/crypto";
import { VaultProvider } from "@/features/vault/vault-provider";
import { VaultCard } from "./vault-card";

const STARE = "Stare-haslo-glowne-1";
const NOWE = "Nowe-haslo-glowne-22";
let material: VaultMaterial;

function zSejfem() {
  getVault.mockResolvedValue({
    ok: true,
    vault: { ...material, generation: 1, created_at: "2026-11-21T10:00:00Z", updated_at: "2026-11-21T10:00:00Z" },
  });
}

async function zamontuj() {
  render(
    <VaultProvider>
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
});

describe("VaultCard", () => {
  it("bez sejfu: Ustaw sejf", async () => {
    const user = userEvent.setup();
    getVault.mockResolvedValue({ ok: true, vault: null });
    await zamontuj();
    expect(screen.getByText("Nie ustawiony")).toBeInTheDocument();
    expect(screen.queryByText("Zmień hasło główne")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Zresetuj sejf" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Ustaw sejf" }));
    expect(screen.getByText("Ustaw hasło główne sejfu")).toBeInTheDocument();
    // „Anuluj” wraca do karty ze stanem
    await user.click(screen.getAllByRole("button", { name: "Anuluj" })[0]);
    expect(screen.getByRole("button", { name: "Ustaw sejf" })).toBeInTheDocument();
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
    // Zablokowany: bez „Zablokuj teraz”
    expect(screen.queryByRole("button", { name: "Zablokuj teraz" })).not.toBeInTheDocument();
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
    await user.type(screen.getByLabelText("Obecne hasło główne"), "zle-haslo-glowne-9");
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
    expect(await screen.findByText("Nieprawidłowe hasło główne.")).toBeInTheDocument();
    expect(rewrapVaultAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Obecne hasło główne")).toHaveValue("");
    expect(screen.getByLabelText("Nowe hasło główne")).toHaveValue("");
    expect(screen.getByLabelText("Powtórz nowe hasło")).toHaveValue("");

    // Dobre obecne hasło: sukces
    await user.type(screen.getByLabelText("Obecne hasło główne"), STARE);
    await user.type(screen.getByLabelText("Nowe hasło główne"), NOWE);
    await user.type(screen.getByLabelText("Powtórz nowe hasło"), NOWE);
    await user.click(screen.getByRole("button", { name: "Zmień hasło" }));
    expect(await screen.findByText("Hasło główne zmienione.")).toBeInTheDocument();
    expect(screen.queryByText("Nieprawidłowe hasło główne.")).not.toBeInTheDocument();
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
    const zresetuj = Array.from(dialog.querySelectorAll("button")).find((b) => b.textContent === "Zresetuj sejf")!;
    // Bez słowa RESETUJ reset nie rusza
    await user.click(zresetuj);
    expect(resetVault).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Wpisz RESETUJ, żeby potwierdzić"), "RESETUJ");
    await user.click(zresetuj);
    await waitFor(() => expect(resetVault).toHaveBeenCalledTimes(1));
    // Po resecie karta wraca do stanu bez sejfu
    expect(await screen.findByText("Nie ustawiony")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ustaw sejf" })).toBeInTheDocument();
  });
});
