import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  toastError,
  toastSuccess,
  push,
  updateSet,
  addSet,
  deleteSet,
  removeExercise,
  addExercise,
  finishWorkout,
  saveSessionAsTemplate,
} = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  push: vi.fn(),
  updateSet: vi.fn(),
  addSet: vi.fn(),
  deleteSet: vi.fn(),
  removeExercise: vi.fn(),
  addExercise: vi.fn(),
  finishWorkout: vi.fn(),
  saveSessionAsTemplate: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: toastSuccess },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./actions", () => ({
  updateSet,
  addSet,
  deleteSet,
  removeExercise,
  addExercise,
  finishWorkout,
  saveSessionAsTemplate,
}));

import { GymLog } from "./gym-log";
import { daneTreningu, SESJA } from "./gym-test-data";
import { WYCISKANIE } from "./sport-test-data";

const WYC = "Wyciskanie na ławce";

function karta(nazwa: string) {
  return screen.getByRole("region", { name: nazwa });
}
const objetosc = () => screen.getByTestId("objetosc");
const licznik = () => screen.getByTestId("serie");

beforeEach(() => {
  vi.clearAllMocks();
  updateSet.mockResolvedValue({ ok: true });
  addSet.mockResolvedValue({ ok: true, id: "w5" });
  deleteSet.mockResolvedValue({ ok: true });
  removeExercise.mockResolvedValue({ ok: true });
  addExercise.mockResolvedValue({ ok: true, id: "nowe-cw" });
  finishWorkout.mockResolvedValue({ ok: true });
  saveSessionAsTemplate.mockResolvedValue({ ok: true, id: "t2" });
});

