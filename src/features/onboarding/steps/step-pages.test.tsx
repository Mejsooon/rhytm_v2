import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { OnboardingDraft } from "../model";
import { effectivePages } from "../model";
import { StepPages } from "./step-pages";

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

const web = () => within(screen.getByTestId("pages-web"));
const phone = () => within(screen.getByTestId("pages-phone"));

function Probe() {
  const [d, setD] = useState(start);
  return (
    <>
      <StepPages draft={d} onChange={setD} />
      <output data-testid="out">{effectivePages(d).join(",")}</output>
    </>
  );
}

describe("StepPages", () => {
  it("3 strony, nic nie zaznaczone na start, bez plakietki „z Twoich celów”", () => {
    render(<Probe />);
    expect(web().getAllByRole("button")).toHaveLength(3);
    expect(phone().getAllByRole("checkbox")).toHaveLength(3);
    for (const nazwa of [/Projects/, /Books/, /Websites/]) {
      expect(web().getByRole("button", { name: nazwa })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(phone().getByRole("checkbox", { name: nazwa })).not.toBeChecked();
    }
    expect(screen.queryByText(/Passwords|Subscriptions/)).toBeNull();
    expect(screen.queryByText("z Twoich celów")).toBeNull();
    expect(screen.getByTestId("out")).toBeEmptyDOMElement();
  });

  it("klik dodaje stronę, ponowny klik zdejmuje; kolejność jak w sidebarze", async () => {
    render(<Probe />);
    await userEvent.click(web().getByRole("button", { name: /Websites/ }));
    await userEvent.click(web().getByRole("button", { name: /Projects/ }));
    expect(screen.getByTestId("out")).toHaveTextContent("Projects,Websites");
    await userEvent.click(phone().getByRole("checkbox", { name: /Projects/ }));
    expect(screen.getByTestId("out")).toHaveTextContent(/^Websites$/);
  });

  it("pokazuje teksty web i telefon", () => {
    render(<Probe />);
    expect(
      screen.getByText(
        "Dodamy te strony do sidebaru. Każdą zmienisz albo usuniesz później.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Dodamy te strony do listy Stron/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Pustą stronę i kolejne szablony dodasz później przyciskiem „Nowa strona” w sidebarze/,
      ),
    ).toBeInTheDocument();
  });

  // Wygląd wg COnboardingPages
  it("wygląd: karty szablonów jak .opt, kwadracik 16 px, pola jako szare plakietki", async () => {
    render(<Probe />);
    const projects = web().getByRole("button", { name: /Projects/ });
    const books = web().getByRole("button", { name: /Books/ });
    await userEvent.click(projects);
    expect(projects.className).toContain("min-[800px]:bg-black/[.025]");
    expect(books.className).not.toContain("min-[800px]:bg-black/[.025]");
    expect(projects.querySelector("span.size-4[aria-hidden]")).not.toBeNull();
    expect(web().getAllByText("Status")[0]).toHaveClass("bg-muted");
    expect(web().getAllByText("URL")[0]).toHaveClass("bg-muted");
  });

  it("bez font-mono", () => {
    const { container } = render(<Probe />);
    expect(container.innerHTML).not.toContain("font-mono");
  });
});
