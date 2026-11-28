import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const saveOnboardingStep = vi.fn();
vi.mock("./actions", () => ({ saveOnboardingStep: (...a: unknown[]) => saveOnboardingStep(...a) }));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

import type { OnboardingDraft, Step } from "./model";
import { OnboardingWizard } from "./wizard";

const draft: OnboardingDraft = {
  name: "Mejson",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "24",
  uses: ["studia", "subs"],
  weeklyWorkouts: 3,
  weeklyKm: 25,
  sleepGoalMin: 480,
  blocks: [],
  source: null,
  notify: { perm: false, before: true, renew: true, habits: false },
};

function pokaz(step: Step, d: OnboardingDraft = draft, reached: Step = step) {
  render(
    <OnboardingWizard
      step={step}
      reached={reached}
      initialDraft={d}
      avatarUrl={null}
      userId="u1"
      now={new Date("2026-11-17T09:00:00Z")}
    />,
  );
  return within(screen.getByTestId("wizard-footer"));
}

beforeEach(() => {
  push.mockReset();
  saveOnboardingStep.mockReset();
  saveOnboardingStep.mockResolvedValue({ ok: true });
});

describe("OnboardingWizard", () => {
  it("puste imię blokuje „Dalej”; w nagłówku 4 kroki, dalsze niż zapisane nieaktywne", () => {
    const stopka = pokaz(1, { ...draft, name: "" }, 2);
    expect(stopka.getByRole("button", { name: "Dalej" })).toBeDisabled();
    const kroki = within(screen.getByRole("navigation", { name: "Kroki" })).getAllByRole("button");
    expect(kroki.map((k) => k.hasAttribute("disabled"))).toEqual([false, false, true, true]);
  });

  it("krok 2: pigułki i cel biegania; „Dalej” zapisuje i idzie do kroku 3", async () => {
    const user = userEvent.setup();
    const stopka = pokaz(2);
    expect(screen.queryByLabelText("Bieganie", { selector: "input" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Bieganie" }));
    await user.clear(screen.getByLabelText("Bieganie", { selector: "input" }));
    expect(stopka.getByRole("button", { name: "Dalej" })).toBeDisabled();
    await user.type(screen.getByLabelText("Bieganie", { selector: "input" }), "30");
    await user.click(stopka.getByRole("button", { name: "Dalej" }));
    expect(saveOnboardingStep).toHaveBeenCalledWith(2, expect.objectContaining({ weekly_km_goal: 30 }));
    expect(push).toHaveBeenCalledWith("/onboarding/3");
  });

  it("krok 3: podpowiedź i własny blok trafiają na listę i do zapisu", async () => {
    const user = userEvent.setup();
    const stopka = pokaz(3);
    await user.click(screen.getByRole("button", { name: "Zajęcia · 08:00" }));
    await user.type(screen.getByLabelText("Własny blok"), "Angielski{Enter}");
    await user.click(stopka.getByRole("button", { name: "Dalej" }));
    expect(saveOnboardingStep).toHaveBeenCalledWith(3, {
      blocks: [
        { title: "Zajęcia", category: "Studia", start_min: 480, end_min: 570 },
        { title: "Angielski", category: "Studia", start_min: 1230, end_min: 1290 },
      ],
    });
  });

  it("krok 3: „Pomiń” nie zapisuje bloków", async () => {
    const stopka = pokaz(3);
    await userEvent.click(stopka.getByRole("button", { name: "Pomiń" }));
    expect(saveOnboardingStep).toHaveBeenCalledWith(3, { blocks: [] });
    expect(push).toHaveBeenCalledWith("/onboarding/4");
  });

  it("krok 4: źródło, „Zacznij korzystać” zapisuje bez nawigacji (przekierowuje akcja)", async () => {
    const user = userEvent.setup();
    const stopka = pokaz(4);
    expect(stopka.queryByRole("button", { name: "Pomiń" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Uczelnia" }));
    await user.click(stopka.getByRole("button", { name: "Zacznij korzystać" }));
    expect(saveOnboardingStep).toHaveBeenCalledWith(4, {
      referral_source: "uni",
      push_enabled: false,
      before: true,
      renew: true,
      habits: false,
    });
    expect(push).not.toHaveBeenCalled();
  });

  it("błąd zapisu zostaje na ekranie", async () => {
    saveOnboardingStep.mockResolvedValue({ ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." });
    const stopka = pokaz(1);
    await userEvent.click(stopka.getByRole("button", { name: "Dalej" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się zapisać");
    expect(push).not.toHaveBeenCalled();
  });
});
