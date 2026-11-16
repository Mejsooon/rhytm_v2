import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: () => <input type="hidden" name="cf-turnstile-response" value="token" />,
}));

vi.mock("./actions", () => ({
  signUp: vi.fn(async () => {
    // Chwila opóźnienia, żeby było widać stan „w trakcie”
    await new Promise((r) => setTimeout(r, 50));
    return { status: "success", email: "ala@przyklad.pl" };
  }),
  signInWithGoogle: vi.fn(async () => undefined),
  checkPasswordLeak: vi.fn(async () => false),
  resendConfirmation: vi.fn(async () => ({ status: "success" })),
}));

import { checkPasswordLeak, signUp } from "./actions";
import { RegisterForm } from "./register-form";

const KOLOR_OK = "#15803d";

async function wpiszHaslo(user: ReturnType<typeof userEvent.setup>, haslo: string) {
  await user.type(screen.getByLabelText("Hasło"), haslo);
  // Debounce 400 ms + odpowiedź akcji
  await act(async () => {
    await new Promise((r) => setTimeout(r, 450));
  });
}

describe("RegisterForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPasswordLeak).mockResolvedValue(false);
  });

  it("rytm2026: długość ○, litery i cyfry ✓", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await wpiszHaslo(user, "rytm2026");
    expect(screen.getByText(/co najmniej 10 znaków/)).toHaveTextContent("○");
    expect(screen.getByText(/litery i cyfry/)).toHaveTextContent("✓");
  });

  it("wyciek (checkPasswordLeak → true): reguła ○ i blokada wysyłki", async () => {
    vi.mocked(checkPasswordLeak).mockResolvedValue(true);
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/Nazwa/), "Ala");
    await user.type(screen.getByLabelText("E-mail"), "a@b.pl");
    await wpiszHaslo(user, "haslo12345");
    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByText(/nie ma go w bazie wycieków/)).toHaveTextContent("○");
    const przycisk = screen.getByRole("button", { name: "Utwórz konto" });
    expect(przycisk).toHaveAttribute("aria-disabled", "true");
    await user.click(przycisk);
    expect(signUp).not.toHaveBeenCalled();
  });

  it("pasek siły ma 4 segmenty; rytmtygodnia2026x → wszystkie #15803d", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await wpiszHaslo(user, "rytmtygodnia2026x");
    const segmenty = screen.getAllByTestId("strength-segment");
    expect(segmenty).toHaveLength(4);
    for (const s of segmenty) expect(s).toHaveStyle({ backgroundColor: KOLOR_OK });
  });

  it("bez zgody „Utwórz konto” ma aria-disabled i nie wysyła; linki do regulaminu i prywatności", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/Nazwa/), "Ala");
    await user.type(screen.getByLabelText("E-mail"), "a@b.pl");
    await wpiszHaslo(user, "rytm2026dobre");
    const przycisk = screen.getByRole("button", { name: "Utwórz konto" });
    expect(przycisk).toHaveAttribute("aria-disabled", "true");
    await user.click(przycisk);
    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "regulamin" })).toHaveAttribute("href", "/regulamin");
    expect(screen.getByRole("link", { name: "politykę prywatności" })).toHaveAttribute("href", "/prywatnosc");
  });

  it("podwójne kliknięcie: akcja 1 raz, przycisk zablokowany w trakcie; potem „Sprawdź skrzynkę”", async () => {
    const user = userEvent.setup();
    render(<RegisterForm />);
    await user.type(screen.getByLabelText(/Nazwa/), "Ala");
    await user.type(screen.getByLabelText("E-mail"), "a@b.pl");
    await wpiszHaslo(user, "rytm2026dobre");
    await user.click(screen.getByRole("checkbox"));
    const przycisk = screen.getByRole("button", { name: "Utwórz konto" });
    expect(przycisk).not.toHaveAttribute("aria-disabled", "true");
    await user.dblClick(przycisk);
    expect(signUp).toHaveBeenCalledTimes(1);
    expect(vi.mocked(signUp).mock.calls[0][1].get("tos")).toBe("on");
    expect(screen.getByRole("button", { name: "Utwórz konto" })).toBeDisabled();
    await waitFor(() => expect(screen.getByRole("heading", { name: "Sprawdź skrzynkę" })).toBeInTheDocument());
    expect(screen.getByText("ala@przyklad.pl")).toBeInTheDocument();
  });
});
