import * as React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const vault = vi.hoisted(() => ({ setup: vi.fn() }));
vi.mock("./vault-provider", () => ({ useVault: () => ({ status: "brak", setup: vault.setup }) }));

import { VaultSetup } from "./vault-setup";

describe("VaultSetup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("pola hasła mają type=password i autocomplete=new-password", () => {
    render(<VaultSetup onCancel={() => {}} />);
    for (const nazwa of ["Hasło główne", "Powtórz"]) {
      const pole = screen.getByLabelText(nazwa);
      expect(pole).toHaveAttribute("type", "password");
      expect(pole).toHaveAttribute("autocomplete", "new-password");
    }
    const pole = screen.getByLabelText("Hasło główne");
    // Ukryta nazwa użytkownika: menedżer haseł zapisuje hasło główne pod osobnym wpisem, nie pod kontem
    const uzytkownik = pole.closest("form")!.querySelector('input[autocomplete="username"]');
    expect(uzytkownik).not.toBeNull();
    expect(uzytkownik).toHaveValue("Sejf rhytm (hasło główne)");
    expect(uzytkownik).toHaveAttribute("readonly");
    expect(uzytkownik).toHaveAttribute("hidden");
    expect(uzytkownik).toHaveAttribute("aria-hidden", "true");
    expect(uzytkownik).toHaveAttribute("tabindex", "-1");
  });

  it("miernik: etykiety 5 stanów i 4 segmenty", async () => {
    const user = userEvent.setup();
    render(<VaultSetup onCancel={() => {}} />);
    expect(screen.getByText("Za krótkie")).toBeInTheDocument();
    const pole = screen.getByLabelText("Hasło główne");
    await user.type(pole, "abcdefghijkl");
    expect(screen.getByText("Słabe")).toBeInTheDocument();
    await user.clear(pole);
    await user.type(pole, "abcdefghijk1");
    expect(screen.getByText("Średnie")).toBeInTheDocument();
    await user.clear(pole);
    await user.type(pole, "abcdefghijL1");
    expect(screen.getByText("Mocne")).toBeInTheDocument();
    await user.clear(pole);
    await user.type(pole, "abcdefghijklmnoP1");
    expect(screen.getByText("Bardzo mocne")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-segment]")).toHaveLength(4);
  });

  it("próg „Mocne”: hasło „Średnie” nie pozwala utworzyć sejfu", async () => {
    const user = userEvent.setup();
    render(<VaultSetup onCancel={() => {}} />);
    await user.type(screen.getByLabelText("Hasło główne"), "abcdefghijk1");
    await user.type(screen.getByLabelText("Powtórz"), "abcdefghijk1");
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByText("Średnie")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Utwórz sejf" })).toBeDisabled();
    await user.clear(screen.getByLabelText("Hasło główne"));
    await user.clear(screen.getByLabelText("Powtórz"));
    await user.type(screen.getByLabelText("Hasło główne"), "abcdefghijL1");
    await user.type(screen.getByLabelText("Powtórz"), "abcdefghijL1");
    expect(screen.getByText("Mocne")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Utwórz sejf" })).toBeEnabled();
  });

  it("wysłanie: setup dostaje hasło, a pola są czyszczone", async () => {
    const user = userEvent.setup();
    vault.setup.mockResolvedValue({ ok: true });
    render(<VaultSetup onCancel={() => {}} />);
    await user.type(screen.getByLabelText("Hasło główne"), "Dobre-haslo-glowne-1");
    await user.type(screen.getByLabelText("Powtórz"), "Dobre-haslo-glowne-1");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Utwórz sejf" }));
    expect(vault.setup).toHaveBeenCalledWith("Dobre-haslo-glowne-1");
    await waitFor(() => expect(screen.getByLabelText("Hasło główne")).toHaveValue(""));
    expect(screen.getByLabelText("Powtórz")).toHaveValue("");
  });

  it("błąd z providera pokazany dosłownie", async () => {
    const user = userEvent.setup();
    vault.setup.mockResolvedValue({ ok: false, message: "Nie udało się połączyć z sejfem. Spróbuj ponownie." });
    render(<VaultSetup onCancel={() => {}} />);
    await user.type(screen.getByLabelText("Hasło główne"), "Dobre-haslo-glowne-1");
    await user.type(screen.getByLabelText("Powtórz"), "Dobre-haslo-glowne-1");
    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Utwórz sejf" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się połączyć z sejfem. Spróbuj ponownie.");
  });

  it("Anuluj wywołuje onCancel; okno bez ✕ (S2VaultSetup)", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(<VaultSetup onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Zamknij" })).not.toBeInTheDocument();
  });

  it("teksty okna webu z S2VaultSetup: opis, ostrzeżenie przed polami, fokus w „Hasło główne”", () => {
    render(<VaultSetup onCancel={() => {}} />);
    expect(screen.getByText("Szyfruje hasła i notatki w przeglądarce. My go nie znamy i nie widzimy Twoich sekretów.")).toBeInTheDocument();
    const ostrzezenie = screen.getByText(/Użyj innego hasła niż do konta\. Zapomnianego hasła głównego/);
    expect(ostrzezenie).toHaveTextContent("Użyj innego hasła niż do konta. Zapomnianego hasła głównego nie da się odzyskać.");
    expect(ostrzezenie.compareDocumentPosition(screen.getByLabelText("Hasło główne")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByLabelText("Hasło główne")).toHaveFocus();
  });

  describe("ekran telefonu (CMVaultSetup)", () => {
    it("teksty makiety: tytuł, opis, ostrzeżenie, zgoda; pola new-password; „Anuluj” to link do /strony", () => {
      render(<VaultSetup ekran onCancel={() => {}} />);
      expect(screen.getByRole("heading", { level: 2, name: "Ustaw hasło główne sejfu" })).toBeInTheDocument();
      expect(screen.getByRole("form", { name: "Ustaw hasło główne sejfu" })).toBeInTheDocument();
      expect(screen.getByText("Hasło główne szyfruje moduł Hasła i pola „Sekret” na Twoim urządzeniu.")).toBeInTheDocument();
      expect(screen.getByText("Hasło tylko do sejfu!")).toBeInTheDocument();
      expect(screen.getByText(/Nie używaj hasła do konta\. Nie da się go odzyskać\./)).toBeInTheDocument();
      expect(screen.getByRole("checkbox", { name: "Rozumiem, że zapomnianego hasła głównego nie da się odzyskać." })).toBeInTheDocument();
      for (const nazwa of ["Hasło główne", "Powtórz"]) {
        const pole = screen.getByLabelText(nazwa);
        expect(pole).toHaveAttribute("type", "password");
        expect(pole).toHaveAttribute("autocomplete", "new-password");
        expect(pole).not.toHaveAttribute("name");
      }
      expect(screen.getByRole("link", { name: "Anuluj" })).toHaveAttribute("href", "/strony");
      expect(screen.getByRole("button", { name: "Utwórz sejf" })).toBeDisabled();
    });

    it("miernik: 4 paski i podpis z tych samych progów co web; puste pole podaje wymaganie", async () => {
      const user = userEvent.setup();
      render(<VaultSetup ekran onCancel={() => {}} />);
      expect(screen.getByText("Min. „Mocne”, 12+ znaków.")).toBeInTheDocument();
      expect(document.querySelectorAll("[data-segment]")).toHaveLength(4);
      const pole = screen.getByLabelText("Hasło główne");
      await user.type(pole, "abcdefghijk1");
      expect(screen.getByText("Średnie")).toBeInTheDocument();
      await user.clear(pole);
      await user.type(pole, "abcdefghijL1");
      expect(screen.getByText("Mocne")).toBeInTheDocument();
    });

    it("„Hasła się różnią.”, a „Utwórz sejf” czeka na „Mocne”, zgodność i zgodę", async () => {
      const user = userEvent.setup();
      render(<VaultSetup ekran onCancel={() => {}} />);
      await user.type(screen.getByLabelText("Hasło główne"), "Dobre-haslo-glowne-1");
      await user.type(screen.getByLabelText("Powtórz"), "Dobre-haslo-glowne-2");
      expect(screen.getByText("Hasła się różnią.")).toBeInTheDocument();
      await user.clear(screen.getByLabelText("Powtórz"));
      await user.type(screen.getByLabelText("Powtórz"), "Dobre-haslo-glowne-1");
      expect(screen.getByRole("button", { name: "Utwórz sejf" })).toBeDisabled();
      await user.click(screen.getByRole("checkbox"));
      expect(screen.getByRole("button", { name: "Utwórz sejf" })).toBeEnabled();
    });

    it("wysłanie: setup dostaje hasło, pola są czyszczone, błąd z providera dosłownie", async () => {
      const user = userEvent.setup();
      vault.setup.mockResolvedValue({ ok: false, message: "Nie udało się połączyć z sejfem. Spróbuj ponownie." });
      render(<VaultSetup ekran onCancel={() => {}} />);
      await user.type(screen.getByLabelText("Hasło główne"), "Dobre-haslo-glowne-1");
      await user.type(screen.getByLabelText("Powtórz"), "Dobre-haslo-glowne-1");
      await user.click(screen.getByRole("checkbox"));
      await user.click(screen.getByRole("button", { name: "Utwórz sejf" }));
      expect(vault.setup).toHaveBeenCalledWith("Dobre-haslo-glowne-1");
      expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się połączyć z sejfem. Spróbuj ponownie.");
      await waitFor(() => expect(screen.getByLabelText("Hasło główne")).toHaveValue(""));
      expect(screen.getByLabelText("Powtórz")).toHaveValue("");
    });
  });
});
