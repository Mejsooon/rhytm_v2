import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveGoals } = vi.hoisted(() => ({ saveGoals: vi.fn() }));
vi.mock("./actions", () => ({ saveGoals }));

import { GoalsCard } from "./goals-card";

const zapisane = { sleep: 480, km: "25", cur: "PLN" as const, week: "mon" as const };

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

  it("km „0” → „Podaj liczbę 1–300.” i Zapisz nieaktywne", async () => {
    render(<GoalsCard saved={zapisane} />);
    const pole = screen.getByLabelText("Tygodniowy cel km");
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
      weekly_km_goal: 25,
      currency: "PLN",
      week_start: "mon",
    });
    expect(await screen.findByText("Zapisano ✓ — cele zaktualizowane na ekranie Dziś")).toBeInTheDocument();
  });
});
