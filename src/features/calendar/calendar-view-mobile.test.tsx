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
import type { CalendarData, RenewalsData } from "./load-calendar";

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
        panelOpen={false}
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
    // Segment web zostaje przy „Tydzień”, a nagłówek telefonu (linki) wskazuje „Dzień”
    const segmentWeb = screen.getByRole("radiogroup", {
      name: "Widok kalendarza",
    });
    expect(segmentWeb.querySelector('[aria-checked="true"]')).toHaveTextContent(
      "Tydzień",
    );
    const nawigacja = screen.getByRole("navigation", {
      name: "Widok kalendarza",
    });
    expect(
      within(nawigacja).getByRole("link", { name: "Dzień" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("z jawnym widokiem tygodnia telefon pokazuje listę tygodnia", () => {
    render(
      <CalendarView
        panelOpen={false}
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
        panelOpen={false}
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
    const mobilny = bloki.find((b) => !b.hasAttribute("data-occurrence-key") && !b.closest("aside"))!;
    await userEvent.click(mobilny);
    const arkusz = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    expect(arkusz).toHaveTextContent("Algebra");
  });

  it("stuknięcie pustej osi o 10:00 otwiera „Nowy wpis” z 10:00; „Blok” prowadzi do arkusza nowego bloku", async () => {
    render(
      <CalendarView
        panelOpen={false}
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dodaj wpis w wolnym miejscu" }),
      { clientY: 10 * 56 },
    );
    const wpis = await screen.findByRole("dialog", { name: "Nowy wpis" });
    expect(wpis).toHaveTextContent("śr 18.11 · 10:00");
    await userEvent.click(within(wpis).getByRole("button", { name: /^Blok/ }));
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(screen.queryByRole("dialog", { name: "Nowy wpis" })).toBeNull();
    // Telefon: arkusz MBlockSheet (nagłówek z Zapisz), nie okno web
    expect(
      within(okno).getByRole("button", { name: "Zapisz blok" }),
    ).toBeInTheDocument();
    expect(within(okno).getByText("Czas trwania: 1 h")).toBeInTheDocument();
    expect(okno).toHaveTextContent("10:00");
    expect(okno).toHaveTextContent("18.11.2026");
  });

  it("„Nowy wpis” na telefonie: Bieg i Trening siłowy to linki do Sportu z datą i godziną", async () => {
    render(
      <CalendarView
        panelOpen={false}
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Dodaj wpis w wolnym miejscu" }),
      { clientY: 10 * 56 },
    );
    const wpis = await screen.findByRole("dialog", { name: "Nowy wpis" });
    expect(within(wpis).getByRole("link", { name: /^Bieg/ })).toHaveAttribute(
      "href",
      "/sport?nowy=bieg&data=2026-11-18&godzina=10:00",
    );
    expect(
      within(wpis).getByRole("link", { name: /^Trening siłowy/ }),
    ).toHaveAttribute(
      "href",
      "/sport?nowy=silownia&data=2026-11-18&godzina=10:00",
    );
    await userEvent.click(within(wpis).getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("pływający „Dodaj blok” otwiera „Nowy wpis” na dziś i najbliższą pełną godzinę", async () => {
    render(
      <CalendarView
        panelOpen={false}
        view="dzien"
        date="2026-11-18"
        today="2026-11-18"
        nowMinutes={600}
        data={dane()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Nowy wpis" }));
    expect(
      await screen.findByRole("dialog", { name: "Nowy wpis" }),
    ).toHaveTextContent("śr 18.11 · 11:00");
  });

  it("tydzień: „Nowy wpis” (+) w nagłówku telefonu otwiera „Nowy wpis”", async () => {
    render(
      <CalendarView
        panelOpen={false}
        view="tydzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    // „+” w nagłówku tygodnia na telefonie i pływający przycisk widoku mają nazwę „Nowy wpis”
    const przyciski = screen.getAllByRole("button", { name: "Nowy wpis" });
    await userEvent.click(przyciski[0]);
    expect(
      await screen.findByRole("dialog", { name: "Nowy wpis" }),
    ).toHaveTextContent("wt 17.11 · 11:00");
  });

  it("szczegóły bloku na telefonie mają jeden ✕; stuknięcie bloku w tygodniu i miesiącu też je otwiera", async () => {
    const { unmount } = render(
      <CalendarView
        panelOpen={false}
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    const mobilny = screen
      .getAllByRole("button", { name: /Algebra/ })
      .find((b) => !b.hasAttribute("data-occurrence-key") && !b.closest("aside"))!;
    await userEvent.click(mobilny);
    const arkusz = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    expect(
      within(arkusz).getAllByRole("button", { name: "Zamknij" }),
    ).toHaveLength(1);
    expect(arkusz).toHaveTextContent("Studia");
    unmount();

    render(
      <CalendarView
        panelOpen={false}
        view="tydzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    const wTygodniu = screen
      .getAllByRole("button", { name: /Algebra/ })
      .find((b) => !b.hasAttribute("data-occurrence-key") && !b.closest("aside"))!;
    await userEvent.click(wTygodniu);
    expect(
      await screen.findByRole("dialog", { name: "Szczegóły bloku" }),
    ).toHaveTextContent("Algebra");
  });

  it("„Usuń” w szczegółach jednorazowego bloku pyta „Usunąć blok?”, cyklicznego o zakres", async () => {
    const cykliczne = dane();
    cykliczne.blocks[0].recurrence = { freq: "weekly" };
    const { unmount } = render(
      <CalendarView
        panelOpen={false}
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    await userEvent.click(
      screen
        .getAllByRole("button", { name: /Algebra/ })
        .find((b) => !b.hasAttribute("data-occurrence-key"))!,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Usuń" }));
    expect(
      await screen.findByRole("alertdialog", { name: "Usunąć blok?" }),
    ).toBeInTheDocument();
    unmount();

    render(
      <CalendarView
        panelOpen={false}
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={cykliczne}
      />,
    );
    await userEvent.click(
      screen
        .getAllByRole("button", { name: /Algebra/ })
        .find((b) => !b.hasAttribute("data-occurrence-key"))!,
    );
    await userEvent.click(await screen.findByRole("button", { name: "Usuń" }));
    expect(
      await screen.findByRole("dialog", {
        name: "Usuwasz blok, który się powtarza",
      }),
    ).toBeInTheDocument();
  });

  it("ikona „Kategorie” otwiera arkusz; przełącznik ukrywa kategorię tą samą akcją co web", async () => {
    setCategoryHidden.mockResolvedValue({ ok: true });
    render(
      <CalendarView
        panelOpen={false}
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

  it("„Kategoria” w arkuszu otwiera okno nowej kategorii", async () => {
    render(
      <CalendarView
        panelOpen={false}
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Kategorie" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Kategoria" }),
    );
    const arkusz = await screen.findByRole("dialog", {
      name: "Nowa kategoria",
    });
    // Telefon: arkusz MCategorySheet (nagłówek z „Dodaj”, siatka kolorów), nie okno web
    expect(
      within(arkusz).getAllByRole("button", { name: "Dodaj" })[0],
    ).toBeDisabled();
    expect(
      within(arkusz).getByRole("radio", { name: "Niebieski" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("nagłówek telefonu bez „+”; dzień wypełnia ekran nad dolnym paskiem", () => {
    const { container } = render(
      <CalendarView
        panelOpen={false}
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
      screen.getByRole("button", { name: "Nowy wpis" }),
    ).toBeInTheDocument();
    expect((container.firstElementChild as HTMLElement).className).toContain(
      "max-[799px]:h-[calc(100dvh-var(--tabbar-h))]",
    );
  });

  it("miesiąc na telefonie: „Brak bloków — dodaj” w pustym dniu otwiera „Nowy wpis” na ten dzień", async () => {
    render(
      <CalendarView
        panelOpen={false}
        view="miesiac"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "20 listopada" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Brak bloków — dodaj" }),
    );
    // Makieta CMCalendarMonth: „dodaj” prowadzi do „Nowy wpis”, a wiersz „Blok” do arkusza bloku
    const wpis = await screen.findByRole("dialog", { name: "Nowy wpis" });
    await userEvent.click(within(wpis).getByRole("button", { name: /^Blok/ }));
    const arkusz = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(
      within(arkusz).getByRole("button", { name: "Dzień" }),
    ).toHaveTextContent("20.11");
  });

  it("telefon: „Edytuj” w szczegółach bloku otwiera arkusz edycji", async () => {
    render(
      <CalendarView
        panelOpen={false}
        view="dzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    const mobilny = screen
      .getAllByRole("button", { name: /Algebra/ })
      .find((b) => !b.hasAttribute("data-occurrence-key") && !b.closest("aside"))!;
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
          panelOpen={false}
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
        within(arkusz).getAllByRole("button", { name: "Anuluj" })[0],
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

  // Odnowienia subskrypcji na telefonie (T13): te same dane co web, widoczność według `shown` źródła
  describe("odnowienia", () => {
    function odnowienia(shown = true): RenewalsData {
      return {
        items: [
          {
            key: "f-ren:r1:2026-11-21",
            fieldId: "f-ren",
            pageId: "p1",
            pageTitle: "Subscriptions",
            rowId: "r1",
            date: "2026-11-21",
            next: "2026-12-21",
            title: "Netflix",
            amount: 43,
            cycle: "month",
            categoryName: "Kategoria",
            categoryLabel: "Rozrywka",
          },
        ],
        sources: [
          {
            fieldId: "f-ren",
            pageId: "p1",
            config: { show_in_calendar: shown },
            name: "Subscriptions",
            shown,
          },
        ],
      };
    }

    function widok(view: "dzien" | "tydzien" | "miesiac", shown = true) {
      return render(
        <CalendarView
          panelOpen={false}
          view={view}
          date="2026-11-21"
          today="2026-11-17"
          nowMinutes={600}
          data={dane()}
          renewals={odnowienia(shown)}
        />,
      );
    }

    it("dzień: plakietka w pasku nad osią, stuknięcie otwiera arkusz z danymi i linkiem do strony", async () => {
      widok("dzien");
      const plakietka = within(screen.getByTestId("m-pasek-dnia")).getByRole("button", {
        name: "↻ Netflix · 43,00 zł",
      });
      await userEvent.click(plakietka);
      const arkusz = await screen.findByRole("dialog", { name: "Odnowienie Netflix" });
      expect(arkusz).toHaveTextContent("sob 21.11.2026");
      expect(arkusz).toHaveTextContent("pon 21.12.2026 · za 34 dni");
      expect(within(arkusz).getByRole("link", { name: "Otwórz w Subscriptions" })).toHaveAttribute(
        "href",
        "/strony/p1",
      );
      await userEvent.click(within(arkusz).getByRole("button", { name: "Zamknij" }));
      expect(screen.queryByRole("dialog", { name: "Odnowienie Netflix" })).toBeNull();
    });

    it("tydzień: odnowienie na liście dnia otwiera ten sam arkusz", async () => {
      widok("tydzien");
      const dzien = screen.getByRole("region", { name: "Sobota 21 listopada" });
      await userEvent.click(within(dzien).getByRole("button", { name: /↻ Netflix/ }));
      expect(await screen.findByRole("dialog", { name: "Odnowienie Netflix" })).toBeInTheDocument();
    });

    it("miesiąc: kropka w komórce i wpis „↻ Netflix · 43,00 zł” na liście wybranego dnia otwierają arkusz", async () => {
      widok("miesiac");
      const komorka = screen.getByRole("button", { name: "21 listopada" });
      expect(within(komorka).getByTestId("kropka-odnowienia")).toBeInTheDocument();
      await userEvent.click(komorka);
      await userEvent.click(screen.getByRole("button", { name: /↻ Netflix · 43,00 zł/ }));
      expect(await screen.findByRole("dialog", { name: "Odnowienie Netflix" })).toBeInTheDocument();
    });

    it("ukryte źródło nie pokazuje odnowień w dniu, tygodniu ani miesiącu", () => {
      const { unmount } = widok("dzien", false);
      expect(screen.queryByRole("button", { name: /↻ Netflix/ })).toBeNull();
      unmount();
      const tydzien = widok("tydzien", false);
      expect(screen.queryByRole("button", { name: /↻ Netflix/ })).toBeNull();
      tydzien.unmount();
      widok("miesiac", false);
      expect(screen.queryByTestId("kropka-odnowienia")).toBeNull();
    });
  });
});
