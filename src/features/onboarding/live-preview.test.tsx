import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LivePreview } from "./live-preview";
import type { OnboardingDraft, Step } from "./model";

const draft: OnboardingDraft = {
  name: "Mejson",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "12",
  uses: ["studia", "subs"],
  weeklyWorkouts: 3,
  weeklyKm: 25,
  sleepGoalMin: 480,
  blocks: [{ title: "Zajęcia", start: "14:00", end: "15:00", category: "Studia" }],
  source: null,
  notify: { perm: true, before: true, renew: true, habits: false },
};

const pokaz = (step: Step, d = draft) =>
  render(<LivePreview draft={d} step={step} avatarUrl={null} now={new Date("2026-11-17T09:00:00Z")} />);

describe("LivePreview", () => {
  it("pokazuje powitanie, kategorie, strony po polsku i bloki w wybranym zegarze", () => {
    pokaz(3);
    expect(screen.getByText("Dzień dobry, Mejson")).toBeInTheDocument();
    expect(screen.getByTestId("pv-cats")).toHaveTextContent("Studia");
    expect(screen.getByTestId("pv-pages")).toHaveTextContent("Subskrypcje");
    expect(screen.getByTestId("pv-block")).toHaveTextContent("2:00 PM");
    expect(screen.queryByTestId("pv-toast")).toBeNull();
  });

  it("bez bloków: pusty dzień", () => {
    pokaz(2, { ...draft, blocks: [] });
    expect(screen.getByText("Pusty dzień. W kroku 3 dodasz pierwsze bloki.")).toBeInTheDocument();
  });

  it("w kroku 4 ze zgodą pokazuje dymek przypomnienia", () => {
    pokaz(4);
    expect(screen.getByTestId("pv-toast")).toHaveTextContent("Za 5 min · Zajęcia");
  });
});
