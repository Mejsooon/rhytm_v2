import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  toastError,
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
  toast: { error: toastError, success: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("../actions", () => ({
  updateSet,
  addSet,
  deleteSet,
  removeExercise,
  addExercise,
  finishWorkout,
  saveSessionAsTemplate,
}));

import { GymLog } from "../gym-log";
import { daneTreningu, daneZMasaCiala, SESJA } from "../gym-test-data";

const WYC = "Wyciskanie na ławce";
// Oba drzewa są w DOM (przełącza je CSS); tu sprawdzamy telefon
const telefon = () => screen.getByTestId("m-gym");
const karta = (nazwa: string) =>
  within(telefon()).getByRole("region", { name: nazwa });

beforeEach(() => {
  vi.clearAllMocks();
  updateSet.mockResolvedValue({ ok: true });
  addSet.mockResolvedValue({ ok: true, id: "w5" });
  addExercise.mockResolvedValue({ ok: true, id: "nowe-cw" });
  removeExercise.mockResolvedValue({ ok: true });
  saveSessionAsTemplate.mockResolvedValue({ ok: true, id: "t2" });
  finishWorkout.mockResolvedValue({ ok: true });
});
afterEach(() => {
  vi.useRealTimers();
});

describe("MGym", () => {
  it("oba układy w DOM, przełączane klasami 800 px", () => {
    render(<GymLog data={daneTreningu()} />);
    expect(telefon().className).toContain("min-[800px]:hidden");
    expect(screen.getByTestId("web-gym").className).toContain(
      "max-[799px]:hidden",
    );
  });

  it("nagłówek: Wstecz, nazwa, „x/y serii”, Zakończ i pasek postępu", () => {
    render(<GymLog data={daneTreningu()} />);
    expect(
      within(telefon()).getByRole("link", { name: "Wstecz" }),
    ).toHaveAttribute("href", "/sport?miesiac=2026-11");
    expect(
      within(telefon()).getByRole("heading", { name: "Push" }),
    ).toBeInTheDocument();
    expect(within(telefon()).getByTestId("m-serie")).toHaveTextContent(
      "3/6 serii",
    );
    expect(
      within(telefon()).getByRole("progressbar", { name: "Postęp serii" })
        .firstElementChild,
    ).toHaveStyle({
      width: "50%",
    });
    expect(
      within(telefon()).getByRole("button", { name: "Zakończ" }),
    ).toBeInTheDocument();
  });

  it("bez minutnika przerwy", () => {
    render(<GymLog data={daneTreningu()} />);
    expect(within(telefon()).queryByText(/przerw/i)).not.toBeInTheDocument();
    expect(within(telefon()).queryByText(/minutnik/i)).not.toBeInTheDocument();
  });

  it("karta ćwiczenia: nagłówek tabeli, „ost.” z poprzedniej sesji, serie z polami", () => {
    render(<GymLog data={daneTreningu()} />);
    const wyc = karta(WYC);
    expect(within(wyc).getByText("ost. 2×6 · 70 kg")).toBeInTheDocument();
    expect(within(wyc).getByText("Seria")).toBeInTheDocument();
    expect(
      within(wyc).getByRole("textbox", { name: `${WYC}, seria 3 — ciężar` }),
    ).toHaveValue("72,5");
    expect(
      within(wyc).getByRole("textbox", {
        name: `${WYC}, seria 3 — powtórzenia`,
      }),
    ).toHaveValue("5");
    // Pompki bez wcześniejszej sesji: bez „ost.”; masa ciała = puste pole z „mc”
    const pompki = karta("Pompki na poręczach");
    expect(within(pompki).queryByText(/^ost\./)).not.toBeInTheDocument();
    const kg = within(pompki).getByRole("textbox", {
      name: "Pompki na poręczach, seria 1 — ciężar",
    });
    expect(kg).toHaveValue("");
    expect(kg).toHaveAttribute("placeholder", "mc");
  });

  it("duży checkbox odhacza serię od razu (wspólny store z webem)", async () => {
    let zakoncz!: (v: { ok: true }) => void;
    updateSet.mockReturnValue(new Promise((r) => (zakoncz = r)));
    render(<GymLog data={daneTreningu()} />);
    const pole = within(karta(WYC)).getByRole("checkbox", {
      name: `${WYC}, seria 4`,
    });
    expect(pole).toHaveAttribute("aria-checked", "false");
    await userEvent.click(pole);
    expect(pole).toHaveAttribute("aria-checked", "true");
    expect(within(telefon()).getByTestId("m-serie")).toHaveTextContent(
      "4/6 serii",
    );
    expect(screen.getByTestId("serie")).toHaveTextContent("4 / 6");
    expect(updateSet).toHaveBeenCalledWith("w4", { done: true });
    await act(async () => zakoncz({ ok: true }));
  });

  it("błąd zapisu cofa ✓ i pokazuje toast", async () => {
    updateSet.mockResolvedValue({ ok: false, message: "x" });
    render(<GymLog data={daneTreningu()} />);
    const pole = within(karta(WYC)).getByRole("checkbox", {
      name: `${WYC}, seria 4`,
    });
    await userEvent.click(pole);
    expect(pole).toHaveAttribute("aria-checked", "false");
    expect(toastError).toHaveBeenCalledWith(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
  });

  it("zmiana kg zapisuje się po wyjściu z pola", async () => {
    render(<GymLog data={daneTreningu()} />);
    const kg = within(karta("Pompki na poręczach")).getByRole("textbox", {
      name: "Pompki na poręczach, seria 1 — ciężar",
    });
    await userEvent.type(kg, "10");
    await userEvent.tab();
    expect(updateSet).toHaveBeenCalledWith("p1", { weight_kg: 10 });
  });

  it("„+ Dodaj serię” dodaje serię od razu", async () => {
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      within(karta(WYC)).getByRole("button", { name: "+ Dodaj serię" }),
    );
    expect(addSet).toHaveBeenCalledWith(SESJA, expect.any(String));
    expect(within(telefon()).getByTestId("m-serie")).toHaveTextContent(
      "3/7 serii",
    );
  });

  it("„Dodaj ćwiczenie” otwiera wyszukiwanie i dodaje ćwiczenie", async () => {
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      within(telefon()).getByRole("button", { name: "Dodaj ćwiczenie" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Szukaj ćwiczenia" }),
      "Martwy ciąg{Enter}",
    );
    expect(addExercise).toHaveBeenCalledWith(SESJA, "Martwy ciąg");
    expect(karta("Martwy ciąg")).toBeInTheDocument();
  });

  it("nazwa ćwiczenia prowadzi do jego szczegółów", () => {
    render(<GymLog data={daneTreningu()} />);
    expect(within(karta(WYC)).getByRole("link", { name: WYC })).toHaveAttribute(
      "href",
      expect.stringMatching(/^\/sport\/cwiczenia\/./),
    );
  });

  it("„Usuń ćwiczenie” usuwa ćwiczenie z treningu", async () => {
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      within(karta(WYC)).getByRole("button", {
        name: `Usuń ćwiczenie ${WYC}`,
      }),
    );
    expect(removeExercise).toHaveBeenCalledTimes(1);
    expect(removeExercise.mock.calls[0][0]).toBe(SESJA);
  });

  it("„Zapisz jako szablon” otwiera okno nazwy i zapisuje szablon", async () => {
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      within(telefon()).getByRole("button", { name: "Zapisz jako szablon" }),
    );
    const okno = screen.getByRole("dialog", { name: "Zapisz jako szablon" });
    await userEvent.click(within(okno).getByRole("button", { name: "Zapisz" }));
    expect(saveSessionAsTemplate).toHaveBeenCalledWith(SESJA, "Push");
  });

  it("dopisek „mc = masa ciała” tylko przy ćwiczeniu z masą ciała", () => {
    const { unmount } = render(<GymLog data={daneTreningu()} />);
    expect(within(telefon()).queryByText(/^mc = masa ciała/)).toBeNull();
    unmount();
    render(<GymLog data={daneZMasaCiala()} />);
    expect(
      within(telefon()).getByText(/^mc = masa ciała .* kg z profilu/),
    ).toBeInTheDocument();
  });

  it("„Zakończ” kończy trening i wraca do Sportu", async () => {
    render(<GymLog data={daneTreningu()} />);
    await userEvent.click(
      within(telefon()).getByRole("button", { name: "Zakończ" }),
    );
    expect(finishWorkout).toHaveBeenCalledWith(SESJA);
    expect(push).toHaveBeenCalledWith("/sport?miesiac=2026-11");
  });

  it("czas trwa od startu dzisiejszego treningu i tyka co sekundę", async () => {
    vi.useFakeTimers();
    // 14:32:10 UTC = 15:32:10 w Warszawie; start 15:00
    vi.setSystemTime(new Date("2026-11-19T14:32:10Z"));
    render(<GymLog data={daneTreningu()} />);
    expect(within(telefon()).getByTestId("m-serie")).toHaveTextContent(
      "3/6 serii · 32:10",
    );
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(within(telefon()).getByTestId("m-serie")).toHaveTextContent(
      "3/6 serii · 32:11",
    );
  });

  it("trening przed startem albo z innego dnia: bez czasu", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-19T10:00:00Z"));
    render(<GymLog data={daneTreningu()} />);
    expect(within(telefon()).getByTestId("m-serie")).toHaveTextContent(
      /^3\/6 serii$/,
    );
  });

  it("zakończony: czas od startu do końca", () => {
    const d = daneTreningu();
    d.session = {
      ...d.session,
      completed: true,
      end_local: "2026-11-19T16:02:00",
    };
    render(<GymLog data={d} />);
    expect(within(telefon()).getByTestId("m-serie")).toHaveTextContent(
      "3/6 serii · 1:02:00",
    );
  });
});

