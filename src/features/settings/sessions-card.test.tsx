import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { revokeSession, signOutOtherSessions } = vi.hoisted(() => ({
  revokeSession: vi.fn(),
  signOutOtherSessions: vi.fn(),
}));
vi.mock("./account-actions", () => ({ revokeSession, signOutOtherSessions }));

import { SessionsCard, type SessionItem } from "./sessions-card";

const BIEZACA: SessionItem = {
  id: "s0",
  label: "Chrome · Linux",
  mobile: false,
  lastActiveAt: "2026-11-24T11:00:00Z",
  current: true,
};
function inna(i: number, lastActiveAt = "2026-11-24T07:02:00Z"): SessionItem {
  return {
    id: `s${i}`,
    label: i === 1 ? "Safari · iPhone" : `Firefox · Windows ${i}`,
    mobile: i === 1,
    lastActiveAt,
    current: false,
  };
}
const bazowe = {
  loadError: false,
  currentLabel: "Chrome · Linux",
  currentMobile: false,
  timeZone: "Europe/Warsaw",
};
function wszystkieInne() {
  return screen.getByRole("button", { name: "Wyloguj wszystkie inne" });
}

describe("SessionsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    // 24.11.2026 12:30 w Warszawie
    vi.setSystemTime(new Date("2026-11-24T11:30:00Z"));
    revokeSession.mockResolvedValue({ ok: true });
    signOutOtherSessions.mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [0, "1 aktywna sesja"],
    [1, "2 aktywne sesje"],
    [4, "5 aktywnych sesji"],
    [11, "12 aktywnych sesji"],
    [21, "22 aktywne sesje"],
  ])("%i innych → „%s”", (ile, tekst) => {
    const lista = [
      BIEZACA,
      ...Array.from({ length: ile }, (_, i) => inna(i + 1)),
    ];
    render(<SessionsCard {...bazowe} sessions={lista} />);
    expect(screen.getByText(tekst)).toBeInTheDocument();
  });

  it("bieżąca z „Aktualna” bez „Wyloguj”, inne z „Wyloguj” i czasem w strefie profilu", () => {
    render(
      <SessionsCard
        {...bazowe}
        sessions={[
          BIEZACA,
          inna(1, "2026-11-24T07:02:00Z"),
          inna(2, "2026-11-23T20:14:00Z"),
          inna(3, "2026-11-12T07:02:00Z"),
        ]}
      />,
    );
    expect(screen.getByText("teraz · ta sesja")).toBeInTheDocument();
    expect(screen.getByText("Aktualna")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Wyloguj: Chrome · Linux" }),
    ).toBeNull();
    expect(screen.getByText("dziś 08:02")).toBeInTheDocument();
    expect(screen.getByText("wczoraj 21:14")).toBeInTheDocument();
    expect(screen.getByText("12.11 08:02")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Wyloguj: / })).toHaveLength(
      3,
    );
  });

  it("„Wyloguj” innej sesji → komunikat „Wylogowano: …” i wiersz znika", async () => {
    render(<SessionsCard {...bazowe} sessions={[BIEZACA, inna(1)]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Wyloguj: Safari · iPhone" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Wylogowano: Safari · iPhone",
      ),
    );
    expect(revokeSession).toHaveBeenCalledWith("s1");
    expect(screen.queryByText("Safari · iPhone")).toBeNull();
    expect(screen.getByText("1 aktywna sesja")).toBeInTheDocument();
  });

  it("wygasła sesja → komunikat z akcji", async () => {
    revokeSession.mockResolvedValue({
      ok: false,
      message: "Ta sesja już wygasła.",
    });
    render(<SessionsCard {...bazowe} sessions={[BIEZACA, inna(1)]} />);
    fireEvent.click(
      screen.getByRole("button", { name: "Wyloguj: Safari · iPhone" }),
    );
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Ta sesja już wygasła.",
      ),
    );
  });

  it("„Wyloguj wszystkie inne” → komunikat i przycisk nieaktywny", async () => {
    render(<SessionsCard {...bazowe} sessions={[BIEZACA, inna(1), inna(2)]} />);
    expect(wszystkieInne()).toHaveAttribute("aria-disabled", "false");
    fireEvent.click(wszystkieInne());
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent(
        "Wylogowano wszystkie inne urządzenia ✓",
      ),
    );
    expect(signOutOtherSessions).toHaveBeenCalledTimes(1);
    expect(wszystkieInne()).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button", { name: /^Wyloguj: / })).toBeNull();
  });

  it("bez innych sesji przycisk nieaktywny i nie wywołuje akcji", () => {
    render(<SessionsCard {...bazowe} sessions={[BIEZACA]} />);
    expect(wszystkieInne()).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(wszystkieInne());
    expect(signOutOtherSessions).not.toHaveBeenCalled();
  });

  it("loadError → bieżąca z nagłówka, komunikat i aktywny „Wyloguj wszystkie inne”", () => {
    render(
      <SessionsCard
        {...bazowe}
        sessions={[]}
        loadError
        currentLabel="Safari · iPhone"
        currentMobile
      />,
    );
    expect(screen.getByText("Safari · iPhone")).toBeInTheDocument();
    expect(screen.getByText("teraz · ta sesja")).toBeInTheDocument();
    expect(
      screen.getByText("Nie udało się wczytać listy sesji."),
    ).toBeInTheDocument();
    expect(wszystkieInne()).toHaveAttribute("aria-disabled", "false");
  });
});
