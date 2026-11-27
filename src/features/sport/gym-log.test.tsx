import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const akcje = vi.hoisted(() => ({
  updateSet: vi.fn(),
  addSet: vi.fn(),
  deleteSet: vi.fn(),
  removeExercise: vi.fn(),
  addExercise: vi.fn(),
  finishWorkout: vi.fn(),
  startWorkout: vi.fn(),
  discardWorkout: vi.fn(),
  copyWorkout: vi.fn(),
  saveExercise: vi.fn(),
  updateExercise: vi.fn(),
  saveSessionAsTemplate: vi.fn(),
}));
const { push, toastError } = vi.hoisted(() => ({ push: vi.fn(), toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError, success: vi.fn() } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./actions", () => akcje);
vi.mock("./delete-session-dialog", () => ({ DeleteSessionDialog: () => <div>usuwanie</div> }));

import { daneTreningu, SESJA } from "./gym-test-data";
import { GymView } from "./gym-view";
import { WYCISKANIE } from "./sport-test-data";

const WYC = "Wyciskanie na ławce";
const karta = (nazwa: string) => screen.getByRole("region", { name: nazwa });
const wiersz = (nr: number) => screen.getByTestId(`seria-${WYC}-${nr}`);

beforeEach(() => {
  vi.clearAllMocks();
  for (const a of Object.values(akcje)) a.mockResolvedValue({ ok: true });
  akcje.copyWorkout.mockResolvedValue({ ok: true, id: "kopia" });
  window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
});

describe("dziennik przed startem i w trakcie", () => {
  it("przed startem: ramka „Gotowy”, liczniki; „Rozpocznij” rusza licznik", async () => {
    render(<GymView data={daneTreningu()} />);
    expect(screen.getByText("Gotowy na Push? 2 ćwiczenia · 6 serii")).toBeInTheDocument();
    expect(screen.getByTestId("objetosc")).toHaveTextContent("1 202,5 kg");
    expect(screen.getByTestId("serie")).toHaveTextContent("3 / 6");
    expect(screen.getByTestId("czas")).toHaveTextContent("—");
    await userEvent.click(screen.getByRole("button", { name: "Rozpocznij" }));
    expect(akcje.startWorkout).toHaveBeenCalledWith(SESJA);
    expect(screen.getByTestId("czas")).toHaveTextContent("0:00:0");
    expect(screen.getByRole("button", { name: "Odrzuć trening" })).toBeInTheDocument();
    expect(screen.queryByText(/Gotowy na Push/)).not.toBeInTheDocument();
  });

  it("kolumna „Poprzednio” pokazuje wynik z ostatniego treningu i kopiuje go po kliknięciu", async () => {
    render(<GymView data={daneTreningu()} />);
    await userEvent.click(within(wiersz(1)).getByRole("button", { name: /Wpisz poprzedni wynik 70 × 6/ }));
    expect(akcje.updateSet).toHaveBeenCalledWith("w1", expect.objectContaining({ weight_kg: 70, reps: 6 }));
    expect(within(wiersz(3)).getByRole("button", { name: /brak poprzedniego wyniku/ })).toBeDisabled();
  });

  it("odhaczenie pustej serii wpisuje poprzedni wynik, uruchamia przerwę i licznik", async () => {
    const d = daneTreningu();
    d.sets = d.sets.map((s) => (s.id === "w2" ? { ...s, weight_kg: null, reps: null, done: false } : s));
    render(<GymView data={d} />);
    await userEvent.click(within(wiersz(2)).getByRole("button", { name: `${WYC}, seria 2 zrobiona` }));
    expect(akcje.updateSet).toHaveBeenCalledWith("w2", expect.objectContaining({ done: true, weight_kg: 70, reps: 5 }));
    expect(akcje.startWorkout).toHaveBeenCalledWith(SESJA);
    expect(screen.getByText("Przerwa", { selector: "span.truncate" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pomiń" }));
    expect(screen.queryByRole("button", { name: "Pomiń" })).not.toBeInTheDocument();
  });

  it("klik w numer serii zmienia typ; rozgrzewka wypada z objętości", async () => {
    render(<GymView data={daneTreningu()} />);
    await userEvent.click(within(wiersz(1)).getByRole("button", { name: /typ: robocza/ }));
    expect(akcje.updateSet).toHaveBeenCalledWith("w1", { set_type: "W" });
    expect(screen.getByTestId("objetosc")).toHaveTextContent("782,5 kg");
    expect(within(wiersz(1)).getByRole("button", { name: /typ: rozgrzewkowa/ })).toHaveTextContent("R");
  });

  it("przerwa ćwiczenia przełącza się chipem, notatka zapisuje się po wyjściu z pola", async () => {
    render(<GymView data={daneTreningu()} />);
    await userEvent.click(within(karta(WYC)).getByRole("button", { name: /Przerwa po serii 01:30/ }));
    expect(akcje.updateExercise).toHaveBeenCalledWith(WYCISKANIE, { rest_s: 120 });
    await userEvent.type(within(karta(WYC)).getByRole("textbox", { name: `Notatka: ${WYC}` }), "łopatki");
    await userEvent.tab();
    expect(akcje.updateExercise).toHaveBeenCalledWith(WYCISKANIE, { note: "łopatki" });
  });

  it("menu ćwiczenia: usunięcie z treningu", async () => {
    render(<GymView data={daneTreningu()} />);
    await userEvent.click(screen.getByRole("button", { name: `Więcej: ${WYC}` }));
    await userEvent.click(screen.getByRole("button", { name: "Usuń z treningu" }));
    expect(akcje.removeExercise).toHaveBeenCalledWith(SESJA, WYCISKANIE);
  });

  it("zakończenie: okno z liczbami, trudność i notatka trafiają do akcji, komputer wraca do Sportu", async () => {
    render(<GymView data={daneTreningu()} />);
    await userEvent.click(screen.getByRole("button", { name: "Rozpocznij" }));
    await userEvent.click(screen.getByRole("button", { name: /Zakończs*trening/ }));
    const okno = screen.getByRole("dialog", { name: "Zakończyć trening?" });
    expect(okno).toHaveTextContent("3 nieodhaczone serie zostaną pominięte.");
    await userEvent.click(within(okno).getByRole("radio", { name: "7" }));
    await userEvent.type(within(okno).getByLabelText("Notatka (opcjonalnie)"), "ok");
    await userEvent.click(within(okno).getByRole("button", { name: "Zapisz trening" }));
    expect(akcje.finishWorkout).toHaveBeenCalledWith(SESJA, { difficulty: 7, note: "ok" });
    await waitFor(() => expect(push).toHaveBeenCalledWith("/sport?miesiac=2026-11"));
  });

  it("odrzucenie wymaga potwierdzenia", async () => {
    render(<GymView data={daneTreningu()} />);
    await userEvent.click(screen.getByRole("button", { name: "Rozpocznij" }));
    await userEvent.click(screen.getByRole("button", { name: "Odrzuć trening" }));
    expect(akcje.discardWorkout).not.toHaveBeenCalled();
    await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Odrzuć trening" }));
    expect(akcje.discardWorkout).toHaveBeenCalledWith(SESJA);
  });

  it("dodawanie ćwiczeń: szukanie, kilka naraz, „w treningu” nieklikalne", async () => {
    akcje.addExercise.mockResolvedValue({ ok: true, id: "nowe" });
    render(<GymView data={daneTreningu()} />);
    await userEvent.click(screen.getByRole("button", { name: "Dodaj ćwiczenie" }));
    const okno = screen.getByRole("dialog", { name: "Dodaj ćwiczenie" });
    expect(within(okno).getByRole("checkbox", { name: new RegExp(WYC) })).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(within(okno).getByRole("checkbox", { name: /Martwy ciąg/ }));
    await userEvent.click(within(okno).getByRole("checkbox", { name: /Face pull/ }));
    await userEvent.click(within(okno).getByRole("button", { name: "Dodaj 2 ćwiczenia" }));
    await waitFor(() => expect(akcje.addExercise).toHaveBeenCalledTimes(2));
    expect(akcje.addExercise).toHaveBeenNthCalledWith(1, SESJA, "Martwy ciąg");
  });

  it("brak wyników → „Utwórz” otwiera formularz własnego ćwiczenia z rodzajem pomiaru", async () => {
    render(<GymView data={daneTreningu()} />);
    await userEvent.click(screen.getByRole("button", { name: "Dodaj ćwiczenie" }));
    await userEvent.type(screen.getByRole("searchbox", { name: "Szukaj ćwiczenia" }), "rower");
    await userEvent.click(screen.getByRole("button", { name: "Utwórz „Rower”" }));
    const form = screen.getByRole("dialog", { name: "Nowe ćwiczenie" });
    await userEvent.click(within(form).getByRole("radio", { name: /Dystans i czas/ }));
    await userEvent.click(within(form).getByRole("button", { name: "Utwórz ćwiczenie" }));
    expect(akcje.saveExercise).toHaveBeenCalledWith(expect.objectContaining({ name: "Rower", kind: "dist" }), SESJA);
  });

  it("ćwiczenie na czas ma jedną kolumnę i zapisuje sekundy", async () => {
    const d = daneTreningu();
    d.exercises = d.exercises.map((e) => (e.id === WYCISKANIE ? { ...e, kind: "dur" } : e));
    render(<GymView data={d} />);
    const pole = within(wiersz(1)).getByRole("textbox", { name: `${WYC}, seria 1 — czas` });
    await userEvent.type(pole, "1:30");
    await act(async () => pole.blur());
    expect(akcje.updateSet).toHaveBeenCalledWith("w1", { duration_s: 90 });
    expect(within(wiersz(1)).queryByRole("textbox", { name: /ciężar/ })).not.toBeInTheDocument();
  });
});

describe("zakończony trening", () => {
  const zakonczony = () => {
    const d = daneTreningu();
    d.session = { ...d.session, completed: true, end_local: "2026-11-19T15:54:00", difficulty: 7, note: "dobra energia" };
    d.sets = d.sets.filter((s) => s.done);
    d.templateItems = [
      { id: "i1", user_id: "u1", template_id: "t1", exercise_id: WYCISKANIE, position: 1, sets_count: 4, reps_text: "6", rest_s: 120 },
    ];
    return d;
  };

  it("podsumowanie: kafle, plan, porównanie i rekord", () => {
    render(<GymView data={zakonczony()} />);
    expect(screen.getByTestId("kafel-Czas")).toHaveTextContent("54 min");
    expect(screen.getByTestId("kafel-Objętość")).toHaveTextContent("1 202,5 kg");
    // Poprzedni „Push”: 70×6 + 70×5 = 770 → +56%
    expect(screen.getByText("↑ 56% vs poprzedni")).toBeInTheDocument();
    expect(screen.getByText("2 zgodnie z planem")).toBeInTheDocument();
    expect(screen.getByText("plan 4 × 6")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rekordy z tego treningu" })).toBeInTheDocument();
    expect(screen.getByText("+2,5 kg")).toBeInTheDocument();
  });

  it("„Powtórz trening” tworzy kopię i do niej przechodzi", async () => {
    render(<GymView data={zakonczony()} />);
    await userEvent.click(screen.getAllByRole("button", { name: "Powtórz trening" })[0]);
    expect(akcje.copyWorkout).toHaveBeenCalledWith(SESJA, undefined);
    expect(push).toHaveBeenCalledWith("/sport/trening/kopia");
  });

  it("„Edytuj” otwiera dziennik z „Gotowe”, bez licznika", async () => {
    render(<GymView data={zakonczony()} />);
    await userEvent.click(screen.getByRole("button", { name: "Edytuj" }));
    expect(screen.queryByRole("button", { name: /Rozpocznij/ })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Gotowe" }));
    expect(screen.getByText("✓ zakończony")).toBeInTheDocument();
  });
});
