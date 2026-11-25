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

function Probe({ initial }: { initial: OnboardingDraft }) {
  const [d, setD] = useState(initial);
  return <StepGoals draft={d} onChange={setD} />;
}

describe("StepGoals", () => {
  it("„Cele treningowe”: treningi włączone z licznikiem i polem, km wyłączone", () => {
    render(<Probe initial={start} />);
    expect(screen.getByText(/^Cele treningowe/)).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Treningi w tygodniu" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("checkbox", { name: "Kilometry biegu w tygodniu" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("group", { name: "Treningi w tygodniu" }),
    ).toHaveTextContent("3");
    expect(
      screen.getByLabelText("Treningi w tygodniu", { selector: "input" }),
    ).toHaveValue("3");
    // Wyłączony cel: nieaktywne pole web „—” i „wyłączony” na telefonie
    expect(
      screen.getByLabelText("Kilometry biegu w tygodniu", {
        selector: "input",
      }),
    ).toBeDisabled();
    expect(screen.getByText("wyłączony")).toBeInTheDocument();
    expect(screen.getByText("8:00")).toBeInTheDocument();
  });

  it("oba cele naraz: włączenie km pokazuje „25 km” obok treningów", async () => {
    render(<Probe initial={{ ...start, weeklyWorkouts: 5 }} />);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Kilometry biegu w tygodniu" }),
    );
    expect(screen.getByText("25 km")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Kilometry biegu w tygodniu", {
        selector: "input",
      }),
    ).toHaveValue("25");
    expect(
      screen.getByRole("group", { name: "Treningi w tygodniu" }),
    ).toHaveTextContent("5");
  });

  it("wyłączenie obu celów pokazuje „Włącz co najmniej jeden cel.”", async () => {
    render(<Probe initial={start} />);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Treningi w tygodniu" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Włącz co najmniej jeden cel.",
    );
  });

  it("wyłączenie celu ze złą liczbą przywraca domyślną", async () => {
    render(<Probe initial={{ ...start, kmOn: true }} />);
    const pole = screen.getByLabelText("Treningi w tygodniu", {
      selector: "input",
    });
    await userEvent.clear(pole);
    await userEvent.type(pole, "20");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Treningi w tygodniu" }),
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Treningi w tygodniu" }),
    );
    expect(
      screen.getByLabelText("Treningi w tygodniu", { selector: "input" }),
    ).toHaveValue("3");
  });

  it("teksty kroku 3 i brak kafelków celów", () => {
    render(<Probe initial={start} />);
    expect(
      screen.getByRole("heading", { name: "Twoje cele" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Zmienisz je później w Ustawieniach."),
    ).toBeInTheDocument();
    expect(screen.getByText("Zawsze masz:")).toBeInTheDocument();
    expect(
      screen.getByText(/Plan tygodnia · Treningi · Nawyki i sen · Hasła/),
    ).toBeInTheDocument();
    expect(screen.getByText("· włącz jeden albo oba")).toBeInTheDocument();
    expect(screen.getByText("Cel snu")).toBeInTheDocument();
    // Żadnych kafelków celów (to były przyciski z aria-pressed)
    expect(
      screen.queryByRole("button", { pressed: true }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Subskrypcje|Książki|Projekty/)).toBeNull();
    expect(screen.queryByText(/Co chcesz ogarnąć/)).toBeNull();
  });

  it("treningi co 1 w zakresie 1–14", async () => {
    render(<Probe initial={start} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Zwiększ Treningi w tygodniu" }),
    );
    expect(
      screen.getByRole("group", { name: "Treningi w tygodniu" }),
    ).toHaveTextContent("4");
    expect(
      screen.getByLabelText("Treningi w tygodniu", { selector: "input" }),
    ).toHaveValue("4");
  });

  it("„+” przy 14 treningach i przy 150 km jest nieaktywny", () => {
    const { unmount } = render(
      <Probe initial={{ ...start, weeklyWorkouts: 14 }} />,
    );
    expect(
      screen.getByRole("button", { name: "Zwiększ Treningi w tygodniu" }),
    ).toBeDisabled();
    unmount();
    render(
      <Probe
        initial={{ ...start, workoutsOn: false, kmOn: true, weeklyKm: 150 }}
      />,
    );
    expect(
      screen.getByRole("button", {
        name: "Zwiększ Kilometry biegu w tygodniu",
      }),
    ).toBeDisabled();
  });

  it("„+” zwiększa km o 5, a cel snu o 15 min", async () => {
    render(<Probe initial={{ ...start, workoutsOn: false, kmOn: true }} />);
    await userEvent.click(
      screen.getByRole("button", {
        name: "Zwiększ Kilometry biegu w tygodniu",
      }),
    );
    expect(screen.getByText("30 km")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Zwiększ Cel snu/ }),
    );
    expect(screen.getByText("8:15")).toBeInTheDocument();
  });

  it("pole web: liczba spoza 1–14 pokazuje błąd, poprawna trafia do szkicu", async () => {
    render(<Probe initial={start} />);
    const pole = screen.getByLabelText("Treningi w tygodniu", {
      selector: "input",
    });
    await userEvent.clear(pole);
    await userEvent.type(pole, "20");
    expect(screen.getByText("Podaj liczbę 1–14.")).toBeInTheDocument();
    await userEvent.clear(pole);
    await userEvent.type(pole, "6");
    expect(screen.queryByText("Podaj liczbę 1–14.")).not.toBeInTheDocument();
    expect(
      screen.getByRole("group", { name: "Treningi w tygodniu" }),
    ).toHaveTextContent("6");
  });

  it("pole web: km spoza 1–300 pokazuje błąd", async () => {
    render(<Probe initial={{ ...start, workoutsOn: false, kmOn: true }} />);
    const pole = screen.getByLabelText("Kilometry biegu w tygodniu", {
      selector: "input",
    });
    await userEvent.clear(pole);
    await userEvent.type(pole, "301");
    expect(screen.getByText("Podaj liczbę 1–300.")).toBeInTheDocument();
  });

  it("pole web: km „22,5” jest poprawne, a licznik z 42 km idzie do 45 km", async () => {
    const { unmount } = render(
      <Probe initial={{ ...start, workoutsOn: false, kmOn: true }} />,
    );
    const pole = screen.getByLabelText("Kilometry biegu w tygodniu", {
      selector: "input",
    });
    await userEvent.clear(pole);
    await userEvent.type(pole, "22,5");
    expect(screen.queryByText("Podaj liczbę 1–300.")).not.toBeInTheDocument();
    expect(screen.getByText("22,5 km")).toBeInTheDocument();
    unmount();
    render(
      <Probe
        initial={{ ...start, workoutsOn: false, kmOn: true, weeklyKm: 42 }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Zwiększ Kilometry biegu w tygodniu",
      }),
    );
    expect(screen.getByText("45 km")).toBeInTheDocument();
  });

  it("zapisane 22.5 km: licznik i pole web z przecinkiem", () => {
    render(
      <Probe
        initial={{ ...start, workoutsOn: false, kmOn: true, weeklyKm: 22.5 }}
      />,
    );
    expect(screen.getByText("22,5 km")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Kilometry biegu w tygodniu", {
        selector: "input",
      }),
    ).toHaveValue("22,5");
  });

  it("licznik przy 200 km z pola web: „−” wraca do 150 km", async () => {
    render(
      <Probe
        initial={{ ...start, workoutsOn: false, kmOn: true, weeklyKm: 200 }}
      />,
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "Zmniejsz Kilometry biegu w tygodniu",
      }),
    );
    expect(screen.getByText("150 km")).toBeInTheDocument();
  });

  it("wygląd: pola liczb z tabular-nums, cel snu jako Stepper wide w połowie kolumny", () => {
    render(<Probe initial={start} />);
    expect(
      screen.getByLabelText("Treningi w tygodniu", { selector: "input" }),
    ).toHaveClass("tabular-nums");
    const sen = screen.getByRole("group", { name: "Cel snu" });
    // Szeroki Stepper tylko od 800 px; na telefonie zwykły m-step
    expect(sen).toHaveClass("min-[800px]:h-8");
    expect(sen).not.toHaveClass("h-8");
    expect(sen.parentElement).toHaveClass("min-[800px]:w-1/2");
  });

  it("bez font-mono", () => {
    const { container } = render(<Probe initial={{ ...start, kmOn: true }} />);
    expect(container.innerHTML).not.toContain("font-mono");
  });

  it("telefon (CMOnboarding): notka o zawsze włączonych modułach i haśle głównym sejfu", () => {
    render(<Probe initial={start} />);
    const notka = screen.getByText(/Hasło główne sejfu ustawisz przy pierwszym otwarciu Haseł\./);
    expect(notka).toHaveClass("min-[800px]:hidden");
    expect(screen.getByText("Zawsze masz:").parentElement).toHaveClass("max-[799px]:hidden");
  });
});
