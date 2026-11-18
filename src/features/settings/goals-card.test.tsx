import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveGoals } = vi.hoisted(() => ({ saveGoals: vi.fn() }));
vi.mock("./actions", () => ({ saveGoals }));

import { GoalsCard } from "./goals-card";

const zapisane = {
  sleep: 480,
  trOn: true,
  kmOn: false,
  tr: "3",
  km: "25",
  cur: "PLN" as const,
  week: "mon" as const,
};

function zapisz() {
  return screen.getByRole("button", { name: "Zapisz" });
}

describe("GoalsCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    saveGoals.mockResolvedValue({ ok: true });
  });

  it("pokazuje opis, cel snu 8:00 i stopkę o walucie", () => {
    render(<GoalsCard saved={zapisane} />);
    expect(
      screen.getByText("Pokazywane na ekranie Dziś, w Sporcie i przy śnie."),
    ).toBeInTheDocument();
    expect(screen.getByText("8:00")).toBeInTheDocument();
    expect(
      screen.getByText("Waluta dotyczy pól „Kwota cykliczna”."),
    ).toBeInTheDocument();
    expect(zapisz()).toBeDisabled();
  });

  it("„Cele treningowe”: dwa pola wyboru, włączony ma pole liczby, wyłączony „wył.”", () => {
    render(<GoalsCard saved={zapisane} />);
    expect(screen.getByText("Cele treningowe")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Treningi w tygodniu" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("checkbox", { name: "Kilometry biegu w tygodniu" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("textbox", { name: "Treningi w tygodniu" }),
    ).toHaveValue("3");
    expect(
      screen.queryByRole("textbox", { name: "Kilometry biegu w tygodniu" }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("wył.")).toBeInTheDocument();
  });

  it("włączenie km pokazuje pole z zapisaną liczbą; oba cele naraz da się zapisać", async () => {
    render(<GoalsCard saved={zapisane} />);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Kilometry biegu w tygodniu" }),
    );
    const pole = screen.getByRole("textbox", {
      name: "Kilometry biegu w tygodniu",
    });
    expect(pole).toHaveValue("25");
    await userEvent.clear(pole);
    await userEvent.type(pole, "30");
    await userEvent.click(zapisz());
    expect(saveGoals).toHaveBeenCalledWith({
      sleep_goal_min: 480,
      workouts_goal_on: true,
      km_goal_on: true,
      weekly_workouts_goal: 3,
      weekly_km_goal: 30,
      currency: "PLN",
      week_start: "mon",
    });
    expect(
      await screen.findByText(
        "Zapisano ✓ — cele zaktualizowane na ekranie Dziś",
      ),
    ).toBeInTheDocument();
  });

  it("oba cele wyłączone → „Włącz co najmniej jeden cel.” i Zapisz nieaktywne", async () => {
    render(<GoalsCard saved={zapisane} />);
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Treningi w tygodniu" }),
    );
    expect(
      screen.getByText("Włącz co najmniej jeden cel."),
    ).toBeInTheDocument();
    expect(zapisz()).toBeDisabled();
  });

  it("treningi „15” i „2,5” → błąd i Zapisz nieaktywne", async () => {
    render(<GoalsCard saved={zapisane} />);
    const pole = screen.getByRole("textbox", { name: "Treningi w tygodniu" });
    await userEvent.clear(pole);
    await userEvent.type(pole, "15");
    expect(
      screen.getByText("Treningi: Podaj liczbę 1–14."),
    ).toBeInTheDocument();
    expect(pole).toHaveAttribute("aria-invalid", "true");
    expect(zapisz()).toBeDisabled();
    await userEvent.clear(pole);
    await userEvent.type(pole, "2,5");
    expect(
      screen.getByText("Treningi: Podaj liczbę 1–14."),
    ).toBeInTheDocument();
    await userEvent.clear(pole);
    await userEvent.type(pole, "14");
    expect(
      screen.queryByText("Treningi: Podaj liczbę 1–14."),
    ).not.toBeInTheDocument();
    expect(zapisz()).toBeEnabled();
  });

  it("wyłączenie celu ze złą liczbą przywraca zapisaną (bez ukrytego błędu)", async () => {
    render(<GoalsCard saved={{ ...zapisane, kmOn: true }} />);
    const pole = screen.getByRole("textbox", { name: "Treningi w tygodniu" });
    await userEvent.clear(pole);
    await userEvent.type(pole, "20");
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Treningi w tygodniu" }),
    );
    expect(screen.queryByText(/Podaj liczbę/)).not.toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("checkbox", { name: "Treningi w tygodniu" }),
    );
    expect(
      screen.getByRole("textbox", { name: "Treningi w tygodniu" }),
    ).toHaveValue("3");
  });

  it("km „0” → błąd i Zapisz nieaktywne", async () => {
    render(<GoalsCard saved={{ ...zapisane, kmOn: true }} />);
    const pole = screen.getByRole("textbox", {
      name: "Kilometry biegu w tygodniu",
    });
    await userEvent.clear(pole);
    await userEvent.type(pole, "0");
    expect(
      screen.getByText("Kilometry: Podaj liczbę 1–300."),
    ).toBeInTheDocument();
    expect(zapisz()).toBeDisabled();
  });

  it("„−” przy 5:00 jest nieaktywne, „+” przy 11:00 też", () => {
    const { unmount } = render(
      <GoalsCard saved={{ ...zapisane, sleep: 300 }} />,
    );
    expect(
      screen.getByRole("button", { name: /Zmniejsz Cel snu/ }),
    ).toBeDisabled();
    unmount();
    render(<GoalsCard saved={{ ...zapisane, sleep: 660 }} />);
    expect(
      screen.getByRole("button", { name: /Zwiększ Cel snu/ }),
    ).toBeDisabled();
  });

  it("zmiana snu i zapis → saveGoals i komunikat o Dziś; Cofnij działa przed zapisem", async () => {
    render(<GoalsCard saved={zapisane} />);
    await userEvent.click(
      screen.getByRole("button", { name: /Zwiększ Cel snu/ }),
    );
    expect(screen.getByText("8:15")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(screen.getByText("8:00")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: /Zwiększ Cel snu/ }),
    );
    await userEvent.click(zapisz());
    expect(saveGoals).toHaveBeenCalledWith({
      sleep_goal_min: 495,
      workouts_goal_on: true,
      km_goal_on: false,
      weekly_workouts_goal: 3,
      weekly_km_goal: 25,
      currency: "PLN",
      week_start: "mon",
    });
    expect(
      await screen.findByText(
        "Zapisano ✓ — cele zaktualizowane na ekranie Dziś",
      ),
    ).toBeInTheDocument();
  });
});
