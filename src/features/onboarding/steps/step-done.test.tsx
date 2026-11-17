import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { OnboardingDraft } from "../model";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { StepDone } from "./step-done";

const draft: OnboardingDraft = {
  name: "Mejson",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "24",
  roles: ["student"],
  studyField: "",
  goals: ["proj"],
  weeklyKm: 25,
  sleepGoalMin: 480,
  source: null,
  sourceOther: "",
  pages: null,
  notify: { perm: false, before: true, renew: true, weekly: true, habits: false },
};

const NOW = new Date("2026-11-17T09:00:00Z");

beforeEach(() => push.mockReset());

describe("StepDone", () => {
  it("pokazuje powitanie i wiersze podsumowania", () => {
    render(<StepDone draft={draft} now={NOW} />);
    expect(screen.getByRole("heading", { name: "Gotowe, Mejson" })).toBeInTheDocument();
    const web = within(screen.getByTestId("done-web"));
    expect(web.getByText("Mejson · Europe/Warsaw")).toBeInTheDocument();
    expect(web.getByText("Projects")).toBeInTheDocument();
    expect(web.getByText("3 włączone")).toBeInTheDocument();
    expect(web.getByText("Ctrl")).toBeInTheDocument();
    const phone = within(screen.getByTestId("done-phone"));
    expect(phone.getByText("Mejson · Warszawa · tydzień od pn")).toBeInTheDocument();
    expect(phone.getByText("3 z 4 włączone · bez zgody na push")).toBeInTheDocument();
    expect(phone.getByText(/Pierwszy blok dodasz przyciskiem/)).toBeInTheDocument();
  });

  it("„Zmień” przy Strony prowadzi do /onboarding/5", async () => {
    render(<StepDone draft={draft} now={NOW} />);
    const web = within(screen.getByTestId("done-web"));
    await userEvent.click(web.getByRole("button", { name: "Zmień: Strony" }));
    expect(push).toHaveBeenCalledWith("/onboarding/5");
    await userEvent.click(
      within(screen.getByTestId("done-phone")).getByRole("button", { name: "Zmień: Profil" }),
    );
    expect(push).toHaveBeenCalledWith("/onboarding/1");
  });
});
