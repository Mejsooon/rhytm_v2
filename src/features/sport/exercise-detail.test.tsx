import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, renameExercise } = vi.hoisted(() => ({
  refresh: vi.fn(),
  renameExercise: vi.fn(),
}));
const router = { refresh };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./actions", () => ({ renameExercise }));

import { ExerciseDetail } from "./exercise-detail";
import type { ExerciseData, SessionSets } from "./load-sport";
import { seriaTreningu } from "./gym-test-data";
import { WYCISKANIE } from "./sport-test-data";

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
    ...zmiany,
  };
}

const kafelek = (etykieta: string) =>
  screen.getAllByText(etykieta)[0].closest("div") as HTMLElement;

beforeEach(() => {
  vi.clearAllMocks();
  renameExercise.mockResolvedValue({ ok: true });
});

describe("ExerciseDetail", () => {
  it("ścieżka, nagłówek i podtytuł z liczbą treningów", () => {
    render(<ExerciseDetail data={dane()} />);
    expect(screen.getByRole("link", { name: "Sport" })).toHaveAttribute(
      "href",
      "/sport",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Wyciskanie na ławce" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("4 treningi · od 10.09.2026 · w szablonie „Push”"),
    ).toBeInTheDocument();
  });

  it("przyszły / niedokończony trening nie liczy się do historii, wykresu, kafelków ani REKORDU", () => {
    const d = dane();
    const punktyPrzed = (() => {
      const { unmount } = render(<ExerciseDetail data={d} />);
      const n = screen.getAllByTestId("punkt-wykresu").length;
      unmount();
      return n;
    })();
    render(
      <ExerciseDetail
        data={{
          ...d,
          history: [
            ...d.history,
            {
              ...sesja("sz", "2026-11-26", [
                seriaTreningu("z1", "sz", WYCISKANIE, 1, 1, 100, 5, true),
              ]),
              completed: false,
            },
          ],
        }}
      />,
    );
    expect(
      screen.getByText("4 treningi · od 10.09.2026 · w szablonie „Push”"),
    ).toBeInTheDocument();
    expect(kafelek("Szac. 1RM")).toHaveTextContent("84,5 kg");
    expect(kafelek("8 tygodni")).toHaveTextContent("+4,5 kg");
    expect(screen.getAllByTestId("punkt-wykresu")).toHaveLength(punktyPrzed);
    expect(screen.queryByText(/26\.11/)).not.toBeInTheDocument();
  });

  it("podtytuł bez szablonu nie ma fragmentu „w szablonie”", () => {
    render(<ExerciseDetail data={dane({ templateName: null })} />);
    expect(screen.getByText("4 treningi · od 10.09.2026")).toBeInTheDocument();
  });

  it("sesja tylko z masą ciała: „mc × n”, bez 1RM, punktu wykresu i REKORDU", () => {
    const d = dane({
      history: [
        sesja("sa", "2026-11-05", [
          seriaTreningu("a1", "sa", WYCISKANIE, 1, 1, 70, 5, true),
        ]),
        sesja("sb", "2026-11-12", [
          seriaTreningu("b1", "sb", WYCISKANIE, 1, 1, null, 12, true),
        ]),
      ],
    });
    render(<ExerciseDetail data={d} />);
    const wiersze = within(screen.getByRole("table")).getAllByRole("row");
    expect(wiersze[1]).toHaveTextContent("czw 12.11");
    expect(wiersze[1]).toHaveTextContent("mc × 12");
    expect(wiersze[1]).toHaveTextContent("—");
    expect(wiersze[1]).not.toHaveTextContent("REKORD");
    expect(screen.getAllByTestId("punkt-wykresu")).toHaveLength(1);
  });

  it("kafelki: szac. 1RM, najcięższa seria, najwięcej powt., zmiana 8 tyg.", () => {
    render(<ExerciseDetail data={dane()} />);
    expect(kafelek("Szac. 1RM")).toHaveTextContent("84,5 kg");
    expect(kafelek("Najcięższa seria")).toHaveTextContent("72,5 × 5");
    expect(kafelek("Najwięcej powt.")).toHaveTextContent("60 × 12");
    // 84,5 (ostatnie 8 tyg.) − 80 (8 tyg. wcześniej)
    expect(kafelek("8 tygodni")).toHaveTextContent("+4,5 kg");
  });

  it("kafelki bez danych pokazują „—”", () => {
    render(<ExerciseDetail data={dane({ history: [] })} />);
    for (const e of [
      "Szac. 1RM",
      "Najcięższa seria",
      "Najwięcej powt.",
      "8 tygodni",
    ]) {
      expect(kafelek(e)).toHaveTextContent("—");
    }
    expect(screen.getByText("Brak danych w tym okresie.")).toBeInTheDocument();
  });

  it("zmiana 8 tyg. to „—”, gdy poprzednie 8 tygodni jest puste", () => {
    const d = dane();
    render(<ExerciseDetail data={dane({ history: d.history.slice(1) })} />);
    expect(kafelek("8 tygodni")).toHaveTextContent("—");
  });

  it("spadek 1RM jest ze znakiem minus", () => {
    const d = dane({
      history: [
        sesja("sa", "2026-09-10", [
          seriaTreningu("a1", "sa", WYCISKANIE, 1, 1, 80, 5, true),
        ]),
        sesja("sb", "2026-11-12", [
          seriaTreningu("b1", "sb", WYCISKANIE, 1, 1, 70, 5, true),
        ]),
      ],
    });
    render(<ExerciseDetail data={d} />);
    // 81,5 − 93,5
    expect(kafelek("8 tygodni")).toHaveTextContent("−12 kg");
  });

  it("przełącznik 3 mies. / 8 tyg. zmienia punkty wykresu", async () => {
    const user = userEvent.setup();
    render(<ExerciseDetail data={dane()} />);
    expect(screen.getByRole("radio", { name: "8 tyg." })).toBeChecked();
    expect(screen.getAllByTestId("punkt-wykresu")).toHaveLength(3);

    await user.click(screen.getByRole("radio", { name: "3 mies." }));
    expect(screen.getAllByTestId("punkt-wykresu")).toHaveLength(4);

    await user.click(screen.getByRole("radio", { name: "8 tyg." }));
    expect(screen.getAllByTestId("punkt-wykresu")).toHaveLength(3);
  });

  it("historia malejąco z plakietką REKORD wg reguły (pierwsza sesja nie jest rekordem)", () => {
    render(<ExerciseDetail data={dane()} />);
    const wiersze = within(screen.getByRole("table")).getAllByRole("row");
    // nagłówek + 4 sesje, najnowsza na górze
    expect(wiersze).toHaveLength(5);
    expect(wiersze[1]).toHaveTextContent("czw 12.11");
    expect(wiersze[1]).toHaveTextContent("70 × 6");
    expect(wiersze[1]).toHaveTextContent("84,0 kg");
    expect(wiersze[1]).not.toHaveTextContent("REKORD");
    expect(wiersze[2]).toHaveTextContent("czw 05.11");
    expect(wiersze[2]).toHaveTextContent("72,5 × 5");
    expect(wiersze[2]).toHaveTextContent("REKORD");
    expect(wiersze[3]).toHaveTextContent("czw 15.10");
    expect(wiersze[3]).toHaveTextContent("REKORD");
    expect(wiersze[4]).toHaveTextContent("czw 10.09");
    expect(wiersze[4]).not.toHaveTextContent("REKORD");
  });

  it("„Zmień nazwę” zapisuje nową nazwę i odświeża stronę", async () => {
    const user = userEvent.setup();
    render(<ExerciseDetail data={dane()} />);
    await user.click(screen.getByRole("button", { name: "Zmień nazwę" }));
    const pole = screen.getByRole("textbox", { name: "Nazwa ćwiczenia" });
    expect(pole).toHaveValue("Wyciskanie na ławce");
    await user.clear(pole);
    await user.type(pole, "Wyciskanie sztangi");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(renameExercise).toHaveBeenCalledWith(
      WYCISKANIE,
      "Wyciskanie sztangi",
    );
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("„Zmień nazwę” pokazuje błąd duplikatu i zostawia okno otwarte", async () => {
    const user = userEvent.setup();
    renameExercise.mockResolvedValue({
      ok: false,
      message: "Masz już ćwiczenie o tej nazwie.",
    });
    render(<ExerciseDetail data={dane()} />);
    await user.click(screen.getByRole("button", { name: "Zmień nazwę" }));
    const pole = screen.getByRole("textbox", { name: "Nazwa ćwiczenia" });
    await user.clear(pole);
    await user.type(pole, "Przysiad");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(
      await screen.findByText("Masz już ćwiczenie o tej nazwie."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("wyjątek przy zapisie pokazuje komunikat o błędzie zapisu", async () => {
    const user = userEvent.setup();
    renameExercise.mockRejectedValue(new Error("sieć"));
    render(<ExerciseDetail data={dane()} />);
    await user.click(screen.getByRole("button", { name: "Zmień nazwę" }));
    await user.type(
      screen.getByRole("textbox", { name: "Nazwa ćwiczenia" }),
      "x",
    );
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(
      await screen.findByText("Nie udało się zapisać. Spróbuj ponownie."),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("Enter w trakcie zapisu nie wysyła drugiego żądania", async () => {
    const user = userEvent.setup();
    let koniec: (v: { ok: true }) => void = () => {};
    renameExercise.mockReturnValue(
      new Promise((r) => {
        koniec = r;
      }),
    );
    render(<ExerciseDetail data={dane()} />);
    await user.click(screen.getByRole("button", { name: "Zmień nazwę" }));
    const pole = screen.getByRole("textbox", { name: "Nazwa ćwiczenia" });
    await user.type(pole, "x{Enter}{Enter}");
    expect(renameExercise).toHaveBeenCalledTimes(1);
    koniec({ ok: true });
  });
});
