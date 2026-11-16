import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: () => <input type="hidden" name="cf-turnstile-response" value="tok" />,
}));

import { CheckInbox } from "./check-inbox";

// Licznik przestawia kolejny timeout dopiero po renderze — przesuwamy czas po 1 s, każdy krok w act
function uplyw(sekundy: number) {
  for (let i = 0; i < sekundy; i++) act(() => void vi.advanceTimersByTime(1000));
}

describe("CheckInbox", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("pokazuje tekst z makiety (bez adresu e-mail)", () => {
    render(<CheckInbox email="ala@przyklad.pl" onResend={async () => {}} />);
    expect(screen.getByRole("heading", { name: "Sprawdź skrzynkę" })).toBeInTheDocument();
    expect(
      screen.getByText("Jeśli adres jest poprawny, wysłaliśmy na niego link potwierdzający. Link wygasa po 1 godzinie."),
    ).toBeInTheDocument();
    expect(screen.queryByText("ala@przyklad.pl")).not.toBeInTheDocument();
  });

  it("„Wyślij ponownie” jest nieaktywny z licznikiem 0:59 po 1 s, aktywny po 60 s", () => {
    render(<CheckInbox email="a@b.pl" onResend={async () => {}} />);
    const przycisk = screen.getByRole("button", { name: /Wyślij ponownie/ });
    expect(przycisk).toBeDisabled();
    uplyw(1);
    expect(przycisk).toHaveTextContent("0:59");
    uplyw(59);
    expect(przycisk).toBeEnabled();
    expect(przycisk).not.toHaveTextContent("0:");
  });

  it("klik woła onResend i znowu startuje odliczanie", async () => {
    const onResend = vi.fn(async () => {});
    render(<CheckInbox email="a@b.pl" onResend={onResend} />);
    uplyw(60);
    const przycisk = screen.getByRole("button", { name: /Wyślij ponownie/ });
    await act(async () => przycisk.click());
    expect(onResend).toHaveBeenCalledTimes(1);
    // Token Turnstile z formularza trafia do onResend
    expect(onResend).toHaveBeenCalledWith("tok");
    expect(przycisk).toBeDisabled();
    uplyw(1);
    expect(przycisk).toHaveTextContent("0:59");
  });

  it("respektuje własny cooldownSeconds", () => {
    render(<CheckInbox email="a@b.pl" onResend={async () => {}} cooldownSeconds={5} />);
    uplyw(5);
    expect(screen.getByRole("button", { name: /Wyślij ponownie/ })).toBeEnabled();
  });
});