describe("GymLog — nagłówek i liczniki", () => {
  it("ścieżka, tytuł, data z godzinami i szablonem, objętość i serie", () => {
    render(<GymLog data={daneTreningu()} />);
    expect(screen.getByText("Push · czw 19.11")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Push" })).toBeInTheDocument();
    expect(
      screen.getByText("czw 19.11.2026 · 15:00–16:30 · z szablonu „Push”"),
    ).toBeInTheDocument();
    // 70×6 + 70×6 + 72,5×5 = 1202,5
    expect(objetosc()).toHaveTextContent("1 202,5 kg");
    expect(licznik()).toHaveTextContent("3 / 6");
  });

  it("bez szablonu nie ma dopisku, koniec z end_local", () => {
    const d = daneTreningu({ templateName: null });
    d.session = {
      ...d.session,
      template_id: null,
      end_local: "2026-11-19T16:15:00",
    };
    render(<GymLog data={d} />);
    expect(
      screen.getByText("czw 19.11.2026 · 15:00–16:15"),
    ).toBeInTheDocument();
  });

  it("nazwa ćwiczenia jest linkiem do szczegółów ćwiczenia", () => {
    render(<GymLog data={daneTreningu()} />);
    expect(screen.getByRole("link", { name: WYC })).toHaveAttribute(
      "href",
      `/sport/cwiczenia/${WYCISKANIE}`,
    );
  });
});

describe("GymLog — serie", () => {
  it("edycja kg i powtórzeń zmienia objętość na żywo, zapis po wyjściu z pola", async () => {
    render(<GymLog data={daneTreningu()} />);
    const kg = screen.getByLabelText(`${WYC}, seria 1 — ciężar`);
    await userEvent.clear(kg);
    await userEvent.type(kg, "80");
    // 80×6 + 70×6 + 72,5×5 = 1262,5 — jeszcze przed zapisem
    expect(objetosc()).toHaveTextContent("1 262,5 kg");
    expect(updateSet).not.toHaveBeenCalled();
    await userEvent.tab();
    expect(updateSet).toHaveBeenCalledWith("w1", { weight_kg: 80 });

    const powt = screen.getByLabelText(`${WYC}, seria 2 — powtórzenia`);
    await userEvent.clear(powt);
    await userEvent.type(powt, "8{Enter}");
    // 80×6 + 70×8 + 72,5×5 = 1402,5
    expect(objetosc()).toHaveTextContent("1 402,5 kg");
    expect(updateSet).toHaveBeenLastCalledWith("w2", { reps: 8 });
  });

  it("polski przecinek w kg i puste kg (masa ciała)", async () => {
    render(<GymLog data={daneTreningu()} />);
    const kg = screen.getByLabelText(`${WYC}, seria 4 — ciężar`);
    await userEvent.clear(kg);
    await userEvent.type(kg, "75,5");
    await userEvent.tab();
    expect(updateSet).toHaveBeenCalledWith("w4", { weight_kg: 75.5 });
    expect(kg).toHaveValue("75,5");

    await userEvent.clear(kg);
    await userEvent.tab();
    expect(updateSet).toHaveBeenLastCalledWith("w4", { weight_kg: null });
  });

  it("zły zapis wraca do poprzedniej wartości bez zapisu", async () => {
    render(<GymLog data={daneTreningu()} />);
    const kg = screen.getByLabelText(`${WYC}, seria 1 — ciężar`);
    await userEvent.clear(kg);
    await userEvent.type(kg, "abc");
    await userEvent.tab();
    expect(updateSet).not.toHaveBeenCalled();
    expect(kg).toHaveValue("70");
  });

  it("✓ zmienia „zrobione / wszystkie” i objętość", async () => {
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      screen.getByRole("checkbox", { name: `${WYC}, seria 4 zrobiona` }),
    );
    expect(licznik()).toHaveTextContent("4 / 6");
    // + 72,5×4 = 290
    expect(objetosc()).toHaveTextContent("1 492,5 kg");
    expect(updateSet).toHaveBeenCalledWith("w4", { done: true });

    await userEvent.click(
      screen.getByRole("checkbox", { name: `${WYC}, seria 1 zrobiona` }),
    );
    expect(licznik()).toHaveTextContent("3 / 6");
    expect(updateSet).toHaveBeenLastCalledWith("w1", { done: false });
  });

  it("„+ Seria” kopiuje poprzednią", async () => {
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      within(karta(WYC)).getByRole("button", { name: "+ Seria" }),
    );
    expect(addSet).toHaveBeenCalledWith(SESJA, WYCISKANIE);
    expect(screen.getByLabelText(`${WYC}, seria 5 — ciężar`)).toHaveValue(
      "72,5",
    );
    expect(screen.getByLabelText(`${WYC}, seria 5 — powtórzenia`)).toHaveValue(
      "4",
    );
    expect(
      screen.getByRole("checkbox", { name: `${WYC}, seria 5 zrobiona` }),
    ).not.toBeChecked();
    expect(licznik()).toHaveTextContent("3 / 7");
  });

  it("✕ usuwa serię", async () => {
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      screen.getByRole("button", { name: `Usuń ${WYC}, seria 1` }),
    );
    expect(deleteSet).toHaveBeenCalledWith("w1");
    expect(licznik()).toHaveTextContent("2 / 5");
    expect(objetosc()).toHaveTextContent("782,5 kg");
    // Numeracja serii idzie od nowa
    expect(screen.queryByLabelText(`${WYC}, seria 4 — ciężar`)).toBeNull();
  });

  it("„Usuń ćwiczenie”", async () => {
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      within(karta(WYC)).getByRole("button", { name: "Usuń ćwiczenie" }),
    );
    expect(removeExercise).toHaveBeenCalledWith(SESJA, WYCISKANIE);
    expect(screen.queryByRole("region", { name: WYC })).toBeNull();
    expect(licznik()).toHaveTextContent("0 / 2");
    expect(objetosc()).toHaveTextContent("0 kg");
  });

  it("błąd zapisu cofa zmianę i pokazuje toast", async () => {
    updateSet.mockResolvedValue({ ok: false, message: "x" });
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      screen.getByRole("checkbox", { name: `${WYC}, seria 4 zrobiona` }),
    );
    expect(licznik()).toHaveTextContent("3 / 6");
    expect(toastError).toHaveBeenCalledWith(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
  });

  it("błąd usunięcia ćwiczenia przywraca kartę", async () => {
    removeExercise.mockRejectedValue(new Error("sieć"));
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      within(karta(WYC)).getByRole("button", { name: "Usuń ćwiczenie" }),
    );
    expect(karta(WYC)).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
  });
});

