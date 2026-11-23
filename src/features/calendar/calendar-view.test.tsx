import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  setCategoryHidden,
  createCategory,
  toastError,
  push,
  replace,
  createBlock,
  changeOccurrence,
} = vi.hoisted(() => ({
  setCategoryHidden: vi.fn(),
  createCategory: vi.fn(),
  toastError: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  createBlock: vi.fn(),
  changeOccurrence: vi.fn(),
}));
vi.mock("@/features/categories/actions", () => ({
  setCategoryHidden,
  createCategory,
}));
vi.mock("./actions", () => ({ createBlock, changeOccurrence }));
vi.mock("@/features/tasks/actions", () => ({
  addTask: vi.fn(),
  toggleTask: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));

// Układ telefonu (te same bloki w DOM) ma własny plik testów; tu sprawdzamy web
vi.mock("./mobile/m-calendar-day", () => ({ MCalendarDay: () => null }));
vi.mock("./mobile/m-calendar-week", () => ({ MCalendarWeek: () => null }));
vi.mock("./mobile/m-calendar-month", () => ({ MCalendarMonth: () => null }));

import { CalendarView } from "./calendar-view";
import type { CalendarData } from "./load-calendar";
import { planZSzablonu, trening } from "./mobile/fixtures";

function blok(id: string, title: string, categoryId: string) {
  return {
    id,
    user_id: "u1",
    title,
    start_local: "2026-11-18T08:00:00",
    duration_min: 60,
    category_id: categoryId,
    note: null,
    recurrence: null,
    remind: false,
    timezone: "Europe/Warsaw",
    created_at: null,
    updated_at: null,
  };
}

function dane(): CalendarData {
  return {
    blocks: [blok("b1", "Algebra", "c1"), blok("b2", "Sprzątanie", "c2")],
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
      {
        id: "c2",
        name: "Dom",
        color: "#a16207",
        hidden: false,
        is_system: false,
        position: 2,
        user_id: "u1",
        created_at: null,
      },
    ],
    profile: { timezone: "Europe/Warsaw", weekStart: "mon", clock: "24" },
    sport: [],
  };
}

