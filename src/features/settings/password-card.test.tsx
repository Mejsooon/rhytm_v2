import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { changePassword, sendSetPasswordLink } = vi.hoisted(() => ({
  changePassword: vi.fn(),
  sendSetPasswordLink: vi.fn(),
}));
vi.mock("./account-actions", () => ({ changePassword, sendSetPasswordLink }));

import { PasswordCard } from "./password-card";

function pola() {
  return {
    obecne: screen.getByLabelText("Obecne hasło"),
    nowe: screen.getByLabelText("Nowe hasło"),
    powtorz: screen.getByLabelText("Powtórz"),
  };
}
function wpisz(el: HTMLElement, wartosc: string) {
  fireEvent.change(el, { target: { value: wartosc } });
}
function stopka() {
  return screen.getByRole("status");
}
function przycisk() {
  return screen.getByRole("button", { name: "Zmień hasło" });
}
// Kolory 4 pasków siły (style.background)
function paski() {
  return Array.from(
    screen.getByTestId("paski-sily").querySelectorAll("span"),
  ).map((s) => s.style.background);
}

const SZARY = "rgba(0, 0, 0, 0.08)";

describe("PasswordCard — konto z hasłem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    changePassword.mockResolvedValue({ ok: true });
  });

  it("stan pusty: podpis siły, komunikat i nieaktywny przycisk", () => {
    render(<PasswordCard hasPassword email="ala@example.com" />);
    expect(
      screen.getByRole("heading", { name: "Zmień hasło do konta" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Hasło do konta nie otwiera sejfu."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("10+ znaków, wielka litera, cyfra, znak"),
    ).toBeInTheDocument();
    expect(stopka()).toHaveTextContent(
      "Min. 10 znaków. Wylogujemy inne urządzenia.",
    );
    expect(przycisk()).toHaveAttribute("aria-disabled", "true");
    expect(paski()).toEqual([SZARY, SZARY, SZARY, SZARY]);
  });

  it.each([
    ["abc", "Za krótkie hasło", 0, ""],
    ["abcdefghij", "Słabe hasło", 1, "rgb(239, 68, 68)"],
    ["Abcdefghij", "Średnie hasło", 2, "rgb(245, 158, 11)"],
    ["Abcdefghi1", "Dobre hasło", 3, "rgb(234, 179, 8)"],
    ["Abcdefgh1!", "Mocne hasło", 4, "rgb(21, 128, 61)"],
  ])("siła „%s” → %s (%i pasków)", (haslo, podpis, ile, kolor) => {
    render(<PasswordCard hasPassword email="ala@example.com" />);
    wpisz(pola().nowe, haslo);
    expect(screen.getByText(podpis)).toBeInTheDocument();
    const p = paski();
    expect(p.filter((k) => k !== SZARY)).toHaveLength(ile);
    if (ile > 0) expect(p[0]).toBe(kolor);
  });

  it("komunikaty w stopce w kolejności z makiety", () => {
    render(<PasswordCard hasPassword email="ala@example.com" />);
    const { obecne, nowe, powtorz } = pola();
    wpisz(nowe, "x");
    expect(stopka()).toHaveTextContent("Wpisz obecne hasło.");
    wpisz(obecne, "Stare-Haslo-1");
    expect(stopka()).toHaveTextContent("Nowe hasło: min. 10 znaków.");
    wpisz(nowe, "Stare-Haslo-1");
    expect(stopka()).toHaveTextContent(
      "Nowe hasło musi różnić się od obecnego.",
    );
    wpisz(nowe, "Nowe-Haslo-22");
    expect(stopka()).toHaveTextContent("Hasła muszą być takie same.");
    wpisz(powtorz, "Nowe-Haslo-2");
    expect(screen.getByText("Hasła się różnią")).toBeInTheDocument();
    expect(powtorz).toHaveAttribute("aria-invalid", "true");
    expect(przycisk()).toHaveAttribute("aria-disabled", "true");
    wpisz(powtorz, "Nowe-Haslo-22");
    expect(screen.getByText("Hasła są takie same ✓")).toBeInTheDocument();
    expect(stopka()).toHaveTextContent("Gotowe — wylogujemy inne urządzenia.");
    expect(przycisk()).toHaveAttribute("aria-disabled", "false");
  });

  it("przycisk nieaktywny nie wywołuje akcji", () => {
    render(<PasswordCard hasPassword email="ala@example.com" />);
    fireEvent.click(przycisk());
    expect(changePassword).not.toHaveBeenCalled();
  });

  it("sukces czyści pola i pokazuje „Hasło zmienione ✓ …”", async () => {
    render(<PasswordCard hasPassword email="ala@example.com" />);
    const { obecne, nowe, powtorz } = pola();
    wpisz(obecne, "Stare-Haslo-1");
    wpisz(nowe, "Nowe-Haslo-22");
    wpisz(powtorz, "Nowe-Haslo-22");
    fireEvent.click(przycisk());
    await waitFor(() =>
      expect(stopka()).toHaveTextContent(
        "Hasło zmienione ✓ Inne urządzenia zostały wylogowane.",
      ),
    );
    expect(changePassword).toHaveBeenCalledWith({
      current: "Stare-Haslo-1",
      next: "Nowe-Haslo-22",
      repeat: "Nowe-Haslo-22",
    });
    expect(obecne).toHaveValue("");
    expect(nowe).toHaveValue("");
    expect(powtorz).toHaveValue("");
  });

  it("błąd akcji pokazany w stopce, pola zostają", async () => {
    changePassword.mockResolvedValue({
      ok: false,
      message: "Obecne hasło jest nieprawidłowe.",
    });
    render(<PasswordCard hasPassword email="ala@example.com" />);
    const { obecne, nowe, powtorz } = pola();
    wpisz(obecne, "Zle-Haslo-1");
    wpisz(nowe, "Nowe-Haslo-22");
    wpisz(powtorz, "Nowe-Haslo-22");
    fireEvent.click(przycisk());
    await waitFor(() =>
      expect(stopka()).toHaveTextContent("Obecne hasło jest nieprawidłowe."),
    );
    expect(obecne).toHaveValue("Zle-Haslo-1");
  });
});

describe("PasswordCard — konto Google", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendSetPasswordLink.mockResolvedValue({
      ok: true,
      email: "ala@example.com",
    });
  });

  it("„Ustaw hasło do konta” i „Wyślij link” → „Link wysłany na …”", async () => {
    render(<PasswordCard hasPassword={false} email="ala@example.com" />);
    expect(
      screen.getByRole("heading", { name: "Ustaw hasło do konta" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Logujesz się przez Google. Wyślemy link do ustawienia hasła na ala@example.com.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Obecne hasło")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Wyślij link" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Link wysłany na ala@example.com.",
      ),
    );
  });

  it("błąd wysyłki → komunikat", async () => {
    sendSetPasswordLink.mockResolvedValue({
      ok: false,
      message: "Nie udało się wysłać linku. Spróbuj ponownie.",
    });
    render(<PasswordCard hasPassword={false} email="ala@example.com" />);
    fireEvent.click(screen.getByRole("button", { name: "Wyślij link" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Nie udało się wysłać linku. Spróbuj ponownie.",
      ),
    );
  });
});
