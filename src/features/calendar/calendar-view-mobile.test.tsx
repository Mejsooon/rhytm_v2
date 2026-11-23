import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setCategoryHidden, replace } = vi.hoisted(() => ({
  setCategoryHidden: vi.fn(),
  replace: vi.fn(),
}));
vi.mock("@/features/categories/actions", () => ({
  setCategoryHidden,
  createCategory: vi.fn(),
}));
vi.mock("./actions", () => ({
  createBlock: vi.fn(),
  changeOccurrence: vi.fn(),
}));
vi.mock("@/features/tasks/actions", () => ({
  addTask: vi.fn(),
  toggleTask: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace }),
}));

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
      {
        id: "c1",
        name: "Studia",
        color: "#0070f3",
        hidden: false,
        is_system: false,
        position: 1,
        user_id: "u1",
        created_at: null,
      },
    ],
    profile: { timezone: "Europe/Warsaw", weekStart: "mon", clock: "24" },
    sport: [],
  };
}

beforeEach(() => vi.clearAllMocks());

describe("CalendarView na telefonie", () => {
  it("bez jawnego widoku telefon pokazuje dzień (oś), web zostaje przy tygodniu", () => {
    render(
      <CalendarView
        view="tydzien"
        hasExplicitView={false}
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    expect(screen.getByTestId("m-os-dnia")).toBeInTheDocument();
    expect(screen.getByTestId("kolumna-2026-11-18")).toBeInTheDocument();
    // Segment w nagłówku telefonu pokazuje „Dzień”
    const segmenty = screen.getAllByRole("radiogroup", {
      name: "Widok kalendarza",
    });
    expect(
      segmenty[0].querySelector('[aria-checked="true"]'),
    ).toHaveTextContent("Tydzień");
    expect(
      segmenty[1].querySelector('[aria-checked="true"]'),
    ).toHaveTextContent("Dzień");
  });

  it("z jawnym widokiem tygodnia telefon pokazuje listę tygodnia", () => {
    render(
      <CalendarView
        view="tydzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    expect(screen.queryByTestId("m-os-dnia")).toBeNull();
    expect(
      screen.getByRole("region", { name: "Środa 18 listopada" }),
    ).toBeInTheDocument();
  });

  it("stuknięcie bloku na telefonie otwiera arkusz szczegółów, bez dymku z kotwicą", async () => {
    const { container } = render(
      <CalendarView
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    // Mobilny blok nie ma data-occurrence-key: to kotwica dymku web, a tych jest jedna
    expect(
      container.querySelectorAll('[data-occurrence-key="b1:2026-11-18"]'),
    ).toHaveLength(1);
    const bloki = screen.getAllByRole("button", { name: /Algebra/ });
    const mobilny = bloki.find((b) => !b.hasAttribute("data-occurrence-key"))!;
    await userEvent.click(mobilny);
    const arkusz = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    expect(arkusz).toHaveTextContent("Algebra");
  });

  it("stuknięcie pustej osi o 10:00 otwiera okno nowego bloku z 10:00", async () => {
    render(
      <CalendarView
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dodaj blok w wolnym miejscu" }),
      { clientY: 10 * 56 },
    );
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(okno).toHaveTextContent("10:00");
    expect(okno).toHaveTextContent("18.11.2026");
  });

  it("telefon: „Nowy blok” to arkusz MBlockSheet (nagłówek z Zapisz), nie okno web", async () => {
    render(
      <CalendarView
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dodaj blok w wolnym miejscu" }),
      { clientY: 10 * 56 },
    );
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(
      within(okno).getByRole("button", { name: "Zapisz blok" }),
    ).toBeInTheDocument();
    expect(within(okno).getByText("Czas trwania: 1 h")).toBeInTheDocument();
  });

  it("ikona „Kategorie” otwiera arkusz; przełącznik ukrywa kategorię tą samą akcją co web", async () => {
    setCategoryHidden.mockResolvedValue({ ok: true });
    render(
      <CalendarView
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    const arkusz = await screen.findByRole("dialog", { name: "Kategorie" });
    await userEvent.click(
      within(arkusz).getByRole("switch", { name: "Pokaż kategorię Studia" }),
    );
    expect(setCategoryHidden).toHaveBeenCalledWith({ id: "c1", hidden: true });
    expect(
      within(arkusz).getByRole("switch", { name: "Pokaż kategorię Studia" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("„+ Kategoria” w arkuszu otwiera okno nowej kategorii", async () => {
    render(
      <CalendarView
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "+ Kategoria" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Nowa kategoria" }),
    ).toBeInTheDocument();
  });

  it("nagłówek telefonu bez „+”; dzień wypełnia ekran nad dolnym paskiem", () => {
    const { container } = render(
      <CalendarView
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    // Jedyny przycisk nowego bloku to „Nowy blok” na webie; telefon ma pływający „Dodaj blok”
    expect(screen.getAllByRole("button", { name: "Nowy blok" })).toHaveLength(
      1,
    );
    expect(
      screen.getByRole("button", { name: "Dodaj blok" }),
    ).toBeInTheDocument();
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "max-[799px]:h-[calc(100dvh-var(--tabbar-h))]",
    );
  });

  it("telefon: „Edytuj” w szczegółach bloku otwiera arkusz edycji", async () => {
    render(
      <CalendarView
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    const mobilny = screen
      .getAllByRole("button", { name: /Algebra/ })
      .find((b) => !b.hasAttribute("data-occurrence-key"))!;
    await userEvent.click(mobilny);
    await userEvent.click(
      await screen.findByRole("button", { name: "Edytuj" }),
    );
    const okno = await screen.findByRole("dialog", { name: "Edytuj blok" });
    expect(
      within(okno).getByRole("textbox", { name: "Nazwa bloku" }),
    ).toHaveValue("Algebra");
  });

  it("?nowy=blok na telefonie otwiera arkusz bloku z danymi z adresu; Anuluj czyści adres", async () => {
    // Udajemy szerokość telefonu dla matchMedia (jsdom jej nie ma)
    window.matchMedia = vi.fn().mockReturnValue({
      matches: true,
    }) as unknown as typeof window.matchMedia;
    window.history.replaceState(
      null,
      "",
      "/kalendarz?nowy=blok&data=2026-11-18&godzina=09:00&tytul=Nauka",
    );
    try {
      render(
        <CalendarView
          view="tydzien"
          hasExplicitView={false}
          date="2026-11-18"
          today="2026-11-17"
          nowMinutes={600}
          data={dane()}
          newBlock={{ date: "2026-11-18", startMin: 9 * 60, title: "Nauka" }}
        />,
      );
      const arkusz = await screen.findByRole("dialog", { name: "Nowy blok" });
      expect(within(arkusz).getByLabelText("Nazwa bloku")).toHaveValue("Nauka");
      expect(
        within(arkusz).getByRole("button", { name: "Dzień" }),
      ).toHaveTextContent("18.11");
      expect(within(arkusz).getByText("09:00")).toBeInTheDocument();
      await userEvent.click(
        within(arkusz).getByRole("button", { name: "Anuluj" }),
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(replace).toHaveBeenCalledWith("/kalendarz?data=2026-11-18", {
        scroll: false,
      });
    } finally {
      delete (window as { matchMedia?: unknown }).matchMedia;
      window.history.replaceState(null, "", "/");
    }
  });
});
