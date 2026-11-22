import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { OnboardingDraft } from "../model";
import { StepSource } from "./step-source";

const start: OnboardingDraft = {
  name: "M",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "24",
  roles: [],
  studyField: "",
  goals: [],
  workoutsOn: true,
  kmOn: false,
  weeklyWorkouts: 3,
  weeklyKm: 25,
  sleepGoalMin: 480,
  source: null,
  sourceOther: "",
  pages: null,
  notify: {
    perm: false,
    before: true,
    renew: true,
    weekly: true,
    habits: false,
  },
};

const web = () => within(screen.getByTestId("source-web"));

function Probe() {
  const [d, setD] = useState(start);
  return <StepSource draft={d} onChange={setD} />;
}

describe("StepSource", () => {
  it("pokazuje 10 źródeł", () => {
    render(<Probe />);
    expect(
      within(screen.getByTestId("source-web")).getAllByRole("button"),
    ).toHaveLength(10);
    expect(
      within(screen.getByTestId("source-phone")).getAllByRole("button"),
    ).toHaveLength(10);
  });

  it("„Inne” pokazuje „Gdzie dokładnie?”, ponowny klik odznacza i chowa pole", async () => {
    render(<Probe />);
    expect(screen.queryByLabelText("Gdzie dokładnie?")).not.toBeInTheDocument();
    await userEvent.click(web().getByRole("button", { name: "Inne" }));
    expect(screen.getByLabelText("Gdzie dokładnie?")).toBeInTheDocument();
    await userEvent.click(web().getByRole("button", { name: "Inne" }));
    expect(screen.queryByLabelText("Gdzie dokładnie?")).not.toBeInTheDocument();
  });

  it("jeden wybór: kliknięcie innego zastępuje poprzedni", async () => {
    render(<Probe />);
    await userEvent.click(web().getByRole("button", { name: "TikTok" }));
    await userEvent.click(web().getByRole("button", { name: "YouTube" }));
    expect(web().getByRole("button", { name: "TikTok" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(web().getByRole("button", { name: "YouTube" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  // Wygląd wg COnboardingSource
  it("wygląd: karty 44 px z ikoną muted, wybrana z ciemniejszą ramką i tłem", async () => {
    render(<Probe />);
    const karta = web().getByRole("button", { name: "TikTok" });
    expect(karta).toHaveClass("h-11");
    expect(karta).toHaveClass("rounded-lg");
    const ikona = karta.querySelector("svg");
    expect(ikona).toHaveAttribute("stroke", "currentColor");
    expect(ikona).toHaveAttribute("stroke-width", "2");
    expect(ikona).toHaveClass("text-muted-foreground");
    expect(karta.className).not.toContain("bg-black/[.025]");
    await userEvent.click(karta);
    expect(
      web().getByRole("button", { name: "TikTok" }).className,
    ).toContain("bg-black/[.025]");
  });

  it("bez font-mono", () => {
    const { container } = render(<Probe />);
    expect(container.innerHTML).not.toContain("font-mono");
  });
});
