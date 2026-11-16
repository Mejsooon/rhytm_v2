import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: () => <input type="hidden" name="cf-turnstile-response" value="token" />,
}));

vi.mock("./actions", () => ({
  requestPasswordReset: vi.fn(async () => ({ status: "success", email: "ala@przyklad.pl" })),
  resendLink: vi.fn(async () => ({ status: "success" })),
}));

import { requestPasswordReset, resendLink } from "./actions";
import { ResetSteps } from "./reset-steps";

describe("ResetSteps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("krok 1: znacznik „krok 1 / 3”, pole e-mail i „Wyślij link”", () => {
    render(<ResetSteps />);
    expect(screen.getByText("krok 1 / 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Nie pamiętasz hasła\?/ })).toBeInTheDocument();
    expect(screen.getByLabelText("E-mail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Wyślij link" })).toBeInTheDocument();
  });

  it("po sukcesie akcji krok 2 z neutralnym tekstem, powrotem do logowania i „Wyślij ponownie”", async () => {
    const user = userEvent.setup();
    render(<ResetSteps />);
    await user.type(screen.getByLabelText("E-mail"), "ala@przyklad.pl");
    await user.click(screen.getByRole("button", { name: "Wyślij link" }));

    expect(await screen.findByText("krok 2 / 3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sprawdź skrzynkę" })).toBeInTheDocument();
    expect(screen.getByText("Jeśli konto istnieje, link do zmiany hasła jest już w drodze.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Wróć do logowania" })).toHaveAttribute("href", "/logowanie");
    // Odliczanie z CheckInbox: przycisk nieaktywny, dopóki nie minie 60 s
    expect(screen.getByRole("button", { name: /Wyślij ponownie/ })).toBeDisabled();
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
  });

  it("„Wyślij ponownie” po odliczaniu woła resendLink(recovery, e-mail)", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<ResetSteps />);
    await user.type(screen.getByLabelText("E-mail"), "ala@przyklad.pl");
    await user.click(screen.getByRole("button", { name: "Wyślij link" }));
    await screen.findByText("krok 2 / 3");
    for (let i = 0; i < 60; i++) await act(async () => void vi.advanceTimersByTime(1000));
    await user.click(screen.getByRole("button", { name: /Wyślij ponownie/ }));
    expect(resendLink).toHaveBeenCalledWith("recovery", "ala@przyklad.pl", "token");
    vi.useRealTimers();
  });
});
