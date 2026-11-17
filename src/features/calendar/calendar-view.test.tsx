import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setCategoryHidden, createCategory, toastError, push, createBlock, changeOccurrence } = vi.hoisted(() => ({
  setCategoryHidden: vi.fn(),
  createCategory: vi.fn(),
  toastError: vi.fn(),
  push: vi.fn(),
  createBlock: vi.fn(),
  changeOccurrence: vi.fn(),
}));
vi.mock("@/features/categories/actions", () => ({ setCategoryHidden, createCategory }));
vi.mock("./actions", () => ({ createBlock, changeOccurrence }));
vi.mock("@/features/tasks/actions", () => ({
  addTask: vi.fn(),
  toggleTask: vi.fn(),
  deleteTask: vi.fn(),
  unpinTask: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

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

beforeEach(() => {
  vi.clearAllMocks();
});

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

  it("klik w blok otwiera dymek, ponowny klik i Esc go zamykają", async () => {
    wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    expect(screen.getByRole("dialog", { name: "Szczegóły bloku" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ukrycie kategorii bloku zamyka dymek i nie wraca po ponownym pokazaniu", async () => {
    setCategoryHidden.mockResolvedValue({ ok: true });
    wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Studia/ }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: /Studia/ }));
    await screen.findByRole("button", { name: /^Algebra/ });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("klik w pusty slot 10:00 pokazuje „Nowy wpis” z 10:00; „Blok” otwiera okno z 10:00–11:00", async () => {
    wyrenderuj();
    // 20. półgodzina (24 px każda) = 10:00
    fireEvent.click(screen.getByTestId("kolumna-2026-11-19"), { clientY: 480 });
    const dymek = await screen.findByRole("dialog", { name: "Nowy wpis" });
    expect(within(dymek).getByText("cz 19.11 · 10:00")).toBeInTheDocument();
    await userEvent.click(within(dymek).getByRole("button", { name: /Blok/ }));
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(within(okno).getByRole("button", { name: "Dzień" })).toHaveTextContent("19.11.2026");
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent("10:00");
    expect(within(okno).getByRole("button", { name: "Do" })).toHaveTextContent("11:00");
    expect(screen.queryByRole("dialog", { name: "Nowy wpis" })).not.toBeInTheDocument();
  });

  it("ponowny klik w ten sam slot zamyka „Nowy wpis”", async () => {
    wyrenderuj();
    fireEvent.click(screen.getByTestId("kolumna-2026-11-19"), { clientY: 480 });
    await screen.findByRole("dialog", { name: "Nowy wpis" });
    fireEvent.click(screen.getByTestId("kolumna-2026-11-19"), { clientY: 480 });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("„Nowy blok” z nagłówka bierze dziś i najbliższą pełną godzinę na 60 min", async () => {
    wyrenderuj();
    await userEvent.click(screen.getAllByRole("button", { name: "Nowy blok" })[0]);
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    // today = 2026-11-17, nowMinutes = 600 (10:00) -> 11:00–12:00
    expect(within(okno).getByRole("button", { name: "Dzień" })).toHaveTextContent("17.11.2026");
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent("11:00");
    expect(within(okno).getByRole("button", { name: "Do" })).toHaveTextContent("12:00");
  });

  it("Anuluj i ✕ zamykają okno bloku bez zmiany adresu", async () => {
    wyrenderuj();
    await userEvent.click(screen.getAllByRole("button", { name: "Nowy blok" })[0]);
    await userEvent.click(await screen.findByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole("button", { name: "Nowy blok" })[0]);
    await userEvent.click(await screen.findByRole("button", { name: "Zamknij" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it("„+ Kategoria” otwiera okno kategorii; po dodaniu chip pojawia się w filtrach", async () => {
    createCategory.mockResolvedValue({ ok: true, id: "c9" });
    wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: "+ Kategoria" }));
    await userEvent.type(await screen.findByLabelText("Nazwa"), "Języki");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj kategorię" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(createCategory).toHaveBeenCalledWith(expect.objectContaining({ name: "Języki" }));
    expect(screen.getByRole("button", { name: /Języki/ })).toBeInTheDocument();
  });

  it("„Edytuj” w dymku otwiera okno bloku z danymi wystąpienia", async () => {
    wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Szczegóły bloku" })).getByRole("button", { name: "Edytuj" }));
    const okno = await screen.findByRole("dialog", { name: "Edytuj blok" });
    expect(within(okno).getByLabelText("Tytuł")).toHaveValue("Algebra");
    expect(within(okno).getByRole("button", { name: "Dzień" })).toHaveTextContent("18.11.2026");
    expect(screen.queryByRole("dialog", { name: "Szczegóły bloku" })).not.toBeInTheDocument();
  });

  it("„Usuń” w dymku bloku jednorazowego pyta „Usunąć blok?” i usuwa po „Usuń”", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /^Algebra/ }));
    await userEvent.click(within(screen.getByRole("dialog", { name: "Szczegóły bloku" })).getByRole("button", { name: "Usuń" }));
    const okno = await screen.findByRole("dialog", { name: "Usunąć blok?" });
    await userEvent.click(within(okno).getByRole("button", { name: "Usuń" }));
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-18",
      scope: "all",
      delete: true,
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
