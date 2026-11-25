import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: () => (
    <input type="hidden" name="cf-turnstile-response" value="token" />
  ),
}));

vi.mock("./actions", () => ({
  requestPasswordReset: vi.fn(async () => ({
    status: "success",
    email: "ala@przyklad.pl",
  })),
  resendLink: vi.fn(async () => ({ status: "success" })),
}));

import { requestPasswordReset, resendLink } from "./actions";
import { ResetSteps } from "./reset-steps";

describe("ResetSteps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("krok 1: znacznik „krok 1 / 3”, pole e-mail i „Wyślij link”", () => {
    render(<ResetSteps />);
    expect(screen.getByText("krok 1 / 3")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Nie pamiętasz hasła\?/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Wyślij link" }),
    ).toBeInTheDocument();
  });

  it("po sukcesie akcji krok 2 z neutralnym tekstem, powrotem do logowania i „Wyślij ponownie”", async () => {
    const user = userEvent.setup();
    render(<ResetSteps />);
    await user.type(screen.getByLabelText("E-mail"), "ala@przyklad.pl");
    await user.click(screen.getByRole("button", { name: "Wyślij link" }));

    expect(await screen.findByText("krok 2 / 3")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sprawdź skrzynkę" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Jeśli konto z tym adresem istnieje, wysłaliśmy link\./),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Wróć do logowania" }),
    ).toHaveAttribute("href", "/logowanie");
    // Odliczanie z CheckInbox: przycisk nieaktywny, dopóki nie minie 60 s
    expect(
      screen.getByRole("button", { name: /Wyślij ponownie/ }),
    ).toBeDisabled();
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  it("„Wyślij ponownie” po odliczaniu woła resendLink(recovery, e-mail)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResetSteps />);
    await user.type(screen.getByLabelText("E-mail"), "ala@przyklad.pl");
    await user.click(screen.getByRole("button", { name: "Wyślij link" }));
    await screen.findByText("krok 2 / 3");
    // Odliczanie to łańcuch setTimeout (każdy kolejny powstaje po renderze) — przesuwamy czas, aż przycisk się odblokuje
    const ponownie = screen.getByRole("button", { name: /Wyślij ponownie/ });
    for (let i = 0; i < 90 && ponownie.hasAttribute("disabled"); i++) {
      await act(async () => void vi.advanceTimersByTime(1000));
    }
    expect(ponownie).toBeEnabled();
    await user.click(ponownie);
    await vi.waitFor(() =>
      expect(resendLink).toHaveBeenCalledWith(
        "recovery",
        "ala@przyklad.pl",
        "token",
      ),
    );
    vi.useRealTimers();
  });

  it("błąd resendLink (np. Turnstile) → komunikat w role=alert, licznik nie startuje od nowa", async () => {
    vi.mocked(resendLink).mockResolvedValueOnce({
      status: "error",
      message: "Potwierdź, że nie jesteś botem",
    });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResetSteps />);
    await user.type(screen.getByLabelText("E-mail"), "ala@przyklad.pl");
    await user.click(screen.getByRole("button", { name: "Wyślij link" }));
    await screen.findByText("krok 2 / 3");
    const ponownie = screen.getByRole("button", { name: /Wyślij ponownie/ });
    for (let i = 0; i < 90 && ponownie.hasAttribute("disabled"); i++) {
      await act(async () => void vi.advanceTimersByTime(1000));
    }
    await user.click(ponownie);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Potwierdź, że nie jesteś botem",
    );
    expect(ponownie).toBeEnabled();
    vi.useRealTimers();
  });

  it("reset: progress 3 segmenty i stopka ‹ Wróć do logowania w pasku stopki", async () => {
    const user = userEvent.setup();
    render(<ResetSteps />);
    const pasek = screen.getByTestId("auth-progress");
    expect(pasek.children).toHaveLength(3);
    // Krok 1: jeden segment wypełniony
    expect(pasek.children[0]).toHaveClass("bg-foreground");
    expect(pasek.children[1]).toHaveClass("bg-border");
    const wroc = screen.getByRole("link", { name: "Wróć do logowania" });
    expect(wroc).toHaveAttribute("href", "/logowanie");
    expect(wroc.closest(".border-t")).not.toBeNull();
    expect(wroc.closest(".border-t")).toHaveClass("bg-black/[.025]");

    await user.type(screen.getByLabelText("E-mail"), "ala@przyklad.pl");
    await user.click(screen.getByRole("button", { name: "Wyślij link" }));
    await screen.findByText("krok 2 / 3");
    // Krok 2: dwa segmenty wypełnione
    const pasek2 = screen.getByTestId("auth-progress");
    expect(pasek2.children[1]).toHaveClass("bg-foreground");
    expect(pasek2.children[2]).toHaveClass("bg-border");
  });

  it("reset: bez font-mono, nagłówek wyśrodkowany 20 px/600 (krok 1)", () => {
    const { container } = render(<ResetSteps />);
    expect(container.querySelector(".font-mono")).toBeNull();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1).toHaveClass("text-xl", "font-semibold");
    expect(h1).not.toHaveClass("text-[22px]");
    expect(screen.getByRole("button", { name: "Wyślij link" })).toHaveClass("h-9");
  });

  it("telefon (CMForgot): w kroku 1 opis z ważnością 1 godziny, stopka tylko na webie, formularz jako karta", () => {
    const { container } = render(<ResetSteps />);
    expect(screen.getByText("Link działa 1 godzinę.")).toHaveClass(
      "min-[800px]:hidden",
    );
    expect(container.querySelector("form")).toHaveClass("max-[799px]:m-auth-card");
    // Stopka z „Wróć do logowania” nie zostawia pustego kontenera na telefonie
    expect(
      screen.getByRole("link", { name: "Wróć do logowania" }).parentElement,
    ).toHaveClass("max-[799px]:hidden");
  });
});
