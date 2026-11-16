import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

// Widżet Turnstile ładuje skrypt Cloudflare — w testach zastępujemy go atrapą
// resetKey wystawiamy w atrybucie, żeby sprawdzić, że zmienia się po wyniku akcji (reset tokenu)
vi.mock("@/components/auth/turnstile-widget", () => ({
  TurnstileWidget: ({ resetKey }: { resetKey?: unknown }) => (
    <input
      type="hidden"
      name="cf-turnstile-response"
      value="token"
      data-testid="turnstile"
      data-reset={JSON.stringify(resetKey)}
    />
  ),
}));

// Akcje serwerowe: logowanie zawsze zwraca błąd, Google nic nie robi
vi.mock("./actions", () => ({
  signIn: vi.fn(async () => ({ status: "error", message: "Nieprawidłowy e-mail lub hasło" })),
  signInWithGoogle: vi.fn(async () => undefined),
}));

import { signIn, signInWithGoogle } from "./actions";
import { LoginForm } from "./login-form";

describe("LoginForm", () => {
  it("ma oba warianty przycisku Google (web i telefon) w osobnych kontenerach breakpointów", () => {
    render(<LoginForm />);
    const web = screen.getByText("Zaloguj się przez Google");
    const telefon = screen.getByText("Kontynuuj z Google");
    expect(web.className).toContain("max-[799px]:hidden");
    expect(telefon.className).toContain("min-[800px]:hidden");
  });

  it("linki: reset hasła i rejestracja", () => {
    render(<LoginForm />);
    expect(screen.getByRole("link", { name: "Nie pamiętasz hasła?" })).toHaveAttribute(
      "href",
      "/reset-hasla",
    );
    expect(screen.getByRole("link", { name: "Zarejestruj się" })).toHaveAttribute(
      "href",
      "/rejestracja",
    );
    expect(screen.getByRole("link", { name: "Załóż konto" })).toHaveAttribute(
      "href",
      "/rejestracja",
    );
  });

  it("po wysłaniu pokazuje alert z błędem logowania", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.pl");
    await user.type(screen.getByLabelText("Hasło"), "haslo12345");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nieprawidłowy e-mail lub hasło");
  });

  it("„Pokaż hasło” przełącza typ pola na text", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const haslo = screen.getByLabelText("Hasło");
    expect(haslo).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(haslo).toHaveAttribute("type", "text");
    expect(screen.getByRole("button", { name: "Ukryj hasło" })).toBeInTheDocument();
  });

  it("ma jedno pole email i jedno password (różnice tylko w CSS)", () => {
    const { container } = render(<LoginForm />);
    expect(container.querySelectorAll('input[name="email"]')).toHaveLength(1);
    expect(container.querySelectorAll('input[name="password"]')).toHaveLength(1);
  });

  it("Enter w polu hasła wysyła logowanie hasłem, a nie Google", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("E-mail"), "a@b.pl");
    await user.type(screen.getByLabelText("Hasło"), "haslo12345{Enter}");
    expect(signIn).toHaveBeenCalled();
    expect(signInWithGoogle).not.toHaveBeenCalled();
  });

  it("po wyniku z błędem zmienia resetKey widżetu Turnstile (token jest jednorazowy)", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const przed = screen.getByTestId("turnstile").getAttribute("data-reset");
    await user.type(screen.getByLabelText("E-mail"), "a@b.pl");
    await user.type(screen.getByLabelText("Hasło"), "haslo12345");
    await user.click(screen.getByRole("button", { name: "Zaloguj się" }));
    await screen.findByRole("alert");
    expect(screen.getByTestId("turnstile").getAttribute("data-reset")).not.toBe(przed);
  });
});
