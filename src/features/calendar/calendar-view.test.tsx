import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setCategoryHidden, toastError } = vi.hoisted(() => ({
  setCategoryHidden: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/features/categories/actions", () => ({ setCategoryHidden }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { CalendarView } from "./calendar-view";
import type { CalendarData } from "./load-calendar";

function blok(id: string, title: string, categoryId: string) {
  return {
    id,
    user_id: "u1",
    title,
    start_local: "2026-11-18T08:00:00",
    duration_min: 60,
    category_id: categoryId,
    note: null,
    recurrence: null,
    remind: false,
    timezone: "Europe/Warsaw",
    created_at: null,
    updated_at: null,
  };
}

function dane(): CalendarData {
  return {
    blocks: [blok("b1", "Algebra", "c1"), blok("b2", "Sprzątanie", "c2")],
    exceptions: [],
    tasks: [],
    categories: [
      { id: "c1", name: "Studia", color: "#0070f3", hidden: false, is_system: false, position: 1, user_id: "u1", created_at: null },
      { id: "c2", name: "Dom", color: "#a16207", hidden: false, is_system: false, position: 2, user_id: "u1", created_at: null },
    ],
    profile: { timezone: "Europe/Warsaw", weekStart: "mon", clock: "24" },
  };
}

function wyrenderuj(data = dane()) {
  return render(
    <CalendarView view="tydzien" date="2026-11-18" today="2026-11-17" nowMinutes={600} data={data} />,
  );
}

beforeEach(() => vi.clearAllMocks());

describe("CalendarView", () => {
  it("liczy wystąpienia kategorii w widoku", () => {
    wyrenderuj();
    expect(screen.getByRole("button", { name: /Studia/ })).toHaveTextContent("1");
    expect(screen.getByRole("button", { name: /Dom/ })).toHaveTextContent("1");
    expect(screen.getByText("Algebra")).toBeInTheDocument();
  });

  it("klik w chip ukrywa kategorię od razu i woła setCategoryHidden", async () => {
    setCategoryHidden.mockResolvedValue({ ok: true });
    wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /Dom/ }));
    expect(setCategoryHidden).toHaveBeenCalledWith({ id: "c2", hidden: true });
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Dom/ }).className).toContain("border-dashed"),
    );
    expect(screen.queryByText("Sprzątanie")).not.toBeInTheDocument();
    expect(screen.getByText("Algebra")).toBeInTheDocument();
  });

  it("błąd akcji przywraca chip i blok oraz pokazuje toast", async () => {
    setCategoryHidden.mockResolvedValue({ ok: false, message: "x" });
    wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /Dom/ }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."),
    );
    expect(screen.getByRole("button", { name: /Dom/ }).className).not.toContain("border-dashed");
    expect(screen.getByText("Sprzątanie")).toBeInTheDocument();
  });

  it("nowe dane z serwera zastępują stan klienta", async () => {
    setCategoryHidden.mockResolvedValue({ ok: true });
    const { rerender } = wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /Dom/ }));
    rerender(
      <CalendarView view="tydzien" date="2026-11-18" today="2026-11-17" nowMinutes={600} data={dane()} />,
    );
    expect(screen.getByRole("button", { name: /Dom/ }).className).not.toContain("border-dashed");
  });
});
