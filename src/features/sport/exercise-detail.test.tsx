import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { refresh, push, createGymSession, renameExercise, setExerciseBodyweight, toastError } =
  vi.hoisted(() => ({
    push: vi.fn(),
    createGymSession: vi.fn(),
    refresh: vi.fn(),
    renameExercise: vi.fn(),
    setExerciseBodyweight: vi.fn(),
    toastError: vi.fn(),
  }));
const router = { refresh, push };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("./actions", () => ({ createGymSession, renameExercise, setExerciseBodyweight }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
// Drzewo telefonu (w DOM obok webu) ma własne testy (mobile/m-exercise-detail.test.tsx); tu sprawdzamy web
vi.mock("./mobile/m-exercise-detail", () => ({ MExerciseDetail: () => null }));

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

const liczba = (k: string) => screen.getByTestId(`liczba-${k}`);
const sekcja = (nazwa: string) => screen.getByRole("region", { name: nazwa });
const wierszeHistorii = () => within(sekcja("Historia")).getAllByRole("button", { expanded: false });

beforeEach(() => {
  vi.clearAllMocks();
  renameExercise.mockResolvedValue({ ok: true });
  setExerciseBodyweight.mockResolvedValue({ ok: true });
});

describe("ExerciseDetail", () => {
  it("ścieżka, nagłówek i podtytuł z partią, liczbą treningów i szablonem", () => {
    render(<ExerciseDetail data={dane()} />);
    expect(screen.getByRole("link", { name: "Sport" })).toHaveAttribute("href", "/sport");
    expect(screen.getByRole("heading", { level: 1, name: "Wyciskanie na ławce" })).toBeInTheDocument();
    expect(screen.getByText("Klatka · Sztanga · 4 treningi od 10.09.2026 · w szablonie „Push”")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zmień nazwę" }).querySelector("svg")).not.toBeNull();
  });

  it("cztery liczby z zakresu 8 tygodni, „Wszystko” liczy od początku", async () => {
    render(<ExerciseDetail data={dane()} />);
    // 8 tyg.: B 81,5 → D 84,0
    expect(liczba("Szac. 1RM")).toHaveTextContent("84,0 kg+2,5 kg w 8 tyg.");
    expect(liczba("Treningi")).toHaveTextContent("3");
    expect(liczba("Serie robocze")).toHaveTextContent("4");
    await userEvent.click(screen.getByRole("radio", { name: "Wszystko" }));
    expect(liczba("Treningi")).toHaveTextContent("4od 10.09.2026");
    expect(liczba("Szac. 1RM")).toHaveTextContent("+4,0 kg od początku");
  });

  it("wykres: przełącznik miary i dymek po najechaniu", async () => {
    render(<ExerciseDetail data={dane()} />);
    expect(screen.getAllByTestId("punkt-wykresu")).toHaveLength(3);
    expect(screen.getByTestId("liczba-wykresu")).toHaveTextContent("84,0 kg");
    await userEvent.hover(screen.getByRole("button", { name: "czw 05.11.2026: 84,5 kg, najlepsza seria 72,5 × 5" }));
    expect(screen.getByRole("tooltip")).toHaveTextContent("czw 05.11.202684,5 kgnajlepsza seria 72,5 × 5");
    await userEvent.click(screen.getByRole("radio", { name: "Najcięższa seria" }));
    expect(screen.getByTestId("liczba-wykresu")).toHaveTextContent("70 kg");
    await userEvent.click(screen.getByRole("radio", { name: "Objętość" }));
    expect(screen.getByTestId("liczba-wykresu")).toHaveTextContent("420 kg");
  });

  it("jeden pomiar nie daje NaN, brak danych ma komunikat", () => {
    const { container, unmount } = render(<ExerciseDetail data={dane({ history: dane().history.slice(3) })} />);
    expect(container.innerHTML).not.toMatch(/NaN/);
    unmount();
    render(<ExerciseDetail data={dane({ history: [] })} />);
    expect(screen.getByText("Brak danych w tym okresie.")).toBeInTheDocument();
    expect(screen.getByText("Brak zrobionych serii tego ćwiczenia.")).toBeInTheDocument();
    expect(liczba("Szac. 1RM")).toHaveTextContent("—");
  });

  it("historia malejąco, rekordy zaznaczone, wiersz rozwija się do tabeli serii z linkiem", async () => {
    render(<ExerciseDetail data={dane()} />);
    const wiersze = wierszeHistorii();
    expect(wiersze).toHaveLength(4);
    expect(wiersze[0]).toHaveTextContent("czw 12.11");
    expect(wiersze[0]).not.toHaveTextContent("rekord");
    expect(wiersze[1]).toHaveTextContent("rekord");
    expect(wiersze[3]).toHaveTextContent("czw 10.09");
    await userEvent.click(wiersze[1]);
    const tabela = screen.getByRole("table");
    expect(within(tabela).getByText("72,5 kg")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Otwórz trening" })).toHaveAttribute("href", "/sport/trening/sc");
    await userEvent.click(wiersze[1]);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("więcej niż 5 treningów: „Pokaż wszystkie” i „Pokaż mniej”", async () => {
    const history = [1, 2, 3, 4, 5, 6].map((n) => sesja(`s${n}`, `2026-10-0${n}`, [seriaTreningu(`x${n}`, `s${n}`, WYCISKANIE, 1, 1, 60, 5, true)]));
    render(<ExerciseDetail data={dane({ history })} />);
    expect(wierszeHistorii().filter((w) => w.textContent?.includes("60 × 5"))).toHaveLength(5);
    await userEvent.click(screen.getByRole("button", { name: "Pokaż wszystkie (6)" }));
    expect(wierszeHistorii().filter((w) => w.textContent?.includes("60 × 5"))).toHaveLength(6);
    expect(screen.getByRole("button", { name: "Pokaż mniej" })).toBeInTheDocument();
  });

  it("rekordy z datami", () => {
    render(<ExerciseDetail data={dane()} />);
    const r = sekcja("Rekordy");
    expect(r).toHaveTextContent("Szacowany 1RM84,5 kg05.11.2026");
    expect(r).toHaveTextContent("Najcięższa seria72,5 × 505.11.2026");
    expect(r).toHaveTextContent("Najwięcej powtórzeń60 × 1205.11.2026");
  });

  it("następny trening: cel z zakresem i start wystąpienia szablonu", async () => {
    createGymSession.mockResolvedValue({ ok: true, id: "nowy" });
    const next = {
      date: "2026-11-26",
      startMin: 900,
      title: "Push",
      sessionId: null,
      templateId: "t1",
    } as ExerciseData["next"];
    render(<ExerciseDetail data={dane({ next })} />);
    // Ostatnio 70 × 6 w zakresie 5–8 → +1 powtórzenie
    expect(screen.getByTestId("cel")).toHaveTextContent("70 × 7ostatnio 70 × 6+1 powtórzenie");
    await userEvent.click(screen.getByRole("button", { name: "Rozpocznij trening" }));
    expect(createGymSession).toHaveBeenCalledWith({ date: "2026-11-26", start: "15:00", templateId: "t1" });
    expect(push).toHaveBeenCalledWith("/sport/trening/nowy");
  });

  it("bez zaplanowanego treningu nie ma karty", () => {
    render(<ExerciseDetail data={dane()} />);
    expect(screen.queryByRole("region", { name: "Następny trening" })).not.toBeInTheDocument();
  });

  it("ćwiczenie na czas: własne liczby, bez przełącznika masy ciała i celu", () => {
    const d = dane();
    const history = [sesja("sa", "2026-11-12", [{ ...seriaTreningu("a1", "sa", WYCISKANIE, 1, 1, null, null, true), duration_s: 75 }])];
    render(<ExerciseDetail data={{ ...d, history, exercise: { ...d.exercise, kind: "dur" } }} />);
    expect(liczba("Najdłuższa seria")).toHaveTextContent("01:15");
    expect(liczba("Łączny czas")).toHaveTextContent("01:15");
    expect(screen.queryByRole("switch")).not.toBeInTheDocument();
  });

  it("niedokończony trening nie liczy się nigdzie", () => {
    const d = dane();
    const history = [...d.history, { ...sesja("sz", "2026-11-19", [seriaTreningu("z1", "sz", WYCISKANIE, 1, 1, 100, 5, true)]), completed: false }];
    render(<ExerciseDetail data={{ ...d, history }} />);
    expect(wierszeHistorii().some((w) => w.textContent?.includes("19.11"))).toBe(false);
    expect(sekcja("Rekordy")).not.toHaveTextContent("100");
  });

  it("„Zmień nazwę” zapisuje nową nazwę i odświeża stronę", async () => {
    const user = userEvent.setup();
    render(<ExerciseDetail data={dane()} />);
    await user.click(screen.getByRole("button", { name: "Zmień nazwę" }));
    const pole = screen.getByRole("textbox", { name: "Nazwa ćwiczenia" });
    expect(pole).toHaveValue("Wyciskanie na ławce");
    // „Anuluj” bez ramki (ghost, .btng z makiet), na telefonie 44 px
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass(
      "border-transparent",
      "bg-transparent",
      "hover:bg-accent",
    );
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass(
      "max-[799px]:h-11",
    );
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

describe("ExerciseDetail — „Z masą ciała”", () => {
  // Pompki z masą ciała przy wadze 72: A mc×12 (1RM 101) · B mc + 5×10 (77 → 102,5, REKORD)
  const zMasaCiala = (weightKg: number | null = 72): ExerciseData => {
    const d = dane({
      history: [
        sesja("sa", "2026-11-05", [
          seriaTreningu("a1", "sa", WYCISKANIE, 1, 1, null, 12, true),
        ]),
        sesja("sb", "2026-11-12", [
          seriaTreningu("b1", "sb", WYCISKANIE, 1, 1, 5, 10, true),
        ]),
      ],
    });
    return {
      ...d,
      profile: { ...d.profile, weightKg },
      exercise: { ...d.exercise, bodyweight: true },
    };
  };

  it("przełącznik pokazuje flagę ćwiczenia", () => {
    render(<ExerciseDetail data={dane()} />);
    expect(
      screen.getByRole("switch", { name: "Z masą ciała" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("liczby i rekordy liczą wagę z profilu + dociążenie", () => {
    render(<ExerciseDetail data={zMasaCiala()} />);
    expect(screen.getByRole("switch", { name: "Z masą ciała" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("z masą ciała")).toBeInTheDocument();
    expect(sekcja("Rekordy")).toHaveTextContent("Szacowany 1RMnowy102,5 kg");
    expect(sekcja("Rekordy")).toHaveTextContent("mc + 5 × 10");
    expect(sekcja("Rekordy")).toHaveTextContent("mc × 12");
  });

  it("bez wagi w profilu nie ma 1RM", () => {
    render(<ExerciseDetail data={zMasaCiala(null)} />);
    expect(liczba("Szac. 1RM")).toHaveTextContent("—");
    expect(sekcja("Rekordy")).not.toHaveTextContent("Szacowany 1RM");
  });

  it("włączenie zmienia się od razu i zapisuje flagę", async () => {
    render(<ExerciseDetail data={dane()} />);
    const sw = screen.getByRole("switch", { name: "Z masą ciała" });
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(setExerciseBodyweight).toHaveBeenCalledWith(WYCISKANIE, true);
    expect(refresh).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("błąd zapisu cofa przełącznik i pokazuje toast", async () => {
    setExerciseBodyweight.mockResolvedValue({
      ok: false,
      message: "Nie znaleziono ćwiczenia.",
    });
    render(<ExerciseDetail data={dane()} />);
    const sw = screen.getByRole("switch", { name: "Z masą ciała" });
    await userEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(toastError).toHaveBeenCalledWith(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
  });

  it("wyjątek akcji też cofa przełącznik", async () => {
    setExerciseBodyweight.mockRejectedValue(new Error("sieć"));
    render(<ExerciseDetail data={zMasaCiala()} />);
    const sw = screen.getByRole("switch", { name: "Z masą ciała" });
    await userEvent.click(sw);
    expect(setExerciseBodyweight).toHaveBeenCalledWith(WYCISKANIE, false);
    expect(sw).toHaveAttribute("aria-checked", "true");
    expect(toastError).toHaveBeenCalled();
  });

  it("drugie kliknięcie w trakcie zapisu jest ignorowane, a klik w napis też przełącza", async () => {
    let zakoncz: (v: { ok: true }) => void = () => {};
    setExerciseBodyweight.mockImplementationOnce(
      () => new Promise((r) => (zakoncz = r)),
    );
    render(<ExerciseDetail data={dane()} />);
    const sw = screen.getByRole("switch", { name: "Z masą ciała" });
    await userEvent.click(sw);
    await userEvent.click(sw);
    expect(setExerciseBodyweight).toHaveBeenCalledTimes(1);
    expect(sw).toHaveAttribute("aria-checked", "true");
    zakoncz({ ok: true });
    await screen.findByRole("switch", { name: "Z masą ciała" });
    setExerciseBodyweight.mockResolvedValue({ ok: true });
    await userEvent.click(screen.getByText("Z masą ciała"));
    expect(setExerciseBodyweight).toHaveBeenLastCalledWith(WYCISKANIE, false);
  });
});