describe("GymLog — 1RM i REKORD", () => {
  it("„1RM … · +2,5 kg vs ostatnio”, bez dopisku przy braku poprzedniej sesji", () => {
    render(<GymLog data={daneTreningu()} />);
    // Epley 72,5 × 5 → 84,5
    expect(
      within(karta(WYC)).getByText("1RM 84,5 kg · +2,5 kg vs ostatnio"),
    ).toBeInTheDocument();
    expect(
      within(karta("Pompki na poręczach")).getByText("1RM —"),
    ).toBeInTheDocument();
  });

  it("REKORD przy cięższej serii niż historia, przechodzi na nową najcięższą", async () => {
    render(<GymLog data={daneTreningu()} />);
    const wiersz = (n: number) => screen.getByTestId(`seria-${WYC}-${n}`);
    expect(within(wiersz(3)).getByText("REKORD")).toBeInTheDocument();
    expect(within(karta(WYC)).getAllByText("REKORD")).toHaveLength(1);

    const kg = screen.getByLabelText(`${WYC}, seria 4 — ciężar`);
    await userEvent.clear(kg);
    await userEvent.type(kg, "75");
    await userEvent.tab();
    await userEvent.click(
      screen.getByRole("checkbox", { name: `${WYC}, seria 4 zrobiona` }),
    );
    expect(within(wiersz(4)).getByText("REKORD")).toBeInTheDocument();
    expect(within(karta(WYC)).getAllByText("REKORD")).toHaveLength(1);
    expect(
      within(karta(WYC)).getByText("1RM 85 kg · +5 kg vs ostatnio"),
    ).toBeInTheDocument();
  });

  it("seria nie cięższa niż historia nie ma plakietki", () => {
    const d = daneTreningu();
    d.history[0].sets[0] = { ...d.history[0].sets[0], weight_kg: 80 };
    render(<GymLog data={d} />);
    expect(within(karta(WYC)).queryByText("REKORD")).toBeNull();
    expect(
      within(karta(WYC)).getByText("1RM 84,5 kg · −7,5 kg vs ostatnio"),
    ).toBeInTheDocument();
  });
});

describe("GymLog — picker ćwiczeń", () => {
  async function otworz() {
    await userEvent.click(screen.getByRole("button", { name: "+ Ćwiczenie" }));
    return screen.getByRole("dialog", { name: "Dodaj ćwiczenie" });
  }

  it("lista bez dodanych ćwiczeń, wyszukiwanie filtruje", async () => {
    render(<GymLog data={daneTreningu()} />);
    const okno = await otworz();
    expect(
      within(okno).queryByRole("button", { name: /Wyciskanie na ławce/ }),
    ).toBeNull();
    expect(
      within(okno).queryByRole("button", { name: /Pompki na poręczach/ }),
    ).toBeNull();
    expect(
      within(okno).getByRole("button", { name: /Martwy ciąg/ }),
    ).toBeInTheDocument();

    await userEvent.type(
      within(okno).getByLabelText("Szukaj ćwiczenia"),
      "triceps",
    );
    expect(
      within(okno).getByRole("button", { name: /Wyciskanie wąsko/ }),
    ).toBeInTheDocument();
    expect(
      within(okno).queryByRole("button", { name: /Martwy ciąg/ }),
    ).toBeNull();
    // Dokładnej nazwy nie ma, więc jest „+ Dodaj „…””
    expect(
      within(okno).getByRole("button", { name: /\+ Dodaj „triceps”/ }),
    ).toBeInTheDocument();
  });

  it("dokładna nazwa z biblioteki nie pokazuje „+ Dodaj”", async () => {
    render(<GymLog data={daneTreningu()} />);
    const okno = await otworz();
    await userEvent.type(
      within(okno).getByLabelText("Szukaj ćwiczenia"),
      "martwy ciąg",
    );
    expect(within(okno).queryByRole("button", { name: /\+ Dodaj/ })).toBeNull();
  });

  it("klik w pozycję dodaje ćwiczenie z 3 seriami i zamyka dymek", async () => {
    let zakoncz!: (v: { ok: true; id: string }) => void;
    addExercise.mockReturnValue(new Promise((r) => (zakoncz = r)));
    render(<GymLog data={daneTreningu()} />);
    const okno = await otworz();
    await userEvent.click(
      within(okno).getByRole("button", { name: /Martwy ciąg/ }),
    );
    expect(addExercise).toHaveBeenCalledWith(SESJA, "Martwy ciąg");
    expect(
      screen.queryByRole("dialog", { name: "Dodaj ćwiczenie" }),
    ).toBeNull();
    const nowa = karta("Martwy ciąg");
    expect(within(nowa).getAllByLabelText(/— ciężar$/)).toHaveLength(3);
    expect(licznik()).toHaveTextContent("3 / 9");
    await act(async () => zakoncz({ ok: true, id: "nowe-cw" }));
    expect(karta("Martwy ciąg")).toBeInTheDocument();
  });

  it("Enter wybiera pierwszy wynik", async () => {
    render(<GymLog data={daneTreningu()} />);
    const okno = await otworz();
    await userEvent.type(
      within(okno).getByLabelText("Szukaj ćwiczenia"),
      "podci{Enter}",
    );
    expect(addExercise).toHaveBeenCalledWith(SESJA, "Podciąganie");
  });

  it("Enter bez trafienia dodaje własne ćwiczenie, „+ Dodaj” też", async () => {
    render(<GymLog data={daneTreningu()} />);
    let okno = await otworz();
    await userEvent.type(
      within(okno).getByLabelText("Szukaj ćwiczenia"),
      "Wiosłowanie hantlem jednorącz{Enter}",
    );
    expect(addExercise).toHaveBeenLastCalledWith(
      SESJA,
      "Wiosłowanie hantlem jednorącz",
    );

    okno = await otworz();
    await userEvent.type(
      within(okno).getByLabelText("Szukaj ćwiczenia"),
      "Bułgarskie",
    );
    await userEvent.click(
      within(okno).getByRole("button", { name: /\+ Dodaj „Bułgarskie”/ }),
    );
    expect(addExercise).toHaveBeenLastCalledWith(SESJA, "Bułgarskie");
  });

  it("Esc zamyka dymek", async () => {
    render(<GymLog data={daneTreningu()} />);
    await otworz();
    await userEvent.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Dodaj ćwiczenie" }),
    ).toBeNull();
  });

  it("błąd dodania usuwa ćwiczenie i pokazuje toast", async () => {
    addExercise.mockResolvedValue({ ok: false, message: "x" });
    render(<GymLog data={daneTreningu()} />);
    const okno = await otworz();
    await userEvent.click(
      within(okno).getByRole("button", { name: /Martwy ciąg/ }),
    );
    expect(screen.queryByRole("region", { name: "Martwy ciąg" })).toBeNull();
    expect(toastError).toHaveBeenCalledWith(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
  });
});

