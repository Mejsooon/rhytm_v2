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
  workoutsOn: true,
  kmOn: false,
  weeklyWorkouts: 3,
  weeklyKm: 25,
  sleepGoalMin: 480,
  source: null,
  sourceOther: "",
  pages: ["Projects"],
  notify: {
    perm: false,
    before: true,
    renew: true,
    weekly: true,
    habits: false,
  },
};

const NOW = new Date("2026-11-17T09:00:00Z");

beforeEach(() => push.mockReset());

describe("StepDone", () => {
  it("pokazuje powitanie i wiersze podsumowania", () => {
    render(<StepDone draft={draft} now={NOW} />);
    expect(
      screen.getByRole("heading", { name: "Gotowe, Mejson" }),
    ).toBeInTheDocument();
    const web = within(screen.getByTestId("done-web"));
    expect(web.getByText("Mejson · Europe/Warsaw")).toBeInTheDocument();
    expect(web.getByText("Projects")).toBeInTheDocument();
    expect(web.getByText("2 włączone")).toBeInTheDocument();
    expect(web.getByText("Ctrl")).toBeInTheDocument();
    const phone = within(screen.getByTestId("done-phone"));
    expect(
      phone.getByText("Mejson · Warszawa · tydzień od pn"),
    ).toBeInTheDocument();
    expect(
      phone.getByText("2 z 3 włączone · bez zgody na push"),
    ).toBeInTheDocument();
    expect(
      phone.getByText(/Pierwszy blok dodasz przyciskiem/),
    ).toBeInTheDocument();
  });

  it("„Zmień” przy Strony prowadzi do /onboarding/5", async () => {
    render(<StepDone draft={draft} now={NOW} />);
    const web = within(screen.getByTestId("done-web"));
    await userEvent.click(web.getByRole("button", { name: "Zmień: Strony" }));
    expect(push).toHaveBeenCalledWith("/onboarding/5");
    await userEvent.click(
      within(screen.getByTestId("done-phone")).getByRole("button", {
        name: "Zmień: Profil",
      }),
    );
    expect(push).toHaveBeenCalledWith("/onboarding/1");
  });

  it("wiersz „Cele treningowe” z odmianą, oba cele i „Zmień” do kroku 3", async () => {
    const { rerender } = render(
      <StepDone draft={{ ...draft, weeklyWorkouts: 1 }} now={NOW} />,
    );
    expect(
      within(screen.getByTestId("done-web")).getByText("1 trening / tydz."),
    ).toBeInTheDocument();
    rerender(<StepDone draft={{ ...draft, weeklyWorkouts: 4 }} now={NOW} />);
    expect(
      within(screen.getByTestId("done-phone")).getByText("4 treningi / tydz."),
    ).toBeInTheDocument();
    rerender(<StepDone draft={{ ...draft, weeklyWorkouts: 7 }} now={NOW} />);
    expect(
      within(screen.getByTestId("done-web")).getByText("7 treningów / tydz."),
    ).toBeInTheDocument();
    rerender(
      <StepDone
        draft={{
          ...draft,
          workoutsOn: false,
          kmOn: true,
          weeklyKm: 22.5,
        }}
        now={NOW}
      />,
    );
    expect(
      within(screen.getByTestId("done-phone")).getByText("22,5 km / tydz."),
    ).toBeInTheDocument();
    rerender(
      <StepDone
        draft={{
          ...draft,
          workoutsOn: false,
          kmOn: true,
          weeklyKm: 25,
        }}
        now={NOW}
      />,
    );
    expect(
      within(screen.getByTestId("done-web")).getByText("25 km / tydz."),
    ).toBeInTheDocument();
    rerender(
      <StepDone
        draft={{
          ...draft,
          workoutsOn: true,
          kmOn: true,
          weeklyWorkouts: 3,
          weeklyKm: 25,
        }}
        now={NOW}
      />,
    );
    expect(
      within(screen.getByTestId("done-web")).getByText(
        "3 treningi / tydz. · 25 km / tydz.",
      ),
    ).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByTestId("done-web")).getByRole("button", {
        name: "Zmień: Cele treningowe",
      }),
    );
    expect(push).toHaveBeenCalledWith("/onboarding/3");
  });

  // Wygląd wg COnboardingDone
  it("wygląd: logo 40 px, karta podsumowania z ✓ w zielonym kółku i „Zmień” w wierszu", () => {
    render(<StepDone draft={draft} now={NOW} />);
    const web = within(screen.getByTestId("done-web"));
    expect(screen.getAllByRole("img", { name: "rhytm" })[0]).toHaveAttribute(
      "width",
      "40",
    );
    // Logo to wspólny RhytmLogo, a nie skopiowany SVG
    const logo = screen.getAllByRole("img", { name: "rhytm" })[0];
    expect(logo).toHaveAttribute("height", "40");
    expect(logo.querySelector(".fill-foreground")).not.toBeNull();
    expect(logo.parentElement).toHaveClass("max-[799px]:hidden");
    const karta = web.getByText("Profil").closest("div.shadow-card")!;
    expect(karta).not.toBeNull();
    expect(karta.querySelectorAll("span.bg-success\\/10")).toHaveLength(5);
    const zmien = web.getByRole("button", { name: "Zmień: Strony" });
    expect(zmien.textContent).toBe("Zmień");
    expect(zmien.className).toContain("bg-transparent");
  });

  it("skrót: Ctrl i K w Kbd", () => {
    render(<StepDone draft={draft} now={NOW} />);
    const web = within(screen.getByTestId("done-web"));
    expect(web.getByText("Ctrl")).toHaveClass("bg-muted");
    expect(web.getByText("K").tagName).toBe("KBD");
  });

  it("bez font-mono", () => {
    const { container } = render(<StepDone draft={draft} now={NOW} />);
    expect(container.innerHTML).not.toContain("font-mono");
  });

  it("telefon: wiersze m-row 60 px z etykietą .lbl i „Zmień” jako przycisk ghost 44 px", () => {
    render(<StepDone draft={draft} now={NOW} />);
    const tel = within(screen.getByTestId("done-phone"));
    const zmien = tel.getByRole("button", { name: "Zmień: Profil" });
    expect(zmien).toHaveClass("bg-transparent", "max-[799px]:h-11");
    expect(zmien.parentElement).toHaveClass("m-row", "min-h-[60px]");
    expect(tel.getByText("Profil")).toHaveClass("text-xs", "font-medium");
  });
});
