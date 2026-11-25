import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const vault = vi.hoisted(() => ({ unlock: vi.fn() }));
vi.mock("./vault-provider", () => ({ useVault: () => ({ status: "zablokowany", unlock: vault.unlock }) }));
vi.mock("./actions", () => ({ countSecrets: vi.fn().mockResolvedValue({ ok: true, count: 1 }) }));

import { VaultUnlockCard } from "./vault-unlock-card";

describe("VaultUnlockCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("teksty z makiety, pole current-password", () => {
    render(<VaultUnlockCard />);
    expect(screen.getByText("Hasło główne sejfu, nie hasło do konta.")).toBeInTheDocument();
    expect(screen.getByText("Blokada po 5 min bezczynności.")).toBeInTheDocument();
    const pole = screen.getByLabelText("Hasło główne");
    expect(pole).toHaveAttribute("type", "password");
    expect(pole).toHaveAttribute("autocomplete", "current-password");
    // Ukryta nazwa użytkownika: menedżer haseł zapisuje hasło główne pod osobnym wpisem, nie pod kontem
    const uzytkownik = pole.closest("form")!.querySelector('input[autocomplete="username"]');
    expect(uzytkownik).not.toBeNull();
    expect(uzytkownik).toHaveValue("Sejf rhytm (hasło główne)");
    expect(uzytkownik).toHaveAttribute("readonly");
    expect(uzytkownik).toHaveAttribute("hidden");
    expect(uzytkownik).toHaveAttribute("aria-hidden", "true");
    expect(uzytkownik).toHaveAttribute("tabindex", "-1");
  });

  it("okno dialogowe z nazwą „Odblokuj sejf”, pole hasła ma fokus", () => {
    render(<VaultUnlockCard />);
    const okno = screen.getByRole("dialog", { name: "Odblokuj sejf" });
    expect(okno).not.toHaveAttribute("aria-modal");
    expect(screen.getByLabelText("Hasło główne")).toHaveFocus();
  });

  it("puste hasło: Wpisz hasło główne., bez wywołania unlock", async () => {
    const user = userEvent.setup();
    render(<VaultUnlockCard />);
    await user.click(screen.getByRole("button", { name: "Odblokuj" }));
    expect(screen.getByText("Wpisz hasło główne.")).toBeInTheDocument();
    expect(screen.getByLabelText("Hasło główne")).toHaveAttribute("aria-invalid", "true");
    expect(vault.unlock).not.toHaveBeenCalled();
  });

  it("złe hasło: komunikat z providera pod polem, pole wyczyszczone", async () => {
    const user = userEvent.setup();
    vault.unlock.mockResolvedValue({ ok: false, message: "Nieprawidłowe hasło główne." });
    render(<VaultUnlockCard />);
    const pole = screen.getByLabelText("Hasło główne");
    await user.type(pole, "zle-haslo{Enter}");
    expect(vault.unlock).toHaveBeenCalledWith("zle-haslo");
    expect(await screen.findByText("Nieprawidłowe hasło główne.")).toBeInTheDocument();
    await waitFor(() => expect(pole).toHaveValue(""));
    expect(pole).toHaveAttribute("aria-describedby");
  });

  describe("ekran telefonu (CMVault)", () => {
    it("teksty z makiety bez biometrii, pole current-password, link do resetu", () => {
      render(<VaultUnlockCard ekran />);
      expect(screen.getByRole("heading", { level: 1, name: "Sejf jest zablokowany" })).toBeInTheDocument();
      expect(
        screen.getByText(
          "Hasła są szyfrowane na urządzeniu. Klucz zostaje tylko w pamięci tej karty. Blokada po 5 min bezczynności.",
        ),
      ).toBeInTheDocument();
      const pole = screen.getByLabelText("Hasło główne");
      expect(pole).toHaveAttribute("type", "password");
      // Fokus po „Zablokuj sejf” ląduje w polu hasła (przycisk znika razem z listą)
      expect(pole).toHaveFocus();
      expect(pole).toHaveAttribute("autocomplete", "current-password");
      expect(pole.closest("form")!.querySelector('input[autocomplete="username"]')).toHaveAttribute("hidden");
      expect(screen.queryByText(/biometri/i)).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Nie pamiętam hasła — zresetuj sejf" })).toBeInTheDocument();
    });

    it("puste hasło: alert „Wpisz hasło główne.”, bez wywołania unlock", async () => {
      const user = userEvent.setup();
      render(<VaultUnlockCard ekran />);
      await user.click(screen.getByRole("button", { name: "Odblokuj" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Wpisz hasło główne.");
      expect(screen.getByLabelText("Hasło główne")).toHaveAttribute("aria-invalid", "true");
      expect(vault.unlock).not.toHaveBeenCalled();
    });

    it("hasło idzie do unlock i pole jest czyszczone; zły wynik pokazuje komunikat", async () => {
      const user = userEvent.setup();
      vault.unlock.mockResolvedValue({ ok: false, message: "Nieprawidłowe hasło główne." });
      render(<VaultUnlockCard ekran />);
      const pole = screen.getByLabelText("Hasło główne");
      await user.type(pole, "zle-haslo{Enter}");
      expect(vault.unlock).toHaveBeenCalledWith("zle-haslo");
      expect(await screen.findByRole("alert")).toHaveTextContent("Nieprawidłowe hasło główne.");
      await waitFor(() => expect(pole).toHaveValue(""));
    });

    it("link do resetu otwiera arkusz „Zresetować sejf?”", async () => {
      const user = userEvent.setup();
      render(<VaultUnlockCard ekran />);
      await user.click(screen.getByRole("button", { name: "Nie pamiętam hasła — zresetuj sejf" }));
      expect(await screen.findByRole("dialog", { name: "Zresetować sejf?" })).toBeInTheDocument();
    });
  });
});
