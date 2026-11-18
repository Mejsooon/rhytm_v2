import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SportMonthData } from "../load-sport";
import type { SportItem } from "../model";
import { bieg, daneSportu, SZABLON_PUSH } from "../sport-test-data";
import { MSport } from "./m-sport";

const SILOWNIA = "a1000000-0000-4000-8000-000000000116";
const BIEG_PN = "a1000000-0000-4000-8000-000000000216";
const BIEG_WT = "a1000000-0000-4000-8000-000000000217";

// Dziś = wt 17.11.2026, tydzień od poniedziałku 16.11 (ISO 47).
// Tydzień: bieg 5 km / 25:00 (pn), bieg 3 km / 18:00 (wt), siłownia (pn), plan biegu 10 km (śr).
// Wcześniej: 6,4 km (wt 10.11, t. 46) i 4 km (wt 27.10, t. 44).
function dane(zmiany: Partial<SportMonthData> = {}): SportMonthData {
  const silownia: SportItem = {
    ...bieg(SILOWNIA, "2026-11-16"),
    kind: "gym",
    title: "Push",
    runKind: null,
    durationMin: 58,
  };
  const items: SportItem[] = [
    bieg("a1000000-0000-4000-8000-000000000027", "2026-10-27", {
      distanceKm: 4,
      durationS: 1440,
    }),
    bieg("a1000000-0000-4000-8000-000000000110", "2026-11-10", {
      title: "Interwały",
      runKind: "intervals",
      distanceKm: 6.4,
      durationS: 2035,
    }),
    silownia,
    bieg(BIEG_PN, "2026-11-16", { distanceKm: 5, durationS: 1500 }),
    bieg(BIEG_WT, "2026-11-17", { distanceKm: 3, durationS: 1080 }),
    bieg("a1000000-0000-4000-8000-000000000218", "2026-11-18", {
      planned: true,
      distanceKm: 10,
    }),
  ];
  const d = daneSportu({ items });
  return {
    ...d,
    recent: items
      .filter((i) => !i.planned)
      .sort((a, b) => (a.date > b.date ? -1 : 1)),
    setsHistory: [
      ...d.setsHistory,
      {
        sessionId: SILOWNIA,
        startLocal: "2026-11-16T07:00:00",
        title: "Push",
        completed: true,
        sets: [
          ...d.setsHistory[1].sets.map((s) => ({
            ...s,
            id: `x${s.id}`,
            session_id: SILOWNIA,
          })),
        ],
      },
    ],
    ...zmiany,
  };
}

const onNewRun = vi.fn();
const onNewGym = vi.fn();
const onOpenRun = vi.fn();
const onStartGym = vi.fn();
const onSelected = vi.fn();

function pokaz(d: SportMonthData = dane(), selectedKey: string | null = null) {
  return render(
    <MSport
      data={d}
      selectedKey={selectedKey}
      onNewRun={onNewRun}
      onNewGym={onNewGym}
      onOpenRun={onOpenRun}
      onStartGym={onStartGym}
      onSelected={onSelected}
    />,
  );
}

// Udajemy szerokość ekranu dla matchMedia (jsdom jej nie ma)
function ustawTelefon(tel: boolean) {
  window.matchMedia = vi
    .fn()
    .mockReturnValue({ matches: tel }) as unknown as typeof window.matchMedia;
}

