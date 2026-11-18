import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { OnboardingDraft } from "../model";
import { StepRoles } from "./step-roles";

const start: OnboardingDraft = {
  name: "M",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "24",
  roles: [],
  studyField: "",
  goals: [],
  goalType: "workouts",
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

function Probe({ initial }: { initial: OnboardingDraft }) {
  const [d, setD] = useState(initial);
  return <StepRoles draft={d} onChange={setD} />;
}

describe("StepRoles", () => {
  it("Student pokazuje „Kierunek studiów” i „W kalendarzu: Studia”", async () => {
    render(<Probe initial={start} />);
    expect(screen.queryByLabelText(/Kierunek studiów/)).not.toBeInTheDocument();
    const web = within(screen.getByTestId("roles-web"));
    await userEvent.click(web.getByRole("button", { name: /Student/ }));
    expect(screen.getByLabelText(/Kierunek studiów/)).toBeInTheDocument();
    expect(screen.getByText("W kalendarzu: Studia")).toBeInTheDocument();
  });

  it("odznaczenie wszystkiego: „W kalendarzu: Dom”", async () => {
    render(<Probe initial={{ ...start, roles: ["student", "sport"] }} />);
    expect(screen.getByText("W kalendarzu: Studia, Sport")).toBeInTheDocument();
    const web = within(screen.getByTestId("roles-web"));
    await userEvent.click(web.getByRole("button", { name: /Student/ }));
    await userEvent.click(
      web.getByRole("button", { name: /Trenuję regularnie/ }),
    );
    expect(screen.getByText("W kalendarzu: Dom")).toBeInTheDocument();
  });

  it("wariant telefonu: Checkbox przełącza rolę", async () => {
    render(<Probe initial={start} />);
    const tel = within(screen.getByTestId("roles-phone"));
    await userEvent.click(tel.getByRole("checkbox", { name: /Pracuję/ }));
    expect(screen.getByText("W kalendarzu: Praca")).toBeInTheDocument();
  });
});
