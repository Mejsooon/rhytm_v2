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
  goalType: "workouts",
  weeklyWorkouts: 3,
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
  it("„Cel treningowy”: domyślnie 3 treningi / tydz., licznik i pole web", () => {
    render(<Probe initial={start} />);
    expect(screen.getByText("Cel treningowy")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Treningi / tydz." })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Km / tydz." })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("group", { name: "Treningi w tygodniu" })).toHaveTextContent("3");
    expect(screen.getByLabelText("Treningi w tygodniu", { selector: "input" })).toHaveValue("3");
    expect(screen.getByText("8:00")).toBeInTheDocument();
  });

  it("zmiana na km pokazuje „25 km”, a powrót zostawia liczbę treningów", async () => {
    render(<Probe initial={{ ...start, weeklyWorkouts: 5 }} />);
    await userEvent.click(screen.getByRole("radio", { name: "Km / tydz." }));
    expect(screen.getByText("25 km")).toBeInTheDocument();
    expect(screen.getByLabelText("Kilometry w tygodniu", { selector: "input" })).toHaveValue("25");
    await userEvent.click(screen.getByRole("radio", { name: "Treningi / tydz." }));
    expect(screen.getByRole("group", { name: "Treningi w tygodniu" })).toHaveTextContent("5");
  });

  it("odznaczenie „Treningi” chowa „Cel treningowy”", async () => {
    render(<Probe initial={start} />);
    await userEvent.click(screen.getByRole("button", { name: /^Treningi/ }));
    expect(screen.queryByText("Cel treningowy")).not.toBeInTheDocument();
    expect(screen.getByText("Cel snu")).toBeInTheDocument();
  });

  it("treningi co 1 w zakresie 1–14", async () => {
    render(<Probe initial={start} />);
    await userEvent.click(screen.getByRole("button", { name: "Zwiększ Treningi w tygodniu" }));
    expect(screen.getByRole("group", { name: "Treningi w tygodniu" })).toHaveTextContent("4");
    expect(screen.getByLabelText("Treningi w tygodniu", { selector: "input" })).toHaveValue("4");
  });

  it("„+” przy 14 treningach i przy 150 km jest nieaktywny", () => {
    const { unmount } = render(<Probe initial={{ ...start, weeklyWorkouts: 14 }} />);
    expect(screen.getByRole("button", { name: "Zwiększ Treningi w tygodniu" })).toBeDisabled();
    unmount();
    render(<Probe initial={{ ...start, goalType: "km", weeklyKm: 150 }} />);
    expect(screen.getByRole("button", { name: "Zwiększ Kilometry w tygodniu" })).toBeDisabled();
  });

  it("„+” zwiększa km o 5, a cel snu o 15 min", async () => {
    render(<Probe initial={{ ...start, goalType: "km" }} />);
    await userEvent.click(screen.getByRole("button", { name: "Zwiększ Kilometry w tygodniu" }));
    expect(screen.getByText("30 km")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Zwiększ Cel snu/ }));
    expect(screen.getByText("8:15")).toBeInTheDocument();
  });

  it("pole web: liczba spoza 1–14 pokazuje błąd, poprawna trafia do szkicu", async () => {
    render(<Probe initial={start} />);
    const pole = screen.getByLabelText("Treningi w tygodniu", { selector: "input" });
    await userEvent.clear(pole);
    await userEvent.type(pole, "20");
    expect(screen.getByText("Podaj liczbę 1–14.")).toBeInTheDocument();
    await userEvent.clear(pole);
    await userEvent.type(pole, "6");
    expect(screen.queryByText("Podaj liczbę 1–14.")).not.toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Treningi w tygodniu" })).toHaveTextContent("6");
  });

  it("pole web: km spoza 1–300 pokazuje błąd", async () => {
    render(<Probe initial={{ ...start, goalType: "km" }} />);
    const pole = screen.getByLabelText("Kilometry w tygodniu", { selector: "input" });
    await userEvent.clear(pole);
    await userEvent.type(pole, "301");
    expect(screen.getByText("Podaj liczbę 1–300.")).toBeInTheDocument();
  });

  it("pole web: km „22,5” jest poprawne, a licznik z 42 km idzie do 45 km", async () => {
    const { unmount } = render(<Probe initial={{ ...start, goalType: "km" }} />);
    const pole = screen.getByLabelText("Kilometry w tygodniu", { selector: "input" });
    await userEvent.clear(pole);
    await userEvent.type(pole, "22,5");
    expect(screen.queryByText("Podaj liczbę 1–300.")).not.toBeInTheDocument();
    expect(screen.getByText("22.5 km")).toBeInTheDocument();
    unmount();
    render(<Probe initial={{ ...start, goalType: "km", weeklyKm: 42 }} />);
    await userEvent.click(screen.getByRole("button", { name: "Zwiększ Kilometry w tygodniu" }));
    expect(screen.getByText("45 km")).toBeInTheDocument();
  });

  it("licznik przy 200 km z pola web: „−” wraca do 150 km", async () => {
    render(<Probe initial={{ ...start, goalType: "km", weeklyKm: 200 }} />);
    await userEvent.click(screen.getByRole("button", { name: "Zmniejsz Kilometry w tygodniu" }));
    expect(screen.getByText("150 km")).toBeInTheDocument();
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
