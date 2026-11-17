import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { OnboardingDraft } from "../model";
import { StepGoals } from "./step-goals";

const start: OnboardingDraft = {
  name: "M",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "24",
  roles: [],
  studyField: "",
  goals: ["sport", "habits"],
  weeklyKm: 25,
  sleepGoalMin: 480,
  source: null,
  sourceOther: "",
  pages: null,
  notify: { perm: false, before: true, renew: true, weekly: true, habits: false },
};

function Probe({ initial }: { initial: OnboardingDraft }) {
  const [d, setD] = useState(initial);
  return <StepGoals draft={d} onChange={setD} />;
}

describe("StepGoals", () => {
  it("pokazuje liczniki „25 km” i „8:00”", () => {
    render(<Probe initial={start} />);
    expect(screen.getByText("Kilometry w tygodniu")).toBeInTheDocument();
    expect(screen.getByText("25 km")).toBeInTheDocument();
    expect(screen.getByText("8:00")).toBeInTheDocument();
  });

  it("odznaczenie „Treningi” chowa „Kilometry w tygodniu”", async () => {
    render(<Probe initial={start} />);
    await userEvent.click(screen.getByRole("button", { name: /Treningi/ }));
    expect(screen.queryByText("Kilometry w tygodniu")).not.toBeInTheDocument();
    expect(screen.getByText("Cel snu")).toBeInTheDocument();
  });

  it("„+” przy 150 km jest nieaktywny", () => {
    render(<Probe initial={{ ...start, weeklyKm: 150 }} />);
    expect(screen.getByRole("button", { name: /Zwiększ Kilometry/ })).toBeDisabled();
  });

  it("„+” zwiększa km o 5, a cel snu o 15 min", async () => {
    render(<Probe initial={start} />);
    await userEvent.click(screen.getByRole("button", { name: /Zwiększ Kilometry/ }));
    expect(screen.getByText("30 km")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Zwiększ Cel snu/ }));
    expect(screen.getByText("8:15")).toBeInTheDocument();
  });

  it("wybór celu z stroną włącza stronę w szkicu", async () => {
    render(<Probe initial={start} />);
    await userEvent.click(screen.getByRole("button", { name: /Subskrypcje/ }));
    expect(screen.getByRole("button", { name: /Subskrypcje/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
});
