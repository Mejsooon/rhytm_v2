import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { OnboardingDraft } from "../model";
import { StepNotify, requestBrowserPermission } from "./step-notify";

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

const web = () => within(screen.getByTestId("notify-web"));
const phone = () => within(screen.getByTestId("notify-phone"));

function Probe() {
  const [d, setD] = useState(start);
  return (
    <>
      <StepNotify draft={d} onChange={setD} />
      <output data-testid="out">{JSON.stringify(d.notify)}</output>
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("requestBrowserPermission", () => {
  it("bez window.Notification zwraca 'unsupported'", async () => {
    vi.stubGlobal("Notification", undefined);
    expect(await requestBrowserPermission()).toBe("unsupported");
  });

  it("wyjątek z requestPermission daje 'denied'", async () => {
    vi.stubGlobal("Notification", {
      requestPermission: () => Promise.reject(new Error("x")),
    });
    expect(await requestBrowserPermission()).toBe("denied");
  });

  it("granted i denied przechodzą dalej", async () => {
    vi.stubGlobal("Notification", {
      requestPermission: () => Promise.resolve("granted"),
    });
    expect(await requestBrowserPermission()).toBe("granted");
    vi.stubGlobal("Notification", {
      requestPermission: () => Promise.resolve("default"),
    });
    expect(await requestBrowserPermission()).toBe("denied");
  });
});

describe("StepNotify", () => {
  it("brak API: „Zezwól” nie rzuca, zostaje i pokazuje odmowę", async () => {
    vi.stubGlobal("Notification", undefined);
    render(<Probe />);
    expect(web().getByText("Przeglądarka zapyta o zgodę")).toBeInTheDocument();
    await userEvent.click(web().getByRole("button", { name: "Zezwól" }));
    expect(web().getByRole("button", { name: "Zezwól" })).toBeInTheDocument();
    expect(
      web().getByText("Przeglądarka nie pozwoliła na powiadomienia"),
    ).toBeInTheDocument();
    expect(
      phone().getByText("Telefon nie pozwolił na powiadomienia"),
    ).toBeInTheDocument();
  });

  it("granted: „Włączone” i „Anuluj”; „Anuluj” wraca do „Zezwól”", async () => {
    vi.stubGlobal("Notification", {
      requestPermission: () => Promise.resolve("granted"),
    });
    render(<Probe />);
    await userEvent.click(web().getByRole("button", { name: "Zezwól" }));
    expect(web().getByText("Włączone")).toBeInTheDocument();
    expect(
      web().getByText("Przeglądarka pozwoliła na powiadomienia"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("out")).toHaveTextContent('"perm":true');
    // „Anuluj” bez ramki (ghost, .btng z makiet)
    expect(web().getByRole("button", { name: "Anuluj" })).toHaveClass("border-transparent", "bg-transparent", "hover:bg-accent");
    await userEvent.click(web().getByRole("button", { name: "Anuluj" }));
    expect(web().getByRole("button", { name: "Zezwól" })).toBeInTheDocument();
    expect(screen.getByTestId("out")).toHaveTextContent('"perm":false');
  });

  it("przełącznik „Nawyki na dziś” zmienia notify.habits", async () => {
    render(<Probe />);
    expect(web().getAllByRole("switch")).toHaveLength(4);
    await userEvent.click(
      web().getByRole("switch", { name: "Nawyki na dziś" }),
    );
    expect(screen.getByTestId("out")).toHaveTextContent('"habits":true');
    await userEvent.click(
      phone().getByRole("switch", { name: "Nawyki na dziś" }),
    );
    expect(screen.getByTestId("out")).toHaveTextContent('"habits":false');
  });

  it("telefon bez zgody przyciemnia wiersze, ale są klikalne", () => {
    render(<Probe />);
    const wiersz = phone()
      .getByRole("switch", { name: "Przed blokiem" })
      .closest("[data-reminder-row]");
    expect(wiersz).toHaveClass("opacity-[.55]");
  });
});
