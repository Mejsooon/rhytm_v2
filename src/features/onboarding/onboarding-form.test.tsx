import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("./actions", () => ({
  ukonczOnboarding: vi.fn(async () => ({ status: "error", message: "Nie udało się zapisać. Spróbuj ponownie." })),
}));

import { OnboardingForm } from "./onboarding-form";

describe("OnboardingForm", () => {
  it("błąd akcji pokazuje komunikat w role=alert", async () => {
    const user = userEvent.setup();
    render(<OnboardingForm />);
    await user.click(screen.getByRole("button", { name: "Dalej" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się zapisać. Spróbuj ponownie.");
  });
});
