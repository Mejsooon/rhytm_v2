import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, renameExercise, setExerciseBodyweight, toastError } =
  vi.hoisted(() => ({
    refresh: vi.fn(),
    renameExercise: vi.fn(),
    setExerciseBodyweight: vi.fn(),
    toastError: vi.fn(),
  }));
const router = { refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../actions", () => ({ renameExercise, setExerciseBodyweight }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { ExerciseDetail } from "../exercise-detail";
import type { ExerciseData, SessionSets } from "../load-sport";
import { seriaTreningu } from "../gym-test-data";
import { WYCISKANIE } from "../sport-test-data";

const sesja = (
  id: string,
  dzien: string,
  sets: SessionSets["sets"],
): SessionSets => ({
  sessionId: id,
  startLocal: `${dzien}T16:00:00`,
  title: "Push",
  completed: true,
  sets,
});

// Dziś = czw 19.11.2026. Okno 8 tyg. = po 24.09, poprzednie 8 tyg. = 31.07–24.09.
// A 10.09 60×10 (1RM 80,0) · B 15.10 70×5 (81,5, REKORD) · C 05.11 72,5×5 (84,5, REKORD) + 60×12
// · D 12.11 70×6 (84,0) + niezrobiona 80×5
function dane(zmiany: Partial<ExerciseData> = {}): ExerciseData {
  return {
    today: "2026-11-19",
    profile: {
      timezone: "Europe/Warsaw",
      weekStart: "mon",
      clock: "24",
      weightKg: 72,
      workoutsGoalOn: true,
      weeklyWorkoutsGoal: 3,
      kmGoalOn: true,
      weeklyKmGoal: 25,
    },
    exercise: {
      id: WYCISKANIE,
      user_id: "u1",
      name: "Wyciskanie na ławce",
      muscle_group: "Klatka",
      created_at: null,
      bodyweight: false,
      kind: null,
      equipment: null,
      note: null,
      rest_s: null,
    },
    history: [
      sesja("sa", "2026-09-10", [
        seriaTreningu("a1", "sa", WYCISKANIE, 1, 1, 60, 10, true),
      ]),
      sesja("sb", "2026-10-15", [
        seriaTreningu("b1", "sb", WYCISKANIE, 1, 1, 70, 5, true),
      ]),
      sesja("sc", "2026-11-05", [
        seriaTreningu("c1", "sc", WYCISKANIE, 1, 1, 72.5, 5, true),
        seriaTreningu("c2", "sc", WYCISKANIE, 1, 2, 60, 12, true),
      ]),
      sesja("sd", "2026-11-12", [
        seriaTreningu("d1", "sd", WYCISKANIE, 1, 1, 70, 6, true),
        seriaTreningu("d2", "sd", WYCISKANIE, 1, 2, 80, 5, false),
      ]),
    ],
    templateName: "Push",
    repsText: "5–8",
    next: null,
    ...zmiany,
  };
}

// Układ telefonu (CMExerciseDetail) jest w DOM obok webu; bierzemy go po nagłówku .m-head
const telefon = () =>
  screen.getAllByRole("banner").find((h) => h.classList.contains("m-head"))!
    .parentElement as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  renameExercise.mockResolvedValue({ ok: true });
  setExerciseBodyweight.mockResolvedValue({ ok: true });
});

