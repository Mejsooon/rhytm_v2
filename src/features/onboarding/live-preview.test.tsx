import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LivePreview } from "./live-preview";
import type { OnboardingDraft } from "./model";

const NOW = new Date("2026-11-17T09:00:00Z");

const draft: OnboardingDraft = {
  name: "Mejson",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "24",
  roles: ["student", "sport"],
  studyField: "Cyberbezpieczeństwo",
  goals: ["plan", "sport", "habits", "subs", "proj"],
  workoutsOn: true,
  kmOn: false,
  weeklyWorkouts: 3,
  weeklyKm: 25,
  sleepGoalMin: 480,
  source: null,
  sourceOther: "",
  pages: ["Subscriptions", "Projects"],
  notify: {
    perm: true,
    before: true,
    renew: true,
    weekly: true,
    habits: false,
  },
};

function pokaz(d: OnboardingDraft, step = 1, avatarUrl: string | null = null) {
  return render(
    <LivePreview draft={d} step={step} avatarUrl={avatarUrl} now={NOW} />,
  );
}

describe("LivePreview", () => {
  it("szkic z makiety: inicjał (jak w makiecie: pierwsze litery słów), data, tydzień, chipy, bloki po godzinie", () => {
    pokaz(draft);
    expect(screen.getAllByText("M").length).toBeGreaterThan(0);
    expect(screen.getByText("Mejson")).toBeInTheDocument();
    expect(screen.getByText("Wtorek, 17 listopada")).toBeInTheDocument();
    expect(
      screen.getByText("Tydzień od poniedziałku · 16–22.11 · zegar 24 h"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("pv-cats")).toHaveTextContent("Studia");
    expect(screen.getByTestId("pv-cats")).toHaveTextContent("Sport");
    const bloki = screen.getAllByTestId("pv-block").map((b) => b.textContent);
    expect(bloki).toEqual([
      "08:00Matematyka — ćwiczenia0/3",
      "17:00Bieg 10 km",
    ]);
    expect(screen.getByText("Subscriptions")).toBeInTheDocument();
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("pusta nazwa: „Ty”, inicjały z dwóch pierwszych słów", () => {
    const { unmount } = pokaz({ ...draft, name: " " });
    expect(screen.getByText("Ty")).toBeInTheDocument();
    unmount();
    pokaz({ ...draft, name: "ala ma kota" });
    expect(screen.getAllByText("AM").length).toBeGreaterThan(0);
  });

  it("zdjęcie zamiast inicjałów", () => {
    pokaz(draft, 1, "https://x.test/a.png");
    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "https://x.test/a.png",
    );
  });

  it("zegar 12 h", () => {
    pokaz({ ...draft, clock: "12" });
    expect(screen.getByText("5:00 PM")).toBeInTheDocument();
    expect(screen.getByText(/zegar 12 h/)).toBeInTheDocument();
  });

  it("tydzień od niedzieli", () => {
    pokaz({ ...draft, weekStart: "sun" });
    expect(
      screen.getByText("Tydzień od niedzieli · 15–21.11 · zegar 24 h"),
    ).toBeInTheDocument();
  });

  it("data liczona w strefie szkicu", () => {
    render(
      <LivePreview
        draft={{ ...draft, timezone: "Asia/Tokyo" }}
        step={1}
        avatarUrl={null}
        now={new Date("2026-11-17T20:00:00Z")}
      />,
    );
    expect(screen.getByText("Środa, 18 listopada")).toBeInTheDocument();
  });

  it("obrys: krok 2 kategorie, krok 1 profil", () => {
    const { unmount } = pokaz(draft, 2);
    expect(screen.getByTestId("pv-cats")).toHaveAttribute(
      "data-highlighted",
      "true",
    );
    expect(screen.getByTestId("pv-profile")).toHaveAttribute(
      "data-highlighted",
      "false",
    );
    unmount();
    pokaz(draft, 1);
    expect(screen.getByTestId("pv-profile")).toHaveAttribute(
      "data-highlighted",
      "true",
    );
    expect(screen.getByTestId("pv-cats")).toHaveAttribute(
      "data-highlighted",
      "false",
    );
  });

  it("obrys listy stron w krokach 3 i 5", () => {
    const { unmount } = pokaz(draft, 3);
    expect(screen.getByTestId("pv-pages")).toHaveAttribute(
      "data-highlighted",
      "true",
    );
    unmount();
    pokaz(draft, 5);
    expect(screen.getByTestId("pv-pages")).toHaveAttribute(
      "data-highlighted",
      "true",
    );
  });

  it("krok 6 z perm i before: dymek", () => {
    pokaz(draft, 6);
    expect(
      screen.getByText("Za 10 min · Matematyka — ćwiczenia"),
    ).toBeInTheDocument();
    expect(screen.getByText("Start o 08:00")).toBeInTheDocument();
  });

  it("krok 6 bez zgody albo bez przypomnienia przed blokiem: brak dymka", () => {
    const { unmount } = pokaz(
      { ...draft, notify: { ...draft.notify, perm: false } },
      6,
    );
    expect(screen.queryByText(/Za 10 min/)).not.toBeInTheDocument();
    unmount();
    pokaz({ ...draft, notify: { ...draft.notify, before: false } }, 6);
    expect(screen.queryByText(/Za 10 min/)).not.toBeInTheDocument();
  });

  it("brak stron", () => {
    pokaz({ ...draft, pages: [] });
    expect(screen.getByText("Brak stron")).toBeInTheDocument();
  });

  it("podgląd: karta z sidebarem (Moduły/Strony) i planem dnia wg COnbPreview", () => {
    const { container } = pokaz(draft);
    // Tło podglądu i karta wewnątrz (inset 32 px, cień lg)
    const tlo = container.firstElementChild as HTMLElement;
    expect(tlo).toHaveClass("bg-black/[.025]");
    const karta = tlo.firstElementChild as HTMLElement;
    expect(karta).toHaveClass(
      "absolute",
      "inset-8",
      "shadow-lg",
      "text-[13px]",
    );
    // Sidebar 180 px z sekcjami Moduły i Strony
    expect(screen.getByText("Moduły")).toBeInTheDocument();
    expect(screen.getByText("Strony")).toBeInTheDocument();
    expect(screen.getByText("Moduły").parentElement).toHaveClass(
      "w-[180px]",
      "bg-panel",
    );
    expect(screen.getByText("Dziś")).toHaveClass("bg-black/[.05]");
    // Plan dnia: tytuł 15/600, chip kategorii jako szara/obrysowa odznaka z kropką
    expect(screen.getByText("Wtorek, 17 listopada")).toHaveClass(
      "text-[15px]",
      "font-semibold",
    );
    const chip = screen.getByTestId("pv-cats").firstElementChild as HTMLElement;
    expect(chip).toHaveClass("h-[22px]", "border-input", "bg-white");
    expect(chip.firstElementChild).toHaveStyle({
      // Studia z modelu (CATEGORY_COLORS) #0070f3
      background: "rgb(0, 112, 243)",
    });
    // Bez font-mono w treści podglądu
    expect(container.querySelector(".font-mono")).toBeNull();
  });

  it("kolory kategorii pochodzą z modelu: kropki i bloki", () => {
    pokaz(draft);
    const kropki = Array.from(
      screen.getByTestId("pv-cats").querySelectorAll("span.rounded-full"),
    ).map((k) => (k as HTMLElement).style.background);
    // Studia #0070f3, Sport #c2410c
    expect(kropki).toEqual(["rgb(0, 112, 243)", "rgb(194, 65, 12)"]);
    const blok = screen.getAllByTestId("pv-block")[1].querySelector(
      "div.rounded-\\[8px\\]",
    ) as HTMLElement;
    expect(blok.getAttribute("style")).toContain("194, 65, 12");
  });

  it("obrys i dymek używają tokenu tła zamiast #fff", () => {
    const { unmount } = pokaz(draft, 1);
    const profil = screen.getByTestId("pv-profile");
    expect(profil.className).toContain("var(--background)");
    expect(profil.className).not.toContain("#fff");
    unmount();
    pokaz(draft, 6);
    const dymek = screen.getByText(/Za 10 min/).closest("div.absolute");
    expect(dymek?.className).toContain("var(--background)");
    expect(dymek?.className).not.toContain("#fff");
  });

  it("cały podgląd jest aria-hidden", () => {
    const { container } = pokaz(draft);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });
});