const karta = () => screen.getByRole("region", { name: "Bieganie" });
const wykres = () => screen.getByRole("region", { name: "Kilometry" });

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("MSport", () => {
  it("nagłówek z numerem i zakresem tygodnia, „+” otwiera nowy bieg", async () => {
    pokaz();
    expect(screen.getByText("Tydzień 47 · 16–22.11")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sport" })).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Nowa aktywność" }),
    );
    expect(onNewRun).toHaveBeenCalledTimes(1);
  });

  it("tydzień przechodzący przez miesiąc ma obie daty", () => {
    pokaz(dane({ today: "2026-12-02" }));
    expect(screen.getByText("Tydzień 49 · 30.11–6.12")).toBeInTheDocument();
  });

  it("karta „Bieganie” w tygodniu: km / cel z paskiem, biegi, tempo, siłownia", () => {
    pokaz();
    expect(within(karta()).getByTestId("km")).toHaveTextContent("8,0");
    expect(within(karta()).getByText("/ 25 km")).toBeInTheDocument();
    // 8 / 25 = 32%
    expect(within(karta()).getByTestId("pasek-km")).toHaveStyle({
      width: "32%",
    });
    expect(within(karta()).getByTestId("biegi")).toHaveTextContent("2");
    // (1500 + 1080) / 8 = 322,5 s → 5:23
    expect(within(karta()).getByTestId("tempo")).toHaveTextContent("5:23");
    expect(within(karta()).getByTestId("silownia")).toHaveTextContent("1×");
  });

  it("bez celu km sama liczba: bez „/ cel” i bez paska", () => {
    const d = dane();
    pokaz({ ...d, profile: { ...d.profile, kmGoalOn: false } });
    expect(within(karta()).getByTestId("km")).toHaveTextContent("8,0");
    expect(within(karta()).getByText("km")).toBeInTheDocument();
    expect(within(karta()).queryByText(/\/ 25/)).not.toBeInTheDocument();
    expect(within(karta()).queryByTestId("pasek-km")).not.toBeInTheDocument();
  });

  it("bez biegów tempo to „—”", () => {
    pokaz(dane({ items: [] }));
    expect(within(karta()).getByTestId("km")).toHaveTextContent("0,0");
    expect(within(karta()).getByTestId("tempo")).toHaveTextContent("—");
    expect(within(karta()).getByTestId("biegi")).toHaveTextContent("0");
  });

  it("wykres tygodnia: słupek na dzień, stuknięcie pokazuje wartość", async () => {
    pokaz();
    const slupki = within(wykres()).getAllByRole("button");
    expect(slupki.map((s) => s.getAttribute("aria-label"))).toEqual([
      "pn: 5,0 km",
      "wt: 3,0 km",
      "śr: 0,0 km",
      "cz: 0,0 km",
      "pt: 0,0 km",
      "sb: 0,0 km",
      "nd: 0,0 km",
    ]);
    expect(within(wykres()).getByText("stuknij słupek")).toBeInTheDocument();
    await userEvent.click(
      within(wykres()).getByRole("button", { name: "wt: 3,0 km" }),
    );
    expect(within(wykres()).getByText("wt · 3,0 km")).toBeInTheDocument();
    expect(
      within(wykres()).getByRole("button", { name: "wt: 3,0 km" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("tydzień od niedzieli: oś zaczyna się od nd", () => {
    const d = dane();
    pokaz({ ...d, profile: { ...d.profile, weekStart: "sun" } });
    expect(screen.getByText("Tydzień 47 · 15–21.11")).toBeInTheDocument();
    const slupki = within(wykres()).getAllByRole("button");
    expect(slupki[0]).toHaveAttribute("aria-label", "nd: 0,0 km");
    expect(slupki[1]).toHaveAttribute("aria-label", "pn: 5,0 km");
  });

  it("Miesiąc: 4 ostatnie tygodnie, cel × 4, słupek na tydzień", async () => {
    pokaz();
    await userEvent.click(screen.getByRole("radio", { name: "Miesiąc" }));
    // 4 + 6,4 + 5 + 3 = 18,4 km
    expect(within(karta()).getByTestId("km")).toHaveTextContent("18,4");
    expect(within(karta()).getByText("/ 100 km")).toBeInTheDocument();
    expect(within(karta()).getByTestId("biegi")).toHaveTextContent("4");
    const slupki = within(wykres()).getAllByRole("button");
    expect(slupki.map((s) => s.getAttribute("aria-label"))).toEqual([
      "t. 44: 4,0 km",
      "t. 45: 0,0 km",
      "t. 46: 6,4 km",
      "t. 47: 8,0 km",
    ]);
    await userEvent.click(slupki[2]);
    expect(within(wykres()).getByText("t. 46 · 6,4 km")).toBeInTheDocument();
    // Zmiana zakresu czyści wybrany słupek
    await userEvent.click(screen.getByRole("radio", { name: "Tydzień" }));
    expect(within(wykres()).getByText("stuknij słupek")).toBeInTheDocument();
  });

  it("„Bieg” otwiera nowy bieg", async () => {
    pokaz();
    await userEvent.click(screen.getByRole("button", { name: "Bieg" }));
    expect(onNewRun).toHaveBeenCalledTimes(1);
  });

  it("„Trening” otwiera opcje jak na webie: pusty, z szablonu, szablony", async () => {
    pokaz();
    await userEvent.click(screen.getByRole("button", { name: "Trening" }));
    const menu = screen.getByRole("dialog", { name: "Nowy trening" });
    expect(within(menu).getByText("Z szablonu")).toBeInTheDocument();
    const szablony = within(menu).getByRole("link", {
      name: "Szablony treningów…",
    });
    expect(szablony).toHaveAttribute("href", "/sport/szablony");
    // Wiersze ≥ 44 px
    for (const el of [
      within(menu).getByRole("button", { name: "Pusty trening" }),
      within(menu).getByRole("button", { name: "Push" }),
      szablony,
    ])
      expect(el.className).toContain("min-h-11");

    await userEvent.click(
      within(menu).getByRole("button", { name: "Pusty trening" }),
    );
    expect(onNewGym).toHaveBeenCalledWith(null);
    expect(
      screen.queryByRole("dialog", { name: "Nowy trening" }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Trening" }));
    await userEvent.click(screen.getByRole("button", { name: "Push" }));
    expect(onNewGym).toHaveBeenLastCalledWith(SZABLON_PUSH);
  });

  it("bez szablonów: bez sekcji „Z szablonu”", async () => {
    pokaz(dane({ templates: [] }));
    await userEvent.click(screen.getByRole("button", { name: "Trening" }));
    const menu = screen.getByRole("dialog", { name: "Nowy trening" });
    expect(within(menu).queryByText("Z szablonu")).not.toBeInTheDocument();
    expect(
      within(menu).getByRole("button", { name: "Pusty trening" }),
    ).toBeInTheDocument();
  });

  it("słupki: odstęp jest w przyciskach (pole stuknięcia ≥ 44 px)", async () => {
    pokaz();
    const slupek = within(wykres()).getByRole("button", { name: "pn: 5,0 km" });
    expect(slupek.className).toContain("px-[5px]");
    expect(slupek.parentElement?.className).not.toMatch(/\bgap-/);
    await userEvent.click(screen.getByRole("radio", { name: "Miesiąc" }));
    expect(
      within(wykres()).getByRole("button", { name: "t. 47: 8,0 km" }).className,
    ).toContain("px-3");
  });

  it("„Ostatnie”: bieg otwiera okno biegu, trening siłowy — ekran treningu", async () => {
    pokaz();
    const lista = screen.getByRole("region", { name: "Ostatnie" });
    const bieg = within(lista).getByRole("button", {
      name: /Spokojny · 3,0 km/,
    });
    expect(bieg).toHaveTextContent("wt 17.11 · 18:00 · 6:00/km");
    await userEvent.click(bieg);
    expect(onOpenRun).toHaveBeenCalledWith({ sessionId: BIEG_WT });

    const silownia = within(lista).getByRole("link", {
      name: /Siłownia — Push/,
    });
    expect(silownia).toHaveAttribute("href", `/sport/trening/${SILOWNIA}`);
    expect(silownia).toHaveTextContent("pon 16.11 · 2 ćwiczenia · 58 min");
  });

  it("„Ostatnie” bez treningów", () => {
    pokaz(dane({ recent: [] }));
    expect(screen.getByText("Brak wykonanych treningów.")).toBeInTheDocument();
  });

  it("„Zaplanowane”: plany z bieżącego tygodnia — bieg, niedokończony trening i wystąpienie szablonu", async () => {
    const NIEDOKONCZONY = "a1000000-0000-4000-8000-000000000316";
    const d = dane();
    d.items = [
      ...d.items,
      {
        ...bieg(NIEDOKONCZONY, "2026-11-16"),
        kind: "gym",
        title: "Nogi",
        runKind: null,
        planned: true,
        startMin: 18 * 60,
      },
      {
        ...bieg("x", "2026-11-19"),
        key: `t:${SZABLON_PUSH}:2026-11-19`,
        sessionId: null,
        templateId: SZABLON_PUSH,
        kind: "gym",
        title: "Push",
        runKind: null,
        planned: true,
        startMin: 15 * 60,
      },
      // Plan z następnego tygodnia nie trafia na listę
      {
        ...bieg("y", "2026-11-26"),
        key: `t:${SZABLON_PUSH}:2026-11-26`,
        sessionId: null,
        templateId: SZABLON_PUSH,
        kind: "gym",
        title: "Push",
        runKind: null,
        planned: true,
        startMin: 15 * 60,
      },
    ];
    // items z loadSportMonth są posortowane wg daty i godziny
    d.items.sort((a, b) =>
      a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.startMin - b.startMin,
    );
    pokaz(d);
    const lista = screen.getByRole("region", { name: "Zaplanowane" });
    const wiersze = Array.from(
      lista.querySelectorAll<HTMLElement>("a, button"),
    );
    expect(wiersze).toHaveLength(3);
    // Kolejność wg daty
    expect(wiersze[0]).toHaveTextContent("Siłownia — Nogi");
    expect(wiersze[0]).toHaveTextContent("pon 16.11 · 18:00");
    expect(wiersze[0]).toHaveAttribute(
      "href",
      `/sport/trening/${NIEDOKONCZONY}`,
    );
    expect(wiersze[1]).toHaveTextContent("Spokojny · 10,0 km");
    expect(wiersze[1]).toHaveTextContent("śr 18.11");
    await userEvent.click(wiersze[1]);
    expect(onOpenRun).toHaveBeenCalledWith({
      sessionId: "a1000000-0000-4000-8000-000000000218",
    });
    expect(wiersze[2]).toHaveTextContent("Siłownia — Push");
    expect(wiersze[2]).toHaveTextContent("czw 19.11 · 15:00");
    await userEvent.click(wiersze[2]);
    expect(onStartGym).toHaveBeenCalledWith({
      date: "2026-11-19",
      start: "15:00",
      templateId: SZABLON_PUSH,
    });
  });

  it("bez planów w tygodniu nie ma sekcji „Zaplanowane”", () => {
    const d = dane();
    pokaz({ ...d, items: d.items.filter((i) => !i.planned) });
    expect(
      screen.queryByRole("region", { name: "Zaplanowane" }),
    ).not.toBeInTheDocument();
  });

  it("?wybrany= na telefonie: przekazuje trening raz (także po ponownym renderze)", () => {
    ustawTelefon(true);
    const d = dane();
    const klucz = "s:a1000000-0000-4000-8000-000000000218";
    const { rerender } = pokaz(d, klucz);
    rerender(
      <MSport
        data={{ ...d }}
        selectedKey={klucz}
        onNewRun={onNewRun}
        onNewGym={onNewGym}
        onOpenRun={onOpenRun}
        onStartGym={onStartGym}
        onSelected={onSelected}
      />,
    );
    expect(onSelected).toHaveBeenCalledTimes(1);
    expect(onSelected).toHaveBeenCalledWith(
      expect.objectContaining({ key: klucz, kind: "run" }),
    );
  });

  it("?wybrany= od 800 px nic nie robi (dymek pokazuje web)", () => {
    ustawTelefon(false);
    pokaz(dane(), "s:a1000000-0000-4000-8000-000000000218");
    expect(onSelected).not.toHaveBeenCalled();
  });

  it("?wybrany= spoza danych nic nie robi", () => {
    ustawTelefon(true);
    pokaz(dane(), "s:nie-ma");
    expect(onSelected).not.toHaveBeenCalled();
  });
});
