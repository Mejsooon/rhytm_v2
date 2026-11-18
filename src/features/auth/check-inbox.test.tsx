import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: () => (
    <input type="hidden" name="cf-turnstile-response" value="tok" />
  ),
}));

import { CheckInbox } from "./check-inbox";

// Licznik przestawia kolejny timeout dopiero po renderze — przesuwamy czas po 1 s, każdy krok w act
function uplyw(sekundy: number) {
  for (let i = 0; i < sekundy; i++)
    act(() => void vi.advanceTimersByTime(1000));
}

const sukces = async () => ({ status: "success" as const });

describe("CheckInbox", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("pokazuje tekst z makiety (bez adresu e-mail)", () => {
    render(<CheckInbox email="ala@przyklad.pl" onResend={sukces} />);
    expect(
      screen.getByRole("heading", { name: "Sprawdź skrzynkę" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Jeśli adres jest poprawny, wysłaliśmy na niego link potwierdzający. Link wygasa po 1 godzinie.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("ala@przyklad.pl")).not.toBeInTheDocument();
  });

  it("„Wyślij ponownie” jest nieaktywny z licznikiem 0:59 po 1 s, aktywny po 60 s", () => {
    render(<CheckInbox email="a@b.pl" onResend={sukces} />);
    const przycisk = screen.getByRole("button", { name: /Wyślij ponownie/ });
    expect(przycisk).toBeDisabled();
    uplyw(1);
    expect(przycisk).toHaveTextContent("0:59");
    uplyw(59);
    expect(przycisk).toBeEnabled();
    expect(przycisk).not.toHaveTextContent("0:");
  });

  it("klik woła onResend i znowu startuje odliczanie", async () => {
    const onResend = vi.fn(sukces);
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
    render(<CheckInbox email="a@b.pl" onResend={sukces} cooldownSeconds={5} />);
    uplyw(5);
    expect(
      screen.getByRole("button", { name: /Wyślij ponownie/ }),
    ).toBeEnabled();
  });

  it("błąd onResend: komunikat w role=alert, licznik nie startuje od nowa", async () => {
    const onResend = vi.fn(async () => ({
      status: "error" as const,
      message: "Potwierdź, że nie jesteś botem",
    }));
    render(<CheckInbox email="a@b.pl" onResend={onResend} />);
    uplyw(60);
    const przycisk = screen.getByRole("button", { name: /Wyślij ponownie/ });
    await act(async () => przycisk.click());
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Potwierdź, że nie jesteś botem",
    );
    expect(przycisk).toBeEnabled();
    expect(przycisk).not.toHaveTextContent("0:");
  });

  it("błąd pola e-mail z onResend też trafia do role=alert", async () => {
    const onResend = vi.fn(async () => ({
      status: "error" as const,
      fieldErrors: { email: "Podaj poprawny e-mail" },
    }));
    render(<CheckInbox email="zle" onResend={onResend} />);
    uplyw(60);
    await act(async () =>
      screen.getByRole("button", { name: /Wyślij ponownie/ }).click(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Podaj poprawny e-mail",
    );
  });

  it("odrzucona obietnica onResend → ogólny komunikat zamiast cichej porażki", async () => {
    const onResend = vi.fn(async () => {
      throw new Error("sieć");
    });
    render(<CheckInbox email="a@b.pl" onResend={onResend} />);
    uplyw(60);
    await act(async () =>
      screen.getByRole("button", { name: /Wyślij ponownie/ }).click(),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nie udało się wysłać. Spróbuj ponownie.",
    );
  });

  it("w trakcie wysyłania przycisk jest zablokowany — drugi klik nie wysyła drugi raz", async () => {
    let zakoncz: (v: { status: "success" }) => void = () => {};
    const onResend = vi.fn(
      () => new Promise<{ status: "success" }>((r) => (zakoncz = r)),
    );
    render(<CheckInbox email="a@b.pl" onResend={onResend} />);
    uplyw(60);
    const przycisk = screen.getByRole("button", { name: /Wyślij ponownie/ });
    await act(async () => przycisk.click());
    expect(przycisk).toBeDisabled();
    await act(async () => przycisk.click());
    expect(onResend).toHaveBeenCalledTimes(1);
    await act(async () => zakoncz({ status: "success" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("sukces po błędzie czyści komunikat", async () => {
    const onResend = vi
      .fn()
      .mockResolvedValueOnce({
        status: "error",
        message: "Potwierdź, że nie jesteś botem",
      })
      .mockResolvedValueOnce({ status: "success" });
    render(<CheckInbox email="a@b.pl" onResend={onResend} />);
    uplyw(60);
    const przycisk = screen.getByRole("button", { name: /Wyślij ponownie/ });
    await act(async () => przycisk.click());
    expect(screen.getByRole("alert")).toBeInTheDocument();
    await act(async () => przycisk.click());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(przycisk).toBeDisabled();
  });
});
