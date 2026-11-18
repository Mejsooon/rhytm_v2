import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { RecordCard } from "./record-card";
import { daneSportu, WYCISKANIE } from "./sport-test-data";

describe("RecordCard", () => {
  it("domyślnie ćwiczenie z największą liczbą sesji z ciężarem", () => {
    const dane = daneSportu();
    render(
      <RecordCard
        exercises={dane.exercises}
        setsHistory={dane.setsHistory}
        onNewGym={vi.fn()}
      />,
    );
    const nazwa = screen.getByRole("link", { name: "Wyciskanie na ławce" });
    expect(nazwa).toHaveAttribute("href", `/sport/cwiczenia/${WYCISKANIE}`);
    // 72,5 × 5 → 1RM 84,5 (Epley, do 0,5); seria 72,5 to REKORD (poprzednio 70)
    expect(screen.getByText("84,5 kg")).toBeInTheDocument();
    expect(screen.getByText("72,5 × 5")).toBeInTheDocument();
    expect(screen.getByText("ostatnio: czw 12.11.2026")).toBeInTheDocument();
    expect(screen.getByText("REKORD")).toBeInTheDocument();
  });

  it("najechanie na punkt pokazuje dymek z różnicą", async () => {
    const dane = daneSportu();
    render(
      <RecordCard
        exercises={dane.exercises}
        setsHistory={dane.setsHistory}
        onNewGym={vi.fn()}
      />,
    );
    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "pt 06.11.2026: 81,5 kg" }),
    );
    const dymek = screen.getByRole("tooltip");
    expect(dymek).toHaveTextContent("81,5 kg szac. 1RM");
    expect(dymek).toHaveTextContent("seria 70 × 5");
    expect(dymek).toHaveTextContent("pierwszy pomiar");
    expect(screen.getByText("bez rekordu")).toBeInTheDocument();

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: "czw 12.11.2026: 84,5 kg" }),
    );
    expect(screen.getByRole("tooltip")).toHaveTextContent("+3,0 kg vs poprz.");
  });

  it("Dropdown zmienia ćwiczenie", async () => {
    const dane = daneSportu();
    // Drugie ćwiczenie z ciężarem
    const historia = dane.setsHistory.map((s) => ({
      ...s,
      sets: s.sets.map((z) =>
        z.weight_kg === null ? { ...z, weight_kg: 10 } : z,
      ),
    }));
    render(
      <RecordCard
        exercises={dane.exercises}
        setsHistory={historia}
        onNewGym={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Ćwiczenie" }));
    await userEvent.click(
      screen.getByRole("option", { name: "Pompki na poręczach" }),
    );
    expect(
      screen.getByRole("link", { name: "Pompki na poręczach" }),
    ).toBeInTheDocument();
    expect(screen.getByText("10 × 10")).toBeInTheDocument();
  });

  it("bez treningów siłowych: komunikat i „+ Trening siłowy”", async () => {
    const onNewGym = vi.fn();
    render(<RecordCard exercises={[]} setsHistory={[]} onNewGym={onNewGym} />);
    expect(screen.getByText("Brak treningów siłowych.")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "+ Trening siłowy" }),
    );
    expect(onNewGym).toHaveBeenCalled();
  });
});
