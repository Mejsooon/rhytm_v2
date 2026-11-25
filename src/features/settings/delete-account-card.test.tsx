import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requestAccountDeletion } = vi.hoisted(() => ({
  requestAccountDeletion: vi.fn(),
}));
vi.mock("./account-actions", () => ({ requestAccountDeletion }));

import { DeleteAccountCard } from "./delete-account-card";

describe("DeleteAccountCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestAccountDeletion.mockResolvedValue({
      ok: false,
      message: "Nie udało się usunąć konta. Spróbuj ponownie.",
    });
  });

  it("tytuł i opis o 30 dniach (decyzja C2), w spoczynku sam przycisk „Usuń konto”", () => {
    render(<DeleteAccountCard />);
    expect(
      screen.getByRole("heading", { name: "Usuń konto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Konto zostanie usunięte po 30 dniach razem ze stronami, sejfem i danymi modułów. Do tego czasu możesz je przywrócić, logując się. Zdjęcie profilowe usuwamy od razu.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Usuń konto" })).toBeEnabled();
    expect(screen.queryByPlaceholderText("USUŃ")).not.toBeInTheDocument();
  });

  it("„Usuń konto” → pole USUŃ; przycisk nieaktywny do wpisania słowa (także „usuń ” małymi literami)", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountCard />);
    await user.click(screen.getByRole("button", { name: "Usuń konto" }));

    const pole = screen.getByLabelText("Wpisz USUŃ, żeby potwierdzić");
    expect(pole).toHaveAttribute("placeholder", "USUŃ");
    expect(pole).toHaveAttribute("autocomplete", "off");
    const przycisk = screen.getByRole("button", { name: "Usuń konto" });
    expect(przycisk).toHaveAttribute("aria-disabled", "true");

    // Klik w nieaktywny przycisk nic nie robi
    await user.click(przycisk);
    expect(requestAccountDeletion).not.toHaveBeenCalled();

    await user.type(pole, "usun");
    expect(przycisk).toHaveAttribute("aria-disabled", "true");
    await user.clear(pole);
    await user.type(pole, "usuń ");
    expect(przycisk).toHaveAttribute("aria-disabled", "false");
  });

  it("„Anuluj” wraca do spoczynku", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountCard />);
    await user.click(screen.getByRole("button", { name: "Usuń konto" }));
    await user.type(screen.getByPlaceholderText("USUŃ"), "USUŃ");
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByPlaceholderText("USUŃ")).not.toBeInTheDocument();
    // Ponowne otwarcie zaczyna od pustego pola
    await user.click(screen.getByRole("button", { name: "Usuń konto" }));
    expect(screen.getByPlaceholderText("USUŃ")).toHaveValue("");
  });

  it("potwierdzenie woła akcję ze słowem i pokazuje jej błąd", async () => {
    const user = userEvent.setup();
    render(<DeleteAccountCard />);
    await user.click(screen.getByRole("button", { name: "Usuń konto" }));
    await user.type(screen.getByPlaceholderText("USUŃ"), "USUŃ");
    await user.click(screen.getByRole("button", { name: "Usuń konto" }));
    expect(requestAccountDeletion).toHaveBeenCalledWith("USUŃ");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się usunąć konta. Spróbuj ponownie.",
    );
  });

  it("wyjątek akcji (np. sieć) → ogólny komunikat", async () => {
    requestAccountDeletion.mockRejectedValue(new Error("sieć"));
    const user = userEvent.setup();
    render(<DeleteAccountCard />);
    await user.click(screen.getByRole("button", { name: "Usuń konto" }));
    await user.type(screen.getByPlaceholderText("USUŃ"), "usuń");
    await user.click(screen.getByRole("button", { name: "Usuń konto" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Nie udało się usunąć konta. Spróbuj ponownie.",
      ),
    );
  });

  it("telefon: stopka ustawia się w kolumnę z przyciskami na całą szerokość", async () => {
    render(<DeleteAccountCard />);
    const przycisk = screen.getByRole("button", { name: "Usuń konto" });
    expect(przycisk.parentElement?.className).toContain("max-[799px]:flex-col");
    expect(przycisk.parentElement?.className).toContain("max-[799px]:items-stretch");
  });
});
