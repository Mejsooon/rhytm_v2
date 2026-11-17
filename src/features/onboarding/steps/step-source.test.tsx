import { render, screen } from "@testing-library/react";
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
  weeklyKm: 25,
  sleepGoalMin: 480,
  source: null,
  sourceOther: "",
  pages: null,
  notify: { perm: false, before: true, renew: true, weekly: true, habits: false },
};

function Probe() {
  const [d, setD] = useState(start);
  return <StepSource draft={d} onChange={setD} />;
}

describe("StepSource", () => {
  it("pokazuje 10 źródeł", () => {
    render(<Probe />);
    expect(screen.getAllByRole("button")).toHaveLength(10);
  });

  it("„Inne” pokazuje „Gdzie dokładnie?”, ponowny klik odznacza i chowa pole", async () => {
    render(<Probe />);
    expect(screen.queryByLabelText("Gdzie dokładnie?")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Inne" }));
    expect(screen.getByLabelText("Gdzie dokładnie?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Inne" }));
    expect(screen.queryByLabelText("Gdzie dokładnie?")).not.toBeInTheDocument();
  });

  it("jeden wybór: kliknięcie innego zastępuje poprzedni", async () => {
    render(<Probe />);
    await userEvent.click(screen.getByRole("button", { name: "TikTok" }));
    await userEvent.click(screen.getByRole("button", { name: "YouTube" }));
    expect(screen.getByRole("button", { name: "TikTok" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "YouTube" })).toHaveAttribute("aria-pressed", "true");
  });
});
