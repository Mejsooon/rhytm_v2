import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveGoals } = vi.hoisted(() => ({ saveGoals: vi.fn() }));
vi.mock("./actions", () => ({ saveGoals }));

import { GoalsCard } from "./goals-card";

const zapisane = {
  sleep: 480,
  goalType: "workouts" as const,
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
    expect(screen.getByText("Pokazywane na ekranie Dziś, w Sporcie i przy śnie.")).toBeInTheDocument();
    expect(screen.getByText("8:00")).toBeInTheDocument();
    expect(screen.getByText("Waluta dotyczy pól „Kwota cykliczna”.")).toBeInTheDocument();
    expect(zapisz()).toBeDisabled();
  });

  it("„Cel treningowy”: segment Treningi | Km, pole i podpowiedź „treningów w tygodniu”", () => {
    render(<GoalsCard saved={zapisane} />);
    expect(screen.getByText("Cel treningowy")).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Treningi" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: "Km" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByLabelText("Treningi w tygodniu")).toHaveValue("3");
    expect(screen.getByText("treningów w tygodniu")).toBeInTheDocument();
  });

  it("zmiana na Km pokazuje km i „km w tygodniu”; powrót zostawia liczbę treningów", async () => {
    render(<GoalsCard saved={zapisane} />);
    await userEvent.click(screen.getByRole("radio", { name: "Km" }));
    expect(screen.getByLabelText("Kilometry w tygodniu")).toHaveValue("25");
    expect(screen.getByText("km w tygodniu")).toBeInTheDocument();
    expect(screen.getByText("Masz niezapisane zmiany.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Treningi" }));
    expect(screen.getByLabelText("Treningi w tygodniu")).toHaveValue("3");
    expect(zapisz()).toBeDisabled();
  });

  it("treningi „15” i „2,5” → „Podaj liczbę 1–14.” i Zapisz nieaktywne", async () => {
    render(<GoalsCard saved={zapisane} />);
    const pole = screen.getByLabelText("Treningi w tygodniu");
    await userEvent.clear(pole);
    await userEvent.type(pole, "15");
    expect(screen.getByText("Podaj liczbę 1–14.")).toBeInTheDocument();
    expect(pole).toHaveAttribute("aria-invalid", "true");
    expect(zapisz()).toBeDisabled();
    await userEvent.clear(pole);
    await userEvent.type(pole, "2,5");
    expect(screen.getByText("Podaj liczbę 1–14.")).toBeInTheDocument();
    await userEvent.clear(pole);
    await userEvent.type(pole, "14");
    expect(screen.queryByText("Podaj liczbę 1–14.")).not.toBeInTheDocument();
    expect(zapisz()).toBeEnabled();
  });

  it("zła liczba nie zostaje ukryta: zmiana rodzaju przywraca zapisaną", async () => {
    render(<GoalsCard saved={zapisane} />);
    const pole = screen.getByLabelText("Treningi w tygodniu");
    await userEvent.clear(pole);
    await userEvent.type(pole, "20");
    await userEvent.click(screen.getByRole("radio", { name: "Km" }));
    expect(screen.queryByText("Podaj liczbę 1–14.")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Treningi" }));
    expect(screen.getByLabelText("Treningi w tygodniu")).toHaveValue("3");
  });

  it("po zapisie zła liczba przy zmianie rodzaju wraca do nowo zapisanej, nie do propsa", async () => {
    render(<GoalsCard saved={zapisane} />);
    const pole = screen.getByLabelText("Treningi w tygodniu");
    await userEvent.clear(pole);
    await userEvent.type(pole, "5");
    await userEvent.click(zapisz());
    await screen.findByText("Zapisano ✓ — cele zaktualizowane na ekranie Dziś");
    await userEvent.clear(screen.getByLabelText("Treningi w tygodniu"));
    await userEvent.type(screen.getByLabelText("Treningi w tygodniu"), "20");
    await userEvent.click(screen.getByRole("radio", { name: "Km" }));
    await userEvent.click(screen.getByRole("radio", { name: "Treningi" }));
    expect(screen.getByLabelText("Treningi w tygodniu")).toHaveValue("5");
  });

  it("zapis po zmianie na Km wysyła rodzaj i obie liczby", async () => {
    render(<GoalsCard saved={zapisane} />);
    await userEvent.click(screen.getByRole("radio", { name: "Km" }));
    const pole = screen.getByLabelText("Kilometry w tygodniu");
    await userEvent.clear(pole);
    await userEvent.type(pole, "30");
    await userEvent.click(zapisz());
    expect(saveGoals).toHaveBeenCalledWith({
      sleep_goal_min: 480,
      weekly_goal_type: "km",
      weekly_workouts_goal: 3,
      weekly_km_goal: 30,
      currency: "PLN",
      week_start: "mon",
    });
    expect(await screen.findByText("Zapisano ✓ — cele zaktualizowane na ekranie Dziś")).toBeInTheDocument();
  });

  it("km „0” → „Podaj liczbę 1–300.” i Zapisz nieaktywne", async () => {
    render(<GoalsCard saved={{ ...zapisane, goalType: "km" }} />);
    const pole = screen.getByLabelText("Kilometry w tygodniu");
    await userEvent.clear(pole);
    await userEvent.type(pole, "0");
    expect(screen.getByText("Podaj liczbę 1–300.")).toBeInTheDocument();
    expect(zapisz()).toBeDisabled();
  });

  it("„−” przy 5:00 jest nieaktywne, „+” przy 11:00 też", () => {
    const { unmount } = render(<GoalsCard saved={{ ...zapisane, sleep: 300 }} />);
    expect(screen.getByRole("button", { name: /Zmniejsz Cel snu/ })).toBeDisabled();
    unmount();
    render(<GoalsCard saved={{ ...zapisane, sleep: 660 }} />);
    expect(screen.getByRole("button", { name: /Zwiększ Cel snu/ })).toBeDisabled();
  });

  it("zmiana snu i zapis → saveGoals i komunikat o Dziś; Cofnij działa przed zapisem", async () => {
    render(<GoalsCard saved={zapisane} />);
    await userEvent.click(screen.getByRole("button", { name: /Zwiększ Cel snu/ }));
    expect(screen.getByText("8:15")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Cofnij" }));
    expect(screen.getByText("8:00")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Zwiększ Cel snu/ }));
    await userEvent.click(zapisz());
    expect(saveGoals).toHaveBeenCalledWith({
      sleep_goal_min: 495,
      weekly_goal_type: "workouts",
      weekly_workouts_goal: 3,
      weekly_km_goal: 25,
      currency: "PLN",
      week_start: "mon",
    });
    expect(await screen.findByText("Zapisano ✓ — cele zaktualizowane na ekranie Dziś")).toBeInTheDocument();
  });
});