describe("GymLog — zakończenie i szablon", () => {
  it("„Zakończ trening” → akcja i /sport z miesiącem treningu", async () => {
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Zakończ trening" }),
    );
    expect(finishWorkout).toHaveBeenCalledWith(SESJA);
    expect(push).toHaveBeenCalledWith("/sport?miesiac=2026-11");
  });

  it("błąd zakończenia zostaje na ekranie z toastem", async () => {
    finishWorkout.mockResolvedValue({
      ok: false,
      message: "Nie znaleziono treningu.",
    });
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Zakończ trening" }),
    );
    expect(push).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalledWith("Nie znaleziono treningu.");
  });

  it("„Zapisz jako szablon” pyta o nazwę (domyślnie tytuł) i zapisuje", async () => {
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Zapisz jako szablon" }),
    );
    const okno = screen.getByRole("dialog", { name: "Zapisz jako szablon" });
    const nazwa = within(okno).getByLabelText("Nazwa szablonu");
    expect(nazwa).toHaveValue("Push");
    await userEvent.clear(nazwa);
    await userEvent.type(nazwa, "Push B");
    await userEvent.click(within(okno).getByRole("button", { name: "Zapisz" }));
    expect(saveSessionAsTemplate).toHaveBeenCalledWith(SESJA, "Push B");
    expect(
      screen.queryByRole("dialog", { name: "Zapisz jako szablon" }),
    ).toBeNull();
    expect(toastSuccess).toHaveBeenCalledWith("Zapisano szablon „Push B”.");
  });

  it("błąd zapisu szablonu zostaje w oknie", async () => {
    saveSessionAsTemplate.mockResolvedValue({
      ok: false,
      message: "Dodaj przynajmniej jedno ćwiczenie.",
    });
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Zapisz jako szablon" }),
    );
    const okno = screen.getByRole("dialog", { name: "Zapisz jako szablon" });
    await userEvent.click(within(okno).getByRole("button", { name: "Zapisz" }));
    expect(
      within(okno).getByText("Dodaj przynajmniej jedno ćwiczenie."),
    ).toBeInTheDocument();
  });
});
