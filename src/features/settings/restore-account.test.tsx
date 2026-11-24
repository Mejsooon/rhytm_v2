import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { restoreAccount } = vi.hoisted(() => ({ restoreAccount: vi.fn() }));
vi.mock("./account-actions", () => ({ restoreAccount }));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

import { RestoreAccount } from "./restore-account";

describe("RestoreAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("data w strefie z profilu (późny wieczór UTC to już następny dzień w Warszawie)", () => {
    render(
      <RestoreAccount
        email="ala@example.com"
        requestedAt="2026-11-30T23:30:00Z"
        timeZone="Europe/Warsaw"
      />,
    );
    expect(screen.getByText("31 grudnia 2026")).toBeInTheDocument();
  });

  it("niepoprawna data → tekst bez daty", () => {
    render(
      <RestoreAccount email="ala@example.com" requestedAt="" timeZone="UTC" />,
    );
    expect(screen.getByText(/zostanie trwale usunięte/).textContent).toBe(
      "Konto ala@example.com zostanie trwale usunięte (30 dni od prośby o usunięcie). Do tego czasu możesz je przywrócić.",
    );
  });

  it("„Przywróć konto” woła akcję i pokazuje jej błąd", async () => {
    restoreAccount.mockResolvedValue({
      ok: false,
      message: "Nie udało się przywrócić konta. Spróbuj ponownie.",
    });
    const user = userEvent.setup();
    render(
      <RestoreAccount
        email="ala@example.com"
        requestedAt="2026-11-24T10:00:00Z"
        timeZone="Europe/Warsaw"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Przywróć konto" }));
    expect(restoreAccount).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się przywrócić konta. Spróbuj ponownie.",
    );
  });

  it("wyjątek akcji → ogólny komunikat", async () => {
    restoreAccount.mockRejectedValue(new Error("sieć"));
    const user = userEvent.setup();
    render(
      <RestoreAccount
        email="ala@example.com"
        requestedAt="2026-11-24T10:00:00Z"
        timeZone="Europe/Warsaw"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Przywróć konto" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Nie udało się przywrócić konta. Spróbuj ponownie.",
      ),
    );
  });
});
