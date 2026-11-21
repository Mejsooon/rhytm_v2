import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ reset: vi.fn(), countSecrets: vi.fn() }));
vi.mock("./vault-provider", () => ({ useVault: () => ({ reset: m.reset }) }));
vi.mock("./actions", () => ({ countSecrets: m.countSecrets }));

import { VaultResetDialog } from "./vault-reset-dialog";

describe("VaultResetDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("odmiana: 1 sekret, 4 sekrety, 5 sekretów, 0 sekretów", async () => {
    for (const [n, tekst] of [[1, "1 sekret"], [4, "4 sekrety"], [5, "5 sekretów"], [0, "0 sekretów"], [22, "22 sekrety"]] as const) {
      m.countSecrets.mockResolvedValue({ ok: true, count: n });
      const { unmount } = render(<VaultResetDialog open onOpenChange={() => {}} />);
      expect(await screen.findByText(tekst)).toBeInTheDocument();
      unmount();
    }
  });

  it("teksty z makiety", async () => {
    m.countSecrets.mockResolvedValue({ ok: true, count: 4 });
    render(<VaultResetDialog open onOpenChange={() => {}} />);
    const okno = await screen.findByRole("dialog", { name: "Zresetować sejf?" });
    expect(within(okno).getByText("Tej operacji nie da się cofnąć.")).toBeInTheDocument();
    expect(within(okno).getByText("Zostanie usunięte")).toBeInTheDocument();
    expect(within(okno).getByText("Zostaje")).toBeInTheDocument();
    expect(within(okno).getByText("Pola „Sekret” zostaną wyczyszczone, a potem ustawisz nowe hasło główne.")).toBeInTheDocument();
  });

  it("udany reset zamyka okno; błąd pokazuje komunikat", async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    m.countSecrets.mockResolvedValue({ ok: true, count: 2 });
    m.reset.mockResolvedValueOnce({ ok: false, message: "Nie udało się połączyć z sejfem. Spróbuj ponownie." });
    m.reset.mockResolvedValueOnce({ ok: true, cleared: 2 });
    render(<VaultResetDialog open onOpenChange={onOpenChange} />);
    const okno = await screen.findByRole("dialog");
    await user.type(within(okno).getByPlaceholderText("RESETUJ"), "resetuj");
    await user.click(within(okno).getByRole("button", { name: "Zresetuj sejf" }));
    expect(await within(okno).findByRole("alert")).toHaveTextContent("Nie udało się połączyć z sejfem. Spróbuj ponownie.");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    await user.click(within(okno).getByRole("button", { name: "Zresetuj sejf" }));
    await vi.waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});
