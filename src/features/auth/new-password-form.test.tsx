import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  updatePassword: vi.fn(async () => ({
    status: "error",
    message: "To hasło wystąpiło w wyciekach danych. Wybierz inne.",
  })),
  checkPasswordLeak: vi.fn(async () => false),
}));

import { checkPasswordLeak } from "./actions";
import { NewPasswordForm } from "./new-password-form";

async function wpiszHaslo(
  user: ReturnType<typeof userEvent.setup>,
  haslo: string,
) {
  await user.type(screen.getByLabelText("Nowe hasło"), haslo);
  // Debounce 400 ms + odpowiedź akcji
  await act(async () => {
    await new Promise((r) => setTimeout(r, 450));
  });
}

describe("NewPasswordForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkPasswordLeak).mockResolvedValue(false);
  });

  it("brak wycieku → reguła ✓", async () => {
    const user = userEvent.setup();
    render(<NewPasswordForm />);
    await wpiszHaslo(user, "rytm2026dobre");
    expect(screen.getByText(/nie ma go w bazie wycieków/)).toHaveTextContent(
      ": spełnione",
    );
  });

  it("błąd checkPasswordLeak → reguła zostaje ○, bez nieobsłużonego błędu", async () => {
    vi.mocked(checkPasswordLeak).mockRejectedValue(new Error("sieć"));
    const user = userEvent.setup();
    render(<NewPasswordForm />);
    await wpiszHaslo(user, "rytm2026dobre");
    expect(checkPasswordLeak).toHaveBeenCalled();
    expect(screen.getByText(/nie ma go w bazie wycieków/)).toHaveTextContent(
      ": niespełnione",
    );
  });

  it("po błędzie akcji pole hasła i reguły pokazują to samo hasło", async () => {
    const user = userEvent.setup();
    render(<NewPasswordForm />);
    await wpiszHaslo(user, "rytm2026dobre");
    await user.type(screen.getByLabelText("Powtórz hasło"), "rytm2026dobre");
    await user.click(
      screen.getByRole("button", { name: "Zapisz i zaloguj się" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "To hasło wystąpiło w wyciekach danych. Wybierz inne.",
    );
    expect(screen.getByLabelText("Nowe hasło")).toHaveValue("rytm2026dobre");
    expect(screen.getByText(/co najmniej 10 znaków/)).toHaveTextContent(": spełnione");
  });
});
