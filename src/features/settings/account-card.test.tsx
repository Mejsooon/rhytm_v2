import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestEmailChange } = vi.hoisted(() => ({
  requestEmailChange: vi.fn(),
}));
vi.mock("./account-actions", () => ({ requestEmailChange }));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

import { AccountCard } from "./account-card";

const bazowe = {
  email: "ala@example.com",
  newEmail: null,
  hasPassword: true,
  passwordChangedAt: null,
  sessionLabel: "Chrome · Linux",
  emailConfirmed: false,
  timeZone: "Europe/Warsaw",
};

describe("AccountCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestEmailChange.mockResolvedValue({ ok: true });
  });

  it("podpis e-maila bez newEmail", () => {
    render(<AccountCard {...bazowe} />);
    expect(
      screen.getByText("ala@example.com · potwierdzony"),
    ).toBeInTheDocument();
  });

  it("podpis e-maila z newEmail", () => {
    render(<AccountCard {...bazowe} newEmail="nowy@example.com" />);
    expect(
      screen.getByText(
        "ala@example.com · link potwierdzający wysłany na nowy@example.com",
      ),
    ).toBeInTheDocument();
  });

  it("„Zmień” otwiera pole z „Wyślij link” i „Anuluj”, „Anuluj” je zamyka", async () => {
    const user = userEvent.setup();
    render(<AccountCard {...bazowe} />);
    await user.click(screen.getByRole("button", { name: "Zmień" }));
    expect(screen.getByPlaceholderText("nowy@adres.pl")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Wyślij link" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByPlaceholderText("nowy@adres.pl")).toBeNull();
    expect(screen.getByRole("button", { name: "Zmień" })).toBeInTheDocument();
  });

  it("zły adres → komunikat bez wywołania akcji", async () => {
    const user = userEvent.setup();
    render(<AccountCard {...bazowe} />);
    await user.click(screen.getByRole("button", { name: "Zmień" }));
    await user.type(screen.getByPlaceholderText("nowy@adres.pl"), "abc");
    await user.click(screen.getByRole("button", { name: "Wyślij link" }));
    expect(
      screen.getByText("To nie wygląda na adres e-mail."),
    ).toBeInTheDocument();
    expect(requestEmailChange).not.toHaveBeenCalled();
  });

  it("sukces → podpis z nowym adresem i dopisek o obu wiadomościach", async () => {
    const user = userEvent.setup();
    render(<AccountCard {...bazowe} />);
    await user.click(screen.getByRole("button", { name: "Zmień" }));
    await user.type(
      screen.getByPlaceholderText("nowy@adres.pl"),
      "Nowy@Example.com",
    );
    await user.click(screen.getByRole("button", { name: "Wyślij link" }));
    await waitFor(() =>
      expect(
        screen.getByText(
          "ala@example.com · link potwierdzający wysłany na nowy@example.com",
        ),
      ).toBeInTheDocument(),
    );
    expect(requestEmailChange).toHaveBeenCalledWith("Nowy@Example.com");
    expect(
      screen.getByText(
        "Kliknij link w obu wiadomościach: na obecnym i na nowym adresie.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("nowy@adres.pl")).toBeNull();
  });

  it("błąd akcji jest pokazany, pole zostaje", async () => {
    requestEmailChange.mockResolvedValue({
      ok: false,
      message: "Ten adres jest już zajęty.",
    });
    const user = userEvent.setup();
    render(<AccountCard {...bazowe} />);
    await user.click(screen.getByRole("button", { name: "Zmień" }));
    await user.type(
      screen.getByPlaceholderText("nowy@adres.pl"),
      "zajety@example.com",
    );
    await user.click(screen.getByRole("button", { name: "Wyślij link" }));
    expect(
      await screen.findByText("Ten adres jest już zajęty."),
    ).toBeInTheDocument();
    expect(screen.getByPlaceholderText("nowy@adres.pl")).toBeInTheDocument();
  });

  it("konto Google: bez „Zmień”, podpis „konto Google”, „Ustaw hasło”", () => {
    render(<AccountCard {...bazowe} hasPassword={false} />);
    expect(screen.queryByRole("button", { name: "Zmień" })).toBeNull();
    expect(
      screen.getByText("ala@example.com · konto Google"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("brak — logujesz się przez Google"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ustaw hasło" })).toHaveAttribute(
      "href",
      "/ustawienia/konto",
    );
  });

  it("hasło: data zmiany albo „ustawione przy rejestracji”", () => {
    const { unmount } = render(
      <AccountCard {...bazowe} passwordChangedAt="2026-11-15T10:00:00Z" />,
    );
    expect(screen.getByText("zmienione 15.11.2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Zmień hasło" })).toHaveAttribute(
      "href",
      "/ustawienia/konto",
    );
    unmount();
    render(<AccountCard {...bazowe} />);
    expect(screen.getByText("ustawione przy rejestracji")).toBeInTheDocument();
  });

  it("wiersz Sesja: plakietka „Aktywna”, podpis i „Wyloguj”", () => {
    render(<AccountCard {...bazowe} />);
    expect(screen.getByText("Aktywna")).toBeInTheDocument();
    expect(screen.getByText("Chrome · Linux · teraz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wyloguj" })).toBeInTheDocument();
  });

  it("?email=potwierdzono → komunikat; z newEmail prosi o drugi link", () => {
    const { unmount } = render(<AccountCard {...bazowe} emailConfirmed />);
    expect(screen.getByText("Link potwierdzony.")).toBeInTheDocument();
    unmount();
    render(
      <AccountCard {...bazowe} emailConfirmed newEmail="nowy@example.com" />,
    );
    expect(
      screen.getByText(
        "Link potwierdzony. Kliknij jeszcze link na drugim adresie.",
      ),
    ).toBeInTheDocument();
  });
});
