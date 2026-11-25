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
  return <StepRoles draft={d} onChange={setD} />;
}

describe("StepRoles", () => {
  it("Student pokazuje „Kierunek studiów” i „W kalendarzu: Studia”", async () => {
    render(<Probe initial={start} />);
    expect(screen.queryByLabelText(/Kierunek studiów/)).not.toBeInTheDocument();
    const web = within(screen.getByTestId("roles-web"));
    await userEvent.click(web.getByRole("button", { name: /Student/ }));
    expect(screen.getByLabelText(/Kierunek studiów/)).toBeInTheDocument();
    const kalendarz = within(screen.getByTestId("roles-calendar-web"));
    expect(kalendarz.getByText("W kalendarzu:")).toBeInTheDocument();
    expect(kalendarz.getByText("Studia")).toBeInTheDocument();
  });

  it("odznaczenie wszystkiego: „W kalendarzu: Dom”", async () => {
    render(<Probe initial={{ ...start, roles: ["student", "sport"] }} />);
    const kalendarz = within(screen.getByTestId("roles-calendar-web"));
    expect(kalendarz.getByText("Studia")).toBeInTheDocument();
    expect(kalendarz.getByText("Sport")).toBeInTheDocument();
    const web = within(screen.getByTestId("roles-web"));
    await userEvent.click(web.getByRole("button", { name: /Student/ }));
    await userEvent.click(
      web.getByRole("button", { name: /Trenuję regularnie/ }),
    );
    const kalendarzPo = within(screen.getByTestId("roles-calendar-web"));
    expect(kalendarzPo.getByText("Dom")).toBeInTheDocument();
    expect(kalendarzPo.queryByText("Studia")).not.toBeInTheDocument();
  });

  it("wariant telefonu: Checkbox przełącza rolę", async () => {
    render(<Probe initial={start} />);
    const tel = within(screen.getByTestId("roles-phone"));
    await userEvent.click(tel.getByRole("checkbox", { name: /Pracuję/ }));
    expect(
      within(screen.getByTestId("roles-calendar-web")).getByText("Praca"),
    ).toBeInTheDocument();
  });

  // Wygląd wg COnboardingRole
  it("wygląd: karty wyboru z kwadracikiem 16 px, zaznaczona ma ciemniejszą ramkę i tło", () => {
    render(<Probe initial={{ ...start, roles: ["student"] }} />);
    const web = within(screen.getByTestId("roles-web"));
    const wlaczona = web.getByRole("button", { name: /Student/ });
    const wylaczona = web.getByRole("button", { name: /Pracuję/ });
    expect(wlaczona).toHaveClass("rounded-lg");
    expect(wlaczona.className).toContain("bg-black/[.025]");
    expect(wylaczona.className).not.toContain("bg-black/[.025]");
    expect(wlaczona.querySelector("span.size-4")).not.toBeNull();
    expect(wlaczona.querySelector("span.size-4")).toHaveClass("bg-primary");
    expect(wylaczona.querySelector("span.size-4")).not.toHaveClass(
      "bg-primary",
    );
  });

  it("wygląd: „W kalendarzu:” z plakietkami kategorii w ramce", () => {
    render(<Probe initial={{ ...start, roles: ["student", "sport"] }} />);
    const ramka = screen.getByTestId("roles-calendar-web");
    expect(ramka).toHaveClass("rounded-lg");
    expect(ramka).toHaveClass("border");
    expect(within(ramka).getAllByText(/^(Studia|Sport)$/)).toHaveLength(2);
  });

  it("bez font-mono", () => {
    const { container } = render(<Probe initial={start} />);
    expect(container.innerHTML).not.toContain("font-mono");
  });

  it("telefon (CMOnboarding): karta z wierszami m-row role=checkbox, zaznaczony wiersz z tłem, chipy kategorii z kolorem z danych", async () => {
    render(<Probe initial={{ ...start, roles: ["student"] }} />);
    const karta = screen.getByTestId("roles-phone");
    const wiersze = within(karta).getAllByRole("checkbox");
    expect(wiersze).toHaveLength(5);
    expect(wiersze[0]).toHaveClass("m-row", "bg-black/[.025]");
    expect(wiersze[1]).not.toHaveClass("bg-black/[.025]");
    await userEvent.click(within(karta).getByRole("checkbox", { name: /Pracuję/ }));
    expect(
      within(karta).getByRole("checkbox", { name: /Pracuję/ }),
    ).toHaveAttribute("aria-checked", "true");
    // „W kalendarzu” to etykieta .lbl, nie wersaliki mono
    const etykieta = within(screen.getByTestId("roles-calendar-phone")).getByText(
      "W kalendarzu",
    );
    expect(etykieta).toHaveClass("text-xs", "font-medium");
    expect(etykieta).not.toHaveClass("uppercase");
  });
});
