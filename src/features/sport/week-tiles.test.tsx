import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { bieg, daneSportu } from "./sport-test-data";
import { WeekTiles } from "./week-tiles";

// Bieżący tydzień (16–22.11): jeden wykonany bieg 5 km w 30:00
function wyrenderuj(
  profil: Partial<ReturnType<typeof daneSportu>["profile"]> = {},
) {
  const dane = daneSportu();
  const items = [
    ...dane.items,
    bieg("a1000000-0000-4000-8000-000000000016", "2026-11-16", {
      distanceKm: 5,
      durationS: 1800,
      kcal: 400,
    }),
  ];
  render(
    <WeekTiles
      items={items}
      today={dane.today}
      profile={{ ...dane.profile, ...profil }}
    />,
  );
}

const kafelek = (nazwa: RegExp) => screen.getByRole("button", { name: nazwa });

describe("WeekTiles", () => {
  it("kafelki bieżącego tygodnia z celami", () => {
    wyrenderuj();
    expect(kafelek(/Km \/ tydz\./)).toHaveTextContent("5,0 / 25");
    expect(kafelek(/Śr\. tempo/)).toHaveTextContent("6:00 /km");
    expect(kafelek(/Treningi/)).toHaveTextContent("1 / 3 plan");
    expect(kafelek(/Kcal/)).toHaveTextContent("400");
  });

  it("kafelek „Treningi” bez celu nie ma „/ N plan”, km bez celu nie ma „/ N”", () => {
    wyrenderuj({ workoutsGoalOn: false, kmGoalOn: false });
    expect(kafelek(/Treningi/)).not.toHaveTextContent("plan");
    expect(kafelek(/Km \/ tydz\./).textContent).not.toContain("/ 25");
  });

  it("wykres km ma linię celu tylko przy kmGoalOn", () => {
    wyrenderuj();
    expect(screen.getByText("Kilometry tygodniowo")).toBeInTheDocument();
    expect(screen.getByText("cel 25 km")).toBeInTheDocument();
    expect(screen.getByTestId("linia-celu")).toBeInTheDocument();
  });

  it("bez celu km wykres nie ma linii", () => {
    wyrenderuj({ kmGoalOn: false });
    expect(screen.queryByTestId("linia-celu")).not.toBeInTheDocument();
    expect(screen.queryByText("cel 25 km")).not.toBeInTheDocument();
  });

  it("klik w kafelek przełącza wykres; tempo i kcal bez linii celu", async () => {
    wyrenderuj();
    await userEvent.click(kafelek(/Treningi/));
    expect(kafelek(/Treningi/)).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Treningi tygodniowo")).toBeInTheDocument();
    expect(screen.getByText("plan 3")).toBeInTheDocument();
    await userEvent.click(kafelek(/Śr\. tempo/));
    expect(screen.getByText("Średnie tempo biegów")).toBeInTheDocument();
    expect(screen.queryByTestId("linia-celu")).not.toBeInTheDocument();
    await userEvent.click(kafelek(/Kcal/));
    expect(screen.getByText("Spalone kcal tygodniowo")).toBeInTheDocument();
    expect(screen.queryByTestId("linia-celu")).not.toBeInTheDocument();
  });

  it("12 słupków, ostatni (bieżący tydzień) zielony, trafiony cel ciemny", () => {
    wyrenderuj({ weeklyKmGoal: 18 });
    const slupki = screen.getAllByTestId("slupek");
    expect(slupki).toHaveLength(12);
    expect(slupki[11]).toHaveClass("bg-success");
    // Tydzień 9–15.11 (indeks 10): 18,4 km ≥ cel 18
    expect(slupki[10]).toHaveClass("bg-foreground");
    expect(slupki[10]).toHaveAttribute("title", "tydz. 46: 18,4");
    expect(slupki[9]).toHaveClass("bg-black/12");
    expect(slupki[9]).toHaveClass("rounded-t-[4px]");
  });

  it("wybrany kafelek ma aria-pressed i dolną kreskę", async () => {
    wyrenderuj();
    expect(kafelek(/Km \/ tydz\./)).toHaveAttribute("aria-pressed", "true");
    expect(kafelek(/Km \/ tydz\./)).toHaveClass(
      "bg-white",
      "shadow-[inset_0_-2px_0_var(--foreground)]",
    );
    expect(kafelek(/Treningi/)).toHaveAttribute("aria-pressed", "false");
    expect(kafelek(/Treningi/)).toHaveClass("bg-black/[.025]");
    expect(kafelek(/Treningi/)).not.toHaveClass(
      "shadow-[inset_0_-2px_0_var(--foreground)]",
    );
    await userEvent.click(kafelek(/Treningi/));
    expect(kafelek(/Treningi/)).toHaveClass(
      "shadow-[inset_0_-2px_0_var(--foreground)]",
    );
    expect(kafelek(/Km \/ tydz\./)).not.toHaveClass(
      "shadow-[inset_0_-2px_0_var(--foreground)]",
    );
  });

  it("wykres bez danych nie ma NaN w wysokościach", async () => {
    const dane = daneSportu();
    render(<WeekTiles items={[]} today={dane.today} profile={dane.profile} />);
    for (const nazwa of [/Km \/ tydz\./, /Śr\. tempo/, /Treningi/, /Kcal/]) {
      await userEvent.click(kafelek(nazwa));
      for (const slupek of screen.getAllByTestId("slupek")) {
        expect(slupek.style.height).not.toContain("NaN");
        expect(slupek.style.height).toBe("2px");
      }
    }
  });
});