function wyrenderuj(data = dane()) {
  return render(
    <CalendarView
      view="tydzien"
      date="2026-11-18"
      today="2026-11-17"
      nowMinutes={600}
      data={data}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Przycisk „Kategorie N/M” na webie (na telefonie jest ikona o nazwie „Kategorie”).
// `hidden`: przy otwartym menu reszta strony ma aria-hidden (menu modalne)
const przyciskKategorii = () =>
  screen.getByRole("button", {
    name: /^Kategorie, widoczne \d+ z \d+$/,
    hidden: true,
  });

// Otwiera menu „Kategorie” i zwraca pole wyboru kategorii o tej nazwie
async function poleKategorii(nazwa: string) {
  if (!screen.queryByRole("menu")) await userEvent.click(przyciskKategorii());
  return screen.findByRole("menuitemcheckbox", { name: new RegExp(nazwa) });
}

describe("CalendarView", () => {
  it("przycisk „Kategorie” liczy widoczne kategorie", () => {
    wyrenderuj();
    expect(przyciskKategorii()).toHaveTextContent("2/2");
    expect(screen.getByText("Algebra")).toBeInTheDocument();
    // Dawny rząd chipów („POKAŻ”) zniknął
    expect(screen.queryByText("Pokaż")).not.toBeInTheDocument();
  });

  it("odhaczenie kategorii w menu ukrywa ją od razu i woła setCategoryHidden", async () => {
    setCategoryHidden.mockResolvedValue({ ok: true });
    wyrenderuj();
    await userEvent.click(await poleKategorii("Dom"));
    expect(setCategoryHidden).toHaveBeenCalledWith({ id: "c2", hidden: true });
    await waitFor(() =>
      expect(
        screen.getByRole("menuitemcheckbox", { name: /Dom/ }),
      ).toHaveAttribute("aria-checked", "false"),
    );
    expect(przyciskKategorii()).toHaveTextContent("1/2");
    expect(screen.queryByText("Sprzątanie")).not.toBeInTheDocument();
    expect(screen.getByText("Algebra")).toBeInTheDocument();
  });

  it("błąd akcji przywraca kategorię i blok oraz pokazuje toast", async () => {
    setCategoryHidden.mockResolvedValue({ ok: false, message: "x" });
    wyrenderuj();
    await userEvent.click(await poleKategorii("Dom"));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Nie udało się zapisać. Spróbuj ponownie.",
      ),
    );
    expect(
      screen.getByRole("menuitemcheckbox", { name: /Dom/ }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Sprzątanie")).toBeInTheDocument();
  });

  it("nowe dane z serwera zastępują stan klienta", async () => {
    setCategoryHidden.mockResolvedValue({ ok: true });
    const { rerender } = wyrenderuj();
    await userEvent.click(await poleKategorii("Dom"));
    rerender(
      <CalendarView
        view="tydzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={dane()}
      />,
    );
    expect(
      screen.getByRole("menuitemcheckbox", { name: /Dom/ }),
    ).toHaveAttribute("aria-checked", "true");
    expect(przyciskKategorii()).toHaveTextContent("2/2");
  });

  it("klik w blok otwiera dymek, ponowny klik i Esc go zamykają", async () => {
    wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    expect(
      screen.getByRole("dialog", { name: "Szczegóły bloku" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ukrycie kategorii bloku zamyka dymek i nie wraca po ponownym pokazaniu", async () => {
    setCategoryHidden.mockResolvedValue({ ok: true });
    wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(await poleKategorii("Studia"));
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    await userEvent.click(await poleKategorii("Studia"));
    await userEvent.keyboard("{Escape}");
    await screen.findByRole("button", { name: /^Algebra/ });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("klik w pusty slot 10:00 pokazuje „Nowy wpis” z 10:00; „Blok” otwiera okno z 10:00–11:00", async () => {
    wyrenderuj();
    // 20. półgodzina (24 px każda) = 10:00
    fireEvent.click(screen.getByTestId("kolumna-2026-11-19"), { clientY: 480 });
    const dymek = await screen.findByRole("dialog", { name: "Nowy wpis" });
    expect(within(dymek).getByText("cz 19.11 · 10:00")).toBeInTheDocument();
    await userEvent.click(within(dymek).getByRole("button", { name: /Blok/ }));
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(
      within(okno).getByRole("button", { name: "Dzień" }),
    ).toHaveTextContent("19.11.2026");
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent(
      "10:00",
    );
    expect(within(okno).getByRole("button", { name: "Do" })).toHaveTextContent(
      "11:00",
    );
    expect(
      screen.queryByRole("dialog", { name: "Nowy wpis" }),
    ).not.toBeInTheDocument();
  });

  it("ponowny klik w ten sam slot zamyka „Nowy wpis”", async () => {
    wyrenderuj();
    fireEvent.click(screen.getByTestId("kolumna-2026-11-19"), { clientY: 480 });
    await screen.findByRole("dialog", { name: "Nowy wpis" });
    fireEvent.click(screen.getByTestId("kolumna-2026-11-19"), { clientY: 480 });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("„Nowy blok” z nagłówka bierze dziś i najbliższą pełną godzinę na 60 min", async () => {
    wyrenderuj();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Nowy blok" })[0],
    );
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    // today = 2026-11-17, nowMinutes = 600 (10:00) -> 11:00–12:00
    expect(
      within(okno).getByRole("button", { name: "Dzień" }),
    ).toHaveTextContent("17.11.2026");
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent(
      "11:00",
    );
    expect(within(okno).getByRole("button", { name: "Do" })).toHaveTextContent(
      "12:00",
    );
  });

  it("Anuluj i ✕ zamykają okno bloku bez zmiany adresu", async () => {
    wyrenderuj();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Nowy blok" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Anuluj" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Nowy blok" })[0],
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Zamknij" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("„+ Kategoria” w menu otwiera okno kategorii; po dodaniu kategoria jest w menu", async () => {
    createCategory.mockResolvedValue({ ok: true, id: "c9" });
    wyrenderuj();
    await userEvent.click(przyciskKategorii());
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "+ Kategoria" }),
    );
    await userEvent.type(await screen.findByLabelText("Nazwa"), "Języki");
    await userEvent.click(
      screen.getByRole("button", { name: "Dodaj kategorię" }),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(createCategory).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Języki" }),
    );
    expect(przyciskKategorii()).toHaveTextContent("3/3");
    expect(await poleKategorii("Języki")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("„Edytuj” w dymku otwiera okno bloku z danymi wystąpienia", async () => {
    wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Szczegóły bloku" })).getByRole(
        "button",
        { name: "Edytuj" },
      ),
    );
    const okno = await screen.findByRole("dialog", { name: "Edytuj blok" });
    expect(within(okno).getByLabelText("Tytuł")).toHaveValue("Algebra");
    expect(
      within(okno).getByRole("button", { name: "Dzień" }),
    ).toHaveTextContent("18.11.2026");
    expect(
      screen.queryByRole("dialog", { name: "Szczegóły bloku" }),
    ).not.toBeInTheDocument();
  });

  it("„Usuń” w dymku bloku jednorazowego pyta „Usunąć blok?” i usuwa po „Usuń”", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Szczegóły bloku" })).getByRole(
        "button",
        { name: "Usuń" },
      ),
    );
    const okno = await screen.findByRole("alertdialog", {
      name: "Usunąć blok?",
    });
    await userEvent.click(within(okno).getByRole("button", { name: "Usuń" }));
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-18",
      scope: "all",
      delete: true,
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});

describe("CalendarView — przeciąganie", () => {
  // jsdom nie liczy układu: kolumny tygodnia 2026-11-16… mają po 100 px szerokości od x=60,
  // godzina ma 48 px, a przewijana siatka zajmuje 0–800 × 0–2000
  const POCZATEK = "2026-11-16";
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
      function (this: HTMLElement) {
        if (this.dataset.testid === "przewijanie") {
          return new DOMRect(0, 0, 800, 2000);
        }
        const dzien = this.dataset.kolumna;
        if (dzien) {
          const numer = Math.round(
            (Date.parse(dzien) - Date.parse(POCZATEK)) / 86_400_000,
          );
          return new DOMRect(60 + numer * 100, 0, 100, 1152);
        }
        return new DOMRect(0, 0, 0, 0);
      },
    );
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Środek kolumny dnia (środa 18.11 = indeks 2)
  const X_SRODA = 60 + 2 * 100 + 50;

  function przeciagnij(
    el: Element,
    od: { x: number; y: number },
    doPunktu: { x: number; y: number },
  ) {
    fireEvent.pointerDown(el, {
      clientX: od.x,
      clientY: od.y,
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerMove(el, {
      buttons: 1,
      clientX: doPunktu.x,
      clientY: doPunktu.y,
      pointerId: 1,
    });
    fireEvent.pointerUp(el, {
      clientX: doPunktu.x,
      clientY: doPunktu.y,
      pointerId: 1,
    });
  }

  function cykliczne(start: string, freq = "weekly") {
    const d = dane();
    d.blocks[0] = {
      ...d.blocks[0],
      start_local: `${start}T08:00:00`,
      recurrence: { freq },
    } as never;
    return d;
  }

  it("ruch o 2 px to klik: otwiera dymek i nie zapisuje", async () => {
    wyrenderuj();
    const blok = screen.getByRole("button", { name: /^Algebra/ });
    przeciagnij(blok, { x: X_SRODA, y: 394 }, { x: X_SRODA + 1, y: 396 });
    fireEvent.click(blok);
    expect(
      await screen.findByRole("dialog", { name: "Szczegóły bloku" }),
    ).toBeInTheDocument();
    expect(changeOccurrence).not.toHaveBeenCalled();
  });

  it("przesunięcie bloku jednorazowego o godzinę zapisuje od razu z nowym startMin", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    wyrenderuj();
    const blok = screen.getByRole("button", { name: /^Algebra/ });
    przeciagnij(blok, { x: X_SRODA, y: 394 }, { x: X_SRODA, y: 394 + 48 });
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-18",
      scope: "all",
      patch: { startMin: 540 },
    });
    // Blok od razu stoi na nowym miejscu (09:00 = 432 px)
    expect(screen.getByTestId("blok-b1:2026-11-18").style.top).toBe("432px");
    // Klik po puszczeniu nie otwiera dymku
    fireEvent.click(blok);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("przesunięcie na inny dzień zmienia date w patchu", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    wyrenderuj();
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_SRODA, y: 394 },
      { x: X_SRODA + 100, y: 394 },
    );
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-18",
      scope: "all",
      patch: { date: "2026-11-19" },
    });
  });

  it("błąd akcji cofa blok na stare miejsce i pokazuje toast", async () => {
    changeOccurrence.mockResolvedValue({ ok: false, message: "x" });
    wyrenderuj();
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_SRODA, y: 394 },
      { x: X_SRODA, y: 394 + 48 },
    );
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Nie udało się zapisać. Spróbuj ponownie.",
      ),
    );
    expect(screen.getByTestId("blok-b1:2026-11-18").style.top).toBe("384px");
  });

  it("rozciąganie dolnym uchwytem zmienia durationMin", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    wyrenderuj();
    przeciagnij(
      screen.getByTestId("uchwyt-b1:2026-11-18"),
      { x: X_SRODA, y: 440 },
      { x: X_SRODA, y: 440 + 48 },
    );
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-18",
      scope: "all",
      patch: { durationMin: 120 },
    });
  });

  it("blok cykliczny: okno zakresu, „Anuluj” przywraca blok na stare miejsce", async () => {
    wyrenderuj(cykliczne("2026-11-11"));
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_SRODA, y: 394 },
      { x: X_SRODA, y: 394 + 48 },
    );
    const okno = await screen.findByRole("dialog", {
      name: "Zmieniasz blok, który się powtarza",
    });
    // Podczas pytania blok stoi już na nowym miejscu
    expect(screen.getByTestId("blok-b1:2026-11-18").style.top).toBe("432px");
    await userEvent.click(within(okno).getByRole("button", { name: "Anuluj" }));
    expect(changeOccurrence).not.toHaveBeenCalled();
    expect(screen.getByTestId("blok-b1:2026-11-18").style.top).toBe("384px");
  });

  it("blok cykliczny: wybór zakresu woła changeOccurrence z oryginalną datą", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    wyrenderuj(cykliczne("2026-11-11"));
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_SRODA, y: 394 },
      { x: X_SRODA, y: 394 + 48 },
    );
    const okno = await screen.findByRole("dialog", {
      name: "Zmieniasz blok, który się powtarza",
    });
    await userEvent.click(
      within(okno).getByRole("button", { name: "Zapisz zmianę" }),
    );
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-18",
      scope: "this",
      patch: { startMin: 540 },
    });
  });

  it("zmiana dnia nie-pierwszego wystąpienia wyłącza „To i następne”", async () => {
    wyrenderuj(cykliczne("2026-11-11"));
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_SRODA, y: 394 },
      { x: X_SRODA + 100, y: 394 },
    );
    const okno = await screen.findByRole("dialog", {
      name: "Zmieniasz blok, który się powtarza",
    });
    expect(
      within(okno).getByRole("radio", { name: /To i następne/ }),
    ).toBeDisabled();
    expect(
      within(okno).getByText(
        "Zmiana dnia działa dla tego wystąpienia albo dla całej serii.",
      ),
    ).toBeInTheDocument();
  });

  it("zmiana dnia w serii codziennej zostawia tylko „Tylko to wystąpienie”", async () => {
    wyrenderuj(cykliczne("2026-11-11", "daily"));
    przeciagnij(
      within(screen.getByTestId("blok-b1:2026-11-18")).getAllByRole(
        "button",
      )[0],
      { x: X_SRODA, y: 394 },
      { x: X_SRODA + 100, y: 394 },
    );
    const okno = await screen.findByRole("dialog", {
      name: "Zmieniasz blok, który się powtarza",
    });
    expect(
      within(okno).getByRole("radio", { name: /Tylko to wystąpienie/ }),
    ).toBeEnabled();
    expect(
      within(okno).getByRole("radio", { name: /To i następne/ }),
    ).toBeDisabled();
    expect(
      within(okno).getByRole("radio", { name: /Wszystkie wystąpienia/ }),
    ).toBeDisabled();
    expect(
      within(okno).getByText(
        "Zmiana dnia działa dla tego wystąpienia albo dla całej serii tygodniowej.",
      ),
    ).toBeInTheDocument();
  });

  it("zmiana dnia pierwszego wystąpienia zostawia „To i następne” dostępne", async () => {
    wyrenderuj(cykliczne("2026-11-18"));
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_SRODA, y: 394 },
      { x: X_SRODA + 100, y: 394 },
    );
    const okno = await screen.findByRole("dialog", {
      name: "Zmieniasz blok, który się powtarza",
    });
    expect(
      within(okno).getByRole("radio", { name: /To i następne/ }),
    ).toBeEnabled();
  });

  it("przeciągnięcie po pustej siatce otwiera „Nowy blok” z zakresem", async () => {
    wyrenderuj();
    // 10:00 (480 px) → 11:00 (528 px) w piątek 20.11
    const kolumna = screen.getByTestId("kolumna-2026-11-20");
    przeciagnij(
      kolumna,
      { x: 60 + 4 * 100 + 50, y: 480 },
      { x: 60 + 4 * 100 + 50, y: 528 },
    );
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(
      within(okno).getByRole("button", { name: "Dzień" }),
    ).toHaveTextContent("20.11.2026");
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent(
      "10:00",
    );
    expect(within(okno).getByRole("button", { name: "Do" })).toHaveTextContent(
      "11:00",
    );
    expect(
      screen.queryByRole("dialog", { name: "Nowy wpis" }),
    ).not.toBeInTheDocument();
  });

  it("Esc w trakcie przeciągania anuluje zapis", async () => {
    wyrenderuj();
    const blok = screen.getByRole("button", { name: /^Algebra/ });
    fireEvent.pointerDown(blok, {
      clientX: X_SRODA,
      clientY: 394,
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerMove(blok, {
      buttons: 1,
      clientX: X_SRODA,
      clientY: 442,
      pointerId: 1,
    });
    fireEvent.keyDown(window, { key: "Escape" });
    fireEvent.pointerUp(blok, { clientX: X_SRODA, clientY: 442, pointerId: 1 });
    expect(changeOccurrence).not.toHaveBeenCalled();
    expect(screen.getByTestId("blok-b1:2026-11-18").style.top).toBe("384px");
  });

  it("puszczenie poza siatką anuluje zapis", async () => {
    wyrenderuj();
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_SRODA, y: 394 },
      { x: 5000, y: 442 },
    );
    expect(changeOccurrence).not.toHaveBeenCalled();
    expect(screen.getByTestId("blok-b1:2026-11-18").style.top).toBe("384px");
  });

  it("zgubiony pointerup: ruch bez wciśniętego przycisku kończy gest, a następny działa", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    wyrenderuj();
    const blok = screen.getByRole("button", { name: /^Algebra/ });
    fireEvent.pointerDown(blok, {
      clientX: X_SRODA,
      clientY: 394,
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerMove(blok, {
      buttons: 1,
      clientX: X_SRODA,
      clientY: 442,
      pointerId: 1,
    });
    expect(screen.getByTestId("podglad-przeciagania")).toBeInTheDocument();
    fireEvent.pointerMove(blok, {
      buttons: 0,
      clientX: X_SRODA,
      clientY: 490,
      pointerId: 1,
    });
    expect(
      screen.queryByTestId("podglad-przeciagania"),
    ).not.toBeInTheDocument();
    expect(changeOccurrence).not.toHaveBeenCalled();
    przeciagnij(blok, { x: X_SRODA, y: 394 }, { x: X_SRODA, y: 442 });
    expect(changeOccurrence).toHaveBeenCalledTimes(1);
  });

  it("blur okna anuluje gest", () => {
    wyrenderuj();
    const blok = screen.getByRole("button", { name: /^Algebra/ });
    fireEvent.pointerDown(blok, {
      clientX: X_SRODA,
      clientY: 394,
      button: 0,
      pointerId: 1,
    });
    fireEvent.pointerMove(blok, {
      buttons: 1,
      clientX: X_SRODA,
      clientY: 442,
      pointerId: 1,
    });
    fireEvent.blur(window);
    expect(
      screen.queryByTestId("podglad-przeciagania"),
    ).not.toBeInTheDocument();
    fireEvent.pointerUp(blok, { clientX: X_SRODA, clientY: 442, pointerId: 1 });
    expect(changeOccurrence).not.toHaveBeenCalled();
  });

  it("dotyk nie przeciąga (przewijanie siatki zostaje)", () => {
    wyrenderuj();
    const blok = screen.getByRole("button", { name: /^Algebra/ });
    fireEvent.pointerDown(blok, {
      clientX: X_SRODA,
      clientY: 394,
      button: 0,
      pointerId: 1,
      pointerType: "touch",
    });
    fireEvent.pointerMove(blok, {
      buttons: 1,
      clientX: X_SRODA,
      clientY: 442,
      pointerId: 1,
      pointerType: "touch",
    });
    expect(
      screen.queryByTestId("podglad-przeciagania"),
    ).not.toBeInTheDocument();
    fireEvent.pointerUp(blok, {
      clientX: X_SRODA,
      clientY: 442,
      pointerId: 1,
      pointerType: "touch",
    });
    expect(changeOccurrence).not.toHaveBeenCalled();
  });

  it("odmontowanie w trakcie przeciągania zdejmuje słuchaczy okna", () => {
    const zdejmij = vi.spyOn(window, "removeEventListener");
    const { unmount } = wyrenderuj();
    const blok = screen.getByRole("button", { name: /^Algebra/ });
    fireEvent.pointerDown(blok, {
      clientX: X_SRODA,
      clientY: 394,
      button: 0,
      pointerId: 1,
    });
    unmount();
    const typy = zdejmij.mock.calls.map((c) => c[0]);
    expect(typy).toEqual(
      expect.arrayContaining([
        "pointermove",
        "pointerup",
        "pointercancel",
        "keydown",
        "blur",
      ]),
    );
  });

  it("puszczenie nad gutterem z godzinami (przed pierwszą kolumną) anuluje", () => {
    wyrenderuj();
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_SRODA, y: 394 },
      { x: 30, y: 442 },
    );
    expect(changeOccurrence).not.toHaveBeenCalled();
  });

  it("ruch bez pełnego kroku nie zmienia bloku spoza siatki 15 minut", () => {
    const d = dane();
    d.blocks[0] = { ...d.blocks[0], start_local: "2026-11-18T08:07:00" };
    wyrenderuj(d);
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_SRODA, y: 394 },
      { x: X_SRODA, y: 399 },
    );
    expect(changeOccurrence).not.toHaveBeenCalled();
  });

  it("blok krótszy niż 30 min nie ma uchwytu rozciągania", () => {
    const d = dane();
    d.blocks[0] = { ...d.blocks[0], duration_min: 15 };
    wyrenderuj(d);
    expect(
      screen.queryByTestId("uchwyt-b1:2026-11-18"),
    ).not.toBeInTheDocument();
  });

  it("przesunięcie jednorazowego bloku zamyka otwarty „Nowy wpis”", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    wyrenderuj();
    fireEvent.click(screen.getByTestId("kolumna-2026-11-19"), { clientY: 480 });
    await screen.findByRole("dialog", { name: "Nowy wpis" });
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_SRODA, y: 394 },
      { x: X_SRODA, y: 442 },
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Nowy wpis" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("podział serii („To i następne”): blok zostaje na nowym miejscu do nowych danych serwera", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    const { rerender } = wyrenderuj(cykliczne("2026-11-11"));
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_SRODA, y: 394 },
      { x: X_SRODA, y: 442 },
    );
    const okno = await screen.findByRole("dialog", {
      name: "Zmieniasz blok, który się powtarza",
    });
    await userEvent.click(
      within(okno).getByRole("radio", { name: /To i następne/ }),
    );
    await userEvent.click(
      within(okno).getByRole("button", { name: "Zapisz zmianę" }),
    );
    await waitFor(() => expect(changeOccurrence).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.getByTestId("blok-b1:2026-11-18").style.top).toBe("432px");
    rerender(
      <CalendarView
        view="tydzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={cykliczne("2026-11-11")}
      />,
    );
    expect(screen.getByTestId("blok-b1:2026-11-18").style.top).toBe("384px");
  });

  it("przesunięte wcześniej wystąpienie da się przeciągnąć ponownie (data z klucza)", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    const d = cykliczne("2026-11-11");
    d.exceptions = [
      {
        block_id: "b1",
        user_id: "u1",
        occurrence_date: "2026-11-18",
        kind: "modified",
        new_start_local: "2026-11-19T09:00:00",
        new_duration_min: 60,
        new_title: null,
      },
    ] as never;
    wyrenderuj(d);
    const X_CZWARTEK = 60 + 3 * 100 + 50;
    przeciagnij(
      screen.getByRole("button", { name: /^Algebra/ }),
      { x: X_CZWARTEK, y: 442 },
      { x: X_CZWARTEK, y: 490 },
    );
    const okno = await screen.findByRole("dialog", {
      name: "Zmieniasz blok, który się powtarza",
    });
    await userEvent.click(
      within(okno).getByRole("button", { name: "Zapisz zmianę" }),
    );
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-18",
      scope: "this",
      patch: { startMin: 600 },
    });
  });
});

