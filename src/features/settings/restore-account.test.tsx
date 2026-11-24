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

  it("prośba po 03:41 UTC → usunięcie przy purge następnego dnia po 30 dniach", () => {
    render(
      <RestoreAccount
        email="ala@example.com"
        requestedAt="2026-11-24T10:00:00Z"
        timeZone="Europe/Warsaw"
      />,
    );
    expect(screen.getByText(/zostanie trwale usunięte/).textContent).toBe(
      "Konto ala@example.com zostanie trwale usunięte 25 grudnia 2026 (30 dni od prośby o usunięcie). Możesz je przywrócić do 24 grudnia 2026 włącznie.",
    );
  });

  it("prośba przed 03:41 UTC → purge tego samego dnia po 30 dniach", () => {
    render(
      <RestoreAccount
        email="ala@example.com"
        requestedAt="2026-11-24T02:00:00Z"
        timeZone="Europe/Warsaw"
      />,
    );
    expect(screen.getByText("24 grudnia 2026")).toBeInTheDocument();
    expect(screen.getByText("23 grudnia 2026")).toBeInTheDocument();
  });

  it("data w strefie z profilu", () => {
    render(
      <RestoreAccount
        email="ala@example.com"
        requestedAt="2026-11-24T10:00:00Z"
        timeZone="Pacific/Kiritimati"
      />,
    );
    // 25.12 03:41 UTC = 25.12 17:41 w UTC+14
    expect(screen.getByText("25 grudnia 2026")).toBeInTheDocument();
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