describe("MExerciseDetail (telefon)", () => {
  it("nagłówek: wstecz do Sportu i nazwa ćwiczenia; web chowa się poniżej 800 px", () => {
    render(<ExerciseDetail data={dane()} />);
    const t = within(telefon());
    expect(t.getByRole("link", { name: "Wstecz" })).toHaveAttribute(
      "href",
      "/sport",
    );
    expect(
      t.getByRole("heading", { name: "Wyciskanie na ławce", level: 1 }),
    ).toBeInTheDocument();
    expect(telefon()).toHaveClass("min-[800px]:hidden");
    expect(
      screen.getByRole("navigation", { name: "Okruszki" }).closest("header"),
    ).toHaveClass("max-[799px]:hidden");
  });

  it("karta 1RM: najlepszy 1RM, zmiana z 8 tygodni i segment metryki", async () => {
    render(<ExerciseDetail data={dane()} />);
    const karta = within(
      within(telefon()).getByRole("region", { name: "Szacowany 1RM" }),
    );
    // 84,5 (C 05.11) = najlepszy; zmiana: 84,5 − 81,5 (B 15.10, okno wcześniejsze)? patrz web: tu liczymy jak web
    expect(karta.getByText("84,5 kg")).toBeInTheDocument();
    expect(karta.getByText(/· 8 tyg\.$/)).toBeInTheDocument();
    expect(
      karta.getByRole("img", {
        name: /Szacowany 1RM w ostatnich 8 tygodniach/,
      }),
    ).toBeInTheDocument();
    await userEvent.click(karta.getByRole("radio", { name: "Objętość" }));
    expect(
      karta.getByRole("img", { name: /Objętość w ostatnich 8 tygodniach/ }),
    ).toBeInTheDocument();
    // 8 słupków, etykiety pierwszego i ostatniego tygodnia
    expect(karta.getByRole("img").children).toHaveLength(8);
    expect(karta.getByText("tydz. 47")).toBeInTheDocument();
    expect(karta.getByText("tydz. 40")).toBeInTheDocument();
  });

  it("„Rekordy”: najcięższa seria, najwięcej powt., najlepsza seria z plakietką REKORD", () => {
    render(<ExerciseDetail data={dane()} />);
    const rekordy = within(
      within(telefon()).getByRole("region", { name: "Rekordy" }),
    );
    // Najcięższa seria i najlepsza seria (1RM) to ta sama: 72,5 kg × 5
    expect(rekordy.getAllByText("72,5 kg × 5")).toHaveLength(2);
    expect(rekordy.getByText("60 kg × 12")).toBeInTheDocument();
    expect(rekordy.getByText("REKORD")).toBeInTheDocument();
  });

  it("„Historia”: sesje od najnowszej z seriami i 1RM, opis szablonu", () => {
    render(<ExerciseDetail data={dane()} />);
    const historia = within(
      within(telefon()).getByRole("region", { name: "Historia" }),
    );
    expect(historia.getByText("w szablonie „Push”")).toBeInTheDocument();
    expect(historia.getByText("czw 12.11")).toBeInTheDocument();
    expect(historia.getByText("70×6")).toBeInTheDocument();
    expect(historia.getByText("72,5×5 · 60×12")).toBeInTheDocument();
    expect(historia.getAllByText(/ kg$/)).toHaveLength(4);
  });

  it("„Z masą ciała” i ołówek „Zmień nazwę” działają jak na webie", async () => {
    render(<ExerciseDetail data={dane()} />);
    const t = within(telefon());
    await userEvent.click(t.getByRole("switch", { name: "Z masą ciała" }));
    expect(setExerciseBodyweight).toHaveBeenCalledWith(WYCISKANIE, true);
    await userEvent.click(
      t.getByRole("button", { name: "Zmień nazwę ćwiczenia" }),
    );
    const okno = screen.getByRole("dialog", { name: "Zmień nazwę" });
    const pole = within(okno).getByLabelText("Nazwa ćwiczenia");
    await userEvent.clear(pole);
    await userEvent.type(pole, "Wyciskanie sztangi");
    await userEvent.click(within(okno).getByRole("button", { name: "Zapisz" }));
    expect(renameExercise).toHaveBeenCalledWith(
      WYCISKANIE,
      "Wyciskanie sztangi",
    );
  });

  it("bez treningów: puste wartości i brak wykresu", () => {
    render(<ExerciseDetail data={dane({ history: [] })} />);
    const t = within(telefon());
    expect(
      t.getByText("Brak zrobionych serii tego ćwiczenia."),
    ).toBeInTheDocument();
    expect(t.getByText("Brak danych w tym okresie.")).toBeInTheDocument();
    expect(t.queryByRole("img")).not.toBeInTheDocument();
  });
});