describe("CalendarView — zegar", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("linia „teraz” startuje od wartości z serwera i przesuwa się co minutę", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    // 09:05 UTC = 10:05 w Warszawie; serwer podał 10:00 (600 min)
    vi.setSystemTime(new Date("2026-11-17T09:05:00Z"));
    wyrenderuj();
    expect(screen.getByTestId("linia-teraz").style.top).toBe("480px");
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    // 10:06 → 606 min → 484,8 px
    expect(screen.getByTestId("linia-teraz").style.top).toBe("484.8px");
  });

  it("o północy „dziś” przechodzi na następny dzień", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval", "Date"] });
    // 22:59:30 UTC = 23:59:30 w Warszawie
    vi.setSystemTime(new Date("2026-11-17T22:59:30Z"));
    render(
      <CalendarView
        view="tydzien"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={1439}
        data={dane()}
      />,
    );
    expect(
      within(screen.getByTestId("kolumna-2026-11-17")).getByTestId(
        "linia-teraz",
      ),
    ).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(
      within(screen.getByTestId("kolumna-2026-11-18")).getByTestId(
        "linia-teraz",
      ).style.top,
    ).toBe("0px");
    expect(
      within(screen.getByTestId("kolumna-2026-11-17")).queryByTestId(
        "linia-teraz",
      ),
    ).toBeNull();
  });
});

