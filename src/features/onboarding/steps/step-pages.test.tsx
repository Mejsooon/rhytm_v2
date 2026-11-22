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
  goals: ["subs", "proj"],
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
  it("zaznacza strony z celów i oznacza je plakietką „z Twoich celów”", () => {
    render(<Probe />);
    expect(web().getAllByRole("button")).toHaveLength(5);
    expect(
      web().getByRole("button", { name: /Subscriptions/ }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(web().getByRole("button", { name: /Projects/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(web().getByRole("button", { name: /Books/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(web().getAllByText("z Twoich celów")).toHaveLength(2);
    expect(phone().getAllByText("z Twoich celów")).toHaveLength(2);
    expect(
      phone().getByRole("checkbox", { name: /Subscriptions/ }),
    ).toBeChecked();
  });

  it("klik „Books” dodaje Books, ponowny klik zdejmuje", async () => {
    render(<Probe />);
    await userEvent.click(web().getByRole("button", { name: /Books/ }));
    expect(screen.getByTestId("out")).toHaveTextContent(
      "Subscriptions,Projects,Books",
    );
    await userEvent.click(phone().getByRole("checkbox", { name: /Books/ }));
    expect(screen.getByTestId("out")).toHaveTextContent(
      "Subscriptions,Projects",
    );
    expect(screen.getByTestId("out")).not.toHaveTextContent("Books");
  });

  it("pokazuje teksty web i telefon", () => {
    render(<Probe />);
    expect(
      screen.getByText(/Dodamy te strony do sidebaru/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Dodamy te strony do listy Stron/),
    ).toBeInTheDocument();
  });

  // Wygląd wg COnboardingPages
  it("wygląd: karty szablonów jak .opt, kwadracik 16 px, pola jako szare plakietki", () => {
    render(<Probe />);
    const subs = web().getByRole("button", { name: /Subscriptions/ });
    const books = web().getByRole("button", { name: /Books/ });
    expect(subs.className).toContain("min-[800px]:bg-black/[.025]");
    expect(books.className).not.toContain("min-[800px]:bg-black/[.025]");
    expect(subs.querySelector("span.size-4[aria-hidden]")).not.toBeNull();
    expect(web().getByText("Kwota cykliczna")).toHaveClass("bg-muted");
    expect(web().getByText("Data odnowienia")).toBeInTheDocument();
    expect(web().getAllByText("z Twoich celów")[0]).toHaveClass(
      "bg-success-soft",
    );
  });

  it("bez font-mono", () => {
    const { container } = render(<Probe />);
    expect(container.innerHTML).not.toContain("font-mono");
  });
});
