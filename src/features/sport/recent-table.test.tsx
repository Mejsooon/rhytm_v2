import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { RecentTable } from "./recent-table";
import { bieg, daneSportu, POMPKI, SESJA_PUSH } from "./sport-test-data";

describe("RecentTable", () => {
  it("wiersze: data, typ, wynik, tempo / objętość, trudność", () => {
    const dane = daneSportu();
    render(
      <RecentTable
        items={dane.recent}
        month="2026-11"
        doneInMonth={5}
        setsHistory={dane.setsHistory}
        exercises={dane.exercises}
        profileWeight={72}
        onOpenRun={vi.fn()}
      />,
    );
    expect(screen.getByText("listopad · 5 wykonanych")).toBeInTheDocument();
    const wiersze = screen.getAllByRole("row").slice(1);
    expect(wiersze).toHaveLength(5);
    expect(wiersze[0]).toHaveTextContent("nd 29.11");
    const dlugi = wiersze[1];
    expect(dlugi).toHaveTextContent("nd 15.11");
    expect(dlugi).toHaveTextContent("BIEG");
    expect(dlugi).toHaveTextContent("Długi bieg");
    expect(dlugi).toHaveTextContent("12,0 km");
    expect(dlugi).toHaveTextContent("5:51/km");
    expect(dlugi).toHaveTextContent("7/10");
    const silownia = wiersze[2];
    expect(silownia).toHaveTextContent("SIŁA");
    expect(silownia).toHaveTextContent("2 ćw.");
    expect(silownia).toHaveTextContent("652,5 kg");
  });

  it("odznaki BIEG (warn) i SIŁA (sec), kolumny liczbowe tabular-nums po prawej", () => {
    const dane = daneSportu();
    render(
      <RecentTable
        items={dane.recent}
        month="2026-11"
        doneInMonth={5}
        setsHistory={dane.setsHistory}
        exercises={dane.exercises}
        profileWeight={72}
        onOpenRun={vi.fn()}
      />,
    );
    const wiersze = screen.getAllByRole("row").slice(1);
    expect(within(wiersze[1]).getByText("BIEG")).toHaveClass("bg-warning-soft");
    expect(within(wiersze[2]).getByText("SIŁA")).toHaveClass("bg-muted");
    const komorki = within(wiersze[1]).getAllByRole("cell");
    for (const k of komorki.slice(2))
      expect(k).toHaveClass("text-right", "tabular-nums");
    expect(komorki[0]).toHaveClass("tabular-nums");
  });

  it("objętość treningu liczy ćwiczenia z masą ciała wagą z profilu", () => {
    const dane = daneSportu();
    render(
      <RecentTable
        items={dane.recent}
        month="2026-11"
        doneInMonth={5}
        setsHistory={dane.setsHistory}
        exercises={dane.exercises.map((e) =>
          e.id === POMPKI ? { ...e, bodyweight: true } : e,
        )}
        profileWeight={72}
        onOpenRun={vi.fn()}
      />,
    );
    // 652,5 + 72 × 10
    expect(screen.getAllByRole("row")[3]).toHaveTextContent("1 372,5 kg");
  });

  it("pokazuje najwyżej 10 wierszy", () => {
    const dane = daneSportu();
    const duzo = Array.from({ length: 14 }, (_, i) =>
      bieg(
        `a2000000-0000-4000-8000-0000000000${10 + i}`,
        "2026-11-0" + ((i % 9) + 1),
        {
          distanceKm: 5,
          durationS: 1800,
        },
      ),
    );
    render(
      <RecentTable
        items={duzo}
        month="2026-11"
        doneInMonth={14}
        setsHistory={dane.setsHistory}
        exercises={dane.exercises}
        profileWeight={72}
        onOpenRun={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("row")).toHaveLength(11);
  });

  it("klik w bieg otwiera okno biegu, w trening siłowy — trening", async () => {
    const dane = daneSportu();
    const onOpenRun = vi.fn();
    render(
      <RecentTable
        items={dane.recent}
        month="2026-11"
        doneInMonth={5}
        setsHistory={dane.setsHistory}
        exercises={dane.exercises}
        profileWeight={72}
        onOpenRun={onOpenRun}
      />,
    );
    const wiersze = screen.getAllByRole("row").slice(1);
    await userEvent.click(within(wiersze[1]).getByText("Długi bieg"));
    expect(onOpenRun).toHaveBeenCalledWith({
      sessionId: "a1000000-0000-4000-8000-000000000015",
    });
    await userEvent.click(within(wiersze[2]).getByText("Push"));
    expect(push).toHaveBeenCalledWith(`/sport/trening/${SESJA_PUSH}`);
  });
});