describe("CalendarView — miesiąc", () => {
  function miesiac(data = dane()) {
    return render(
      <CalendarView
        view="miesiac"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={data}
      />,
    );
  }

  it("nagłówek liczy widoczne wpisy miesiąca i zmienia się po ukryciu kategorii", async () => {
    setCategoryHidden.mockResolvedValue({ ok: true });
    miesiac();
    expect(screen.getByText("2 wpisy widoczne")).toBeInTheDocument();
    // Miesiąc ma ten sam cienki pasek z przyciskiem „Kategorie”
    await userEvent.click(await poleKategorii("Dom"));
    await waitFor(() =>
      expect(screen.getByText("1 wpis widoczny")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/Sprzątanie/)).not.toBeInTheDocument();
  });

  it("nagłówek: 5+ i 12–14 wpisów widocznych, 22 wpisy widoczne", () => {
    for (const [n, napis] of [
      [5, "5 wpisów widocznych"],
      [12, "12 wpisów widocznych"],
      [22, "22 wpisy widoczne"],
    ] as const) {
      const d = dane();
      d.blocks = Array.from({ length: n }, (_, i) => ({
        ...blok(`b${i}`, `W${i}`, "c1"),
        start_local: `2026-11-${String(i + 1).padStart(2, "0")}T08:00:00`,
      }));
      const { unmount } = miesiac(d);
      expect(screen.getByText(napis)).toBeInTheDocument();
      unmount();
    }
  });

  it("klik w komórkę dnia otwiera „Nowy wpis” z tym dniem i 09:00", async () => {
    miesiac();
    fireEvent.click(screen.getByTestId("komorka-2026-11-19"));
    const dymek = await screen.findByRole("dialog", { name: "Nowy wpis" });
    expect(within(dymek).getByText("cz 19.11 · 09:00")).toBeInTheDocument();
    // Ponowny klik w tę samą komórkę zamyka dymek
    fireEvent.click(screen.getByTestId("komorka-2026-11-19"));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Nowy wpis" }),
      ).not.toBeInTheDocument(),
    );
  });

  it("klik we wpis otwiera dymek bloku, ponowny klik go zamyka", async () => {
    miesiac();
    await userEvent.click(screen.getByRole("button", { name: /Algebra/ }));
    expect(
      screen.getByRole("dialog", { name: "Szczegóły bloku" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Algebra/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("CalendarView — podgląd treningów", () => {
  // Dane z systemową kategorią „Sport” (ukrytą albo nie) i dwoma treningami tygodnia
  function zeSportem(hidden: boolean | null): CalendarData {
    const d = dane();
    if (hidden !== null) {
      d.categories.push({
        id: "c-sport",
        name: "Sport",
        color: "#c2410c",
        hidden,
        is_system: true,
        position: 3,
        user_id: "u1",
        created_at: null,
      });
    }
    d.sport = [trening(), planZSzablonu()];
    return d;
  }

  it("tydzień i miesiąc pokazują bieg i plan z szablonu z linkiem do /sport", () => {
    const { unmount } = wyrenderuj(zeSportem(false));
    expect(screen.getByRole("link", { name: /Spokojny/ })).toHaveAttribute(
      "href",
      "/sport?miesiac=2026-11&wybrany=s:s1",
    );
    expect(screen.getByRole("link", { name: /Push/ })).toHaveAttribute(
      "data-planned",
      "true",
    );
    unmount();
    render(
      <CalendarView
        view="miesiac"
        date="2026-11-18"
        today="2026-11-17"
        nowMinutes={600}
        data={zeSportem(false)}
      />,
    );
    expect(screen.getByRole("link", { name: "Spokojny" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Push" })).toBeInTheDocument();
    // Treningi liczą się do wpisów miesiąca (2 bloki + 2 treningi)
    expect(screen.getByText("4 wpisy widoczne")).toBeInTheDocument();
  });

  it("ukryta kategoria „Sport” chowa podgląd, a odhaczenie jej w menu chowa go od razu", async () => {
    setCategoryHidden.mockResolvedValue({ ok: true });
    const { unmount } = wyrenderuj(zeSportem(true));
    expect(
      screen.queryByRole("link", { name: /Spokojny/ }),
    ).not.toBeInTheDocument();
    unmount();

    wyrenderuj(zeSportem(false));
    expect(screen.getByRole("link", { name: /Spokojny/ })).toBeInTheDocument();
    await userEvent.click(await poleKategorii("Sport"));
    await waitFor(() =>
      expect(
        screen.queryByRole("link", { name: /Spokojny/ }),
      ).not.toBeInTheDocument(),
    );
    expect(setCategoryHidden).toHaveBeenCalledWith({
      id: "c-sport",
      hidden: true,
    });
  });

  it("bez kategorii „Sport” podgląd i tak jest widoczny", () => {
    wyrenderuj(zeSportem(null));
    expect(screen.getByRole("link", { name: /Spokojny/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Push/ })).toBeInTheDocument();
  });

  describe("?nowy=blok", () => {
    afterEach(() => window.history.replaceState(null, "", "/"));

    function zAdresem(rerender?: ReturnType<typeof render>["rerender"]) {
      const widok = (
        <CalendarView
          view="tydzien"
          date="2026-11-20"
          today="2026-11-17"
          nowMinutes={600}
          data={dane()}
          newBlock={{
            date: "2026-11-20",
            startMin: 18 * 60,
            title: "Nauka SQL",
          }}
        />
      );
      return rerender ? rerender(widok) : render(widok);
    }

    it("otwiera okno z datą, godziną i tytułem; zamknięcie czyści adres (widok i data zostają)", async () => {
      window.history.replaceState(
        null,
        "",
        "/kalendarz?widok=tydzien&nowy=blok&data=2026-11-20&godzina=18:00&tytul=Nauka%20SQL",
      );
      zAdresem();
      const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
      expect(within(okno).getByLabelText("Tytuł")).toHaveValue("Nauka SQL");
      expect(
        within(okno).getByRole("button", { name: "Dzień" }),
      ).toHaveTextContent("20.11.2026");
      expect(
        within(okno).getByRole("button", { name: "Od" }),
      ).toHaveTextContent("18:00");
      expect(
        within(okno).getByRole("button", { name: "Do" }),
      ).toHaveTextContent("19:00");

      await userEvent.click(
        within(okno).getByRole("button", { name: "Anuluj" }),
      );
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(replace).toHaveBeenCalledWith(
        "/kalendarz?widok=tydzien&data=2026-11-20",
        { scroll: false },
      );
    });

    it("ten sam adres nie otwiera okna drugi raz (np. nowe dane z serwera)", async () => {
      const { rerender } = zAdresem() as ReturnType<typeof render>;
      const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
      await userEvent.click(
        within(okno).getByRole("button", { name: "Anuluj" }),
      );
      zAdresem(rerender);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("zwykłe zamknięcie okna bez ?nowy=blok nie zmienia adresu", async () => {
      wyrenderuj();
      fireEvent.click(screen.getByTestId("kolumna-2026-11-19"), {
        clientY: 480,
      });
      const dymek = await screen.findByRole("dialog", { name: "Nowy wpis" });
      await userEvent.click(
        within(dymek).getByRole("button", { name: /Blok/ }),
      );
      const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
      await userEvent.click(
        within(okno).getByRole("button", { name: "Anuluj" }),
      );
      expect(replace).not.toHaveBeenCalled();
    });
  });
});