describe("MGym — ćwiczenie z masą ciała", () => {
  const POMPKI_NAZWA = "Pompki na poręczach";

  it("kolumna kg: „mc” albo „mc + 5”, pole dociążenia ≥ 44 px", () => {
    render(<GymLog data={daneZMasaCiala()} />);
    const k = karta(POMPKI_NAZWA);
    const s1 = within(k).getByRole("textbox", {
      name: `${POMPKI_NAZWA}, seria 1 — dociążenie (kg)`,
    });
    const s2 = within(k).getByRole("textbox", {
      name: `${POMPKI_NAZWA}, seria 2 — dociążenie (kg)`,
    });
    expect(s1).toHaveValue("");
    expect(s1).toHaveAttribute("placeholder", "+ kg");
    expect(s1).toHaveClass("h-11");
    expect(s1.parentElement).toHaveTextContent("mc");
    expect(s2).toHaveValue("5");
    expect(s2.parentElement?.textContent).toBe("mc + ");
  });

  it("wpisane dociążenie zapisuje się po wyjściu z pola", async () => {
    render(<GymLog data={daneZMasaCiala()} />);
    const pole = within(karta(POMPKI_NAZWA)).getByRole("textbox", {
      name: `${POMPKI_NAZWA}, seria 1 — dociążenie (kg)`,
    });
    await userEvent.type(pole, "2,5");
    expect(pole.parentElement).toHaveTextContent("mc +");
    await userEvent.tab();
    expect(updateSet).toHaveBeenCalledWith("p1", { weight_kg: 2.5 });
  });
});
