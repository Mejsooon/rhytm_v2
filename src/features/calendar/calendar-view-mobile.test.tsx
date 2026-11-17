import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/categories/actions", () => ({ setCategoryHidden: vi.fn(), createCategory: vi.fn() }));
vi.mock("./actions", () => ({ createBlock: vi.fn(), changeOccurrence: vi.fn() }));
vi.mock("@/features/tasks/actions", () => ({
  addTask: vi.fn(),
  toggleTask: vi.fn(),
  deleteTask: vi.fn(),
  unpinTask: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { CalendarView } from "./calendar-view";
import type { CalendarData } from "./load-calendar";

function dane(): CalendarData {
  return {
    blocks: [
      {
        id: "b1",
        user_id: "u1",
        title: "Algebra",
        start_local: "2026-11-18T08:00:00",
        duration_min: 60,
        category_id: "c1",
        note: null,
        recurrence: null,
        remind: false,
        timezone: "Europe/Warsaw",
        created_at: null,
        updated_at: null,
      },
    ],
    exceptions: [],
    tasks: [],
    categories: [
      { id: "c1", name: "Studia", color: "#0070f3", hidden: false, is_system: false, position: 1, user_id: "u1", created_at: null },
    ],
    profile: { timezone: "Europe/Warsaw", weekStart: "mon", clock: "24" },
  };
}

beforeEach(() => vi.clearAllMocks());

describe("CalendarView na telefonie", () => {
  it("bez jawnego widoku telefon pokazuje dzień (oś), web zostaje przy tygodniu", () => {
    render(
      <CalendarView view="tydzien" hasExplicitView={false} date="2026-11-18" today="2026-11-17" nowMinutes={600} data={dane()} />,
    );
    expect(screen.getByTestId("m-os-dnia")).toBeInTheDocument();
    expect(screen.getByTestId("kolumna-2026-11-18")).toBeInTheDocument();
    // Segment w nagłówku telefonu pokazuje „Dzień”
    const segmenty = screen.getAllByRole("radiogroup", { name: "Widok kalendarza" });
    expect(segmenty[0].querySelector('[aria-checked="true"]')).toHaveTextContent("Tydzień");
    expect(segmenty[1].querySelector('[aria-checked="true"]')).toHaveTextContent("Dzień");
  });

  it("z jawnym widokiem tygodnia telefon pokazuje listę tygodnia", () => {
    render(<CalendarView view="tydzien" date="2026-11-18" today="2026-11-17" nowMinutes={600} data={dane()} />);
    expect(screen.queryByTestId("m-os-dnia")).toBeNull();
    expect(screen.getByRole("region", { name: "Środa 18 listopada" })).toBeInTheDocument();
  });

  it("stuknięcie bloku na telefonie otwiera arkusz szczegółów, bez dymku z kotwicą", async () => {
    const { container } = render(
      <CalendarView view="dzien" date="2026-11-18" today="2026-11-17" nowMinutes={600} data={dane()} />,
    );
    // Mobilny blok nie ma data-occurrence-key: to kotwica dymku web, a tych jest jedna
    expect(container.querySelectorAll('[data-occurrence-key="b1:2026-11-18"]')).toHaveLength(1);
    const bloki = screen.getAllByRole("button", { name: /Algebra/ });
    const mobilny = bloki.find((b) => !b.hasAttribute("data-occurrence-key"))!;
    await userEvent.click(mobilny);
    const arkusz = await screen.findByRole("dialog", { name: "Szczegóły bloku" });
    expect(arkusz).toHaveTextContent("Algebra");
  });

  it("stuknięcie pustej osi o 10:00 otwiera okno nowego bloku z 10:00", async () => {
    render(<CalendarView view="dzien" date="2026-11-18" today="2026-11-17" nowMinutes={600} data={dane()} />);
    fireEvent.click(screen.getByRole("button", { name: "Dodaj blok w wolnym miejscu" }), { clientY: 10 * 56 });
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(okno).toHaveTextContent("10:00");
    expect(okno).toHaveTextContent("18.11.2026");
  });

  it("telefon: „Nowy blok” to arkusz MBlockSheet (nagłówek z Zapisz), nie okno web", async () => {
    render(<CalendarView view="dzien" date="2026-11-18" today="2026-11-17" nowMinutes={600} data={dane()} />);
    fireEvent.click(screen.getByRole("button", { name: "Dodaj blok w wolnym miejscu" }), { clientY: 10 * 56 });
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(within(okno).getByRole("button", { name: "Zapisz blok" })).toBeInTheDocument();
    expect(within(okno).getByText("Czas trwania: 1 h")).toBeInTheDocument();
  });

  it("telefon: „Edytuj” w szczegółach bloku otwiera arkusz edycji", async () => {
    render(<CalendarView view="dzien" date="2026-11-18" today="2026-11-17" nowMinutes={600} data={dane()} />);
    const mobilny = screen.getAllByRole("button", { name: /Algebra/ }).find((b) => !b.hasAttribute("data-occurrence-key"))!;
    await userEvent.click(mobilny);
    await userEvent.click(await screen.findByRole("button", { name: "Edytuj" }));
    const okno = await screen.findByRole("dialog", { name: "Edytuj blok" });
    expect(within(okno).getByRole("textbox", { name: "Nazwa bloku" })).toHaveValue("Algebra");
  });
});
