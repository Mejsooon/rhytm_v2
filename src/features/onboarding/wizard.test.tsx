import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardingDraft } from "./model";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const saveOnboardingStep = vi.fn();
const completeOnboarding = vi.fn();
vi.mock("./actions", () => ({
  saveOnboardingStep: (...a: unknown[]) => saveOnboardingStep(...a),
  completeOnboarding: () => completeOnboarding(),
}));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

import { OnboardingWizard } from "./wizard";

const NOW = new Date("2026-11-17T09:00:00Z");
const draft: OnboardingDraft = {
  name: "Mejson",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "24",
  roles: ["student", "sport"],
  studyField: "",
  goals: ["plan"],
  weeklyKm: 25,
  sleepGoalMin: 480,
  source: null,
  sourceOther: "",
  pages: null,
  notify: { perm: false, before: true, renew: true, weekly: true, habits: false },
};

function pokaz(step: number, d: OnboardingDraft = draft) {
  render(
    <OnboardingWizard
      step={step as 1}
      initialDraft={d}
      avatarUrl={null}
      now={NOW}
    />,
  );
  return within(screen.getByTestId("wizard-footer"));
}

beforeEach(() => {
  push.mockReset();
  saveOnboardingStep.mockReset();
  completeOnboarding.mockReset();
  saveOnboardingStep.mockResolvedValue({ ok: true });
});

describe("OnboardingWizard", () => {
  it("krok 1: puste imię blokuje „Dalej”", () => {
    const stopka = pokaz(1, { ...draft, name: "" });
    expect(stopka.getByRole("button", { name: "Dalej" })).toBeDisabled();
  });

  it("krok 1: z imieniem „Dalej” jest aktywne", () => {
    const stopka = pokaz(1);
    expect(stopka.getByRole("button", { name: "Dalej" })).toBeEnabled();
  });

  it("pokazuje „Krok n z 7” i pasek postępu", () => {
    pokaz(3);
    expect(screen.getAllByText("Krok 3 z 7").length).toBeGreaterThan(0);
    const pasek = screen.getByRole("progressbar");
    expect(pasek).toHaveAttribute("aria-valuenow", "3");
  });

  it("podwójny klik zapisuje raz, potem przechodzi do kroku 3", async () => {
    const stopka = pokaz(2);
    const dalej = stopka.getByRole("button", { name: "Dalej" });
    await userEvent.dblClick(dalej);
    expect(saveOnboardingStep).toHaveBeenCalledTimes(1);
    expect(saveOnboardingStep).toHaveBeenCalledWith(2, {
      roles: ["student", "sport"],
      study_field: "",
    });
    expect(push).toHaveBeenCalledWith("/onboarding/3");
  });

  it("dwa synchroniczne kliknięcia wysyłają jeden request", async () => {
    saveOnboardingStep.mockReturnValue(new Promise(() => {}));
    const stopka = pokaz(2);
    const dalej = stopka.getByRole("button", { name: "Dalej" });
    dalej.click();
    dalej.click();
    expect(saveOnboardingStep).toHaveBeenCalledTimes(1);
  });

  it("błąd akcji: komunikat w role=alert, bez przejścia", async () => {
    saveOnboardingStep.mockResolvedValue({ ok: false, message: "Nie udało się zapisać." });
    const stopka = pokaz(2);
    await userEvent.click(stopka.getByRole("button", { name: "Dalej" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się zapisać.");
    expect(push).not.toHaveBeenCalled();
    expect(stopka.getByRole("button", { name: "Dalej" })).toBeEnabled();
  });

  it("„Pomiń” tylko na kroku 4 i zapisuje null-e", async () => {
    const { unmount } = render(
      <OnboardingWizard step={3} initialDraft={draft} avatarUrl={null} now={NOW} />,
    );
    expect(screen.queryByRole("button", { name: "Pomiń" })).not.toBeInTheDocument();
    unmount();
    const stopka = pokaz(4);
    await userEvent.click(stopka.getByRole("button", { name: "Pomiń" }));
    expect(saveOnboardingStep).toHaveBeenCalledWith(4, {
      referral_source: null,
      referral_other: null,
    });
    expect(push).toHaveBeenCalledWith("/onboarding/5");
  });

  it("krok 7: „Przejdź do Dziś” zamiast „Dalej”, woła completeOnboarding", async () => {
    completeOnboarding.mockResolvedValue({ ok: false, message: "Błąd końca." });
    const stopka = pokaz(7);
    expect(stopka.queryByRole("button", { name: "Dalej" })).not.toBeInTheDocument();
    await userEvent.click(stopka.getByRole("button", { name: "Przejdź do Dziś" }));
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    expect(saveOnboardingStep).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Błąd końca.");
  });

  it("„Wstecz” na kroku 3 idzie do kroku 2", async () => {
    const stopka = pokaz(3);
    await userEvent.click(stopka.getByRole("button", { name: "Wstecz" }));
    expect(push).toHaveBeenCalledWith("/onboarding/2");
  });

  it("„Wstecz” na kroku 1 jest nieaktywne", () => {
    const stopka = pokaz(1);
    expect(stopka.getByRole("button", { name: "Wstecz" })).toBeDisabled();
  });

  it("telefon: nagłówek ma „Wstecz” od kroku 2, a „Wyloguj” jest zawsze", async () => {
    pokaz(2);
    expect(screen.getAllByRole("button", { name: "Wstecz" }).length).toBe(2);
    expect(screen.getAllByRole("button", { name: "Wyloguj" }).length).toBeGreaterThan(0);
  });
});
