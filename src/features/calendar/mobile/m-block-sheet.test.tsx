import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBlock, changeOccurrence, addTask, deleteTask } = vi.hoisted(() => ({
  createBlock: vi.fn(),
  changeOccurrence: vi.fn(),
  addTask: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock("../actions", () => ({ createBlock, changeOccurrence }));
vi.mock("@/features/tasks/actions", () => ({ addTask, deleteTask }));

import type { BlockDialogInitial } from "../block-dialog";
import type { CategoryRow } from "../load-calendar";
import { MBlockSheet } from "./m-block-sheet";

function kategoria(id: string, name: string, color: string, isSystem = false): CategoryRow {
  return { id, name, color, hidden: false, is_system: isSystem, position: 1, user_id: "u1", created_at: null };
}
const KATEGORIE = [
  kategoria("c1", "Studia", "#0070f3"),
  kategoria("c2", "Sport", "#c2410c"),
  kategoria("c3", "Sen", "#525252", true),
];
const NOWY: BlockDialogInitial = {
  title: "",
  categoryId: null,
  date: "2026-11-17",
  startMin: 600,
  durationMin: 60,
  recurrence: null,
  note: "",
  remind: true,
};
const CYKLICZNY: BlockDialogInitial = {
  ...NOWY,
  title: "Algebra",
  categoryId: "c1",
  recurrence: { freq: "weekly" },
  blockId: "b1",
  occurrenceDate: "2026-11-17",
  firstOccurrence: false,
};

function wyrenderuj(mode: "create" | "edit" = "create", initial = NOWY) {
  const onDone = vi.fn();
  render(
    <MBlockSheet
      mode={mode}
      initial={initial}
      categories={KATEGORIE}
      clock="24"
      weekStart="mon"
      today="2026-11-17"
      onDone={onDone}
    />,
  );
  return { onDone };
}

beforeEach(() => {
  vi.clearAllMocks();
  createBlock.mockResolvedValue({ ok: true });
  changeOccurrence.mockResolvedValue({ ok: true });
});

describe("MBlockSheet", () => {
  it("pokazuje kategorie bez systemowych", () => {
    wyrenderuj();
    expect(screen.getByRole("button", { name: "Studia" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sen" })).not.toBeInTheDocument();
  });

  it("„+” przy „Do” 23:45 nie przekracza 24:00 (przycisk wyłączony)", async () => {
    wyrenderuj("create", { ...NOWY, startMin: 22 * 60, durationMin: 105 });
    const plus = screen.getByRole("button", { name: "Zwiększ Do" });
    expect(plus).toBeEnabled();
    await userEvent.click(plus);
    expect(plus).toBeDisabled();
    expect(screen.getByRole("group", { name: "Do" })).toHaveTextContent("24:00");
  });

  it("czas trwania na żywo: 10:00–11:30 to „1 h 30 min”", async () => {
    wyrenderuj();
    expect(screen.getByText("Czas trwania: 1 h")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Zwiększ Do" }));
    await userEvent.click(screen.getByRole("button", { name: "Zwiększ Do" }));
    expect(screen.getByText("Czas trwania: 1 h 30 min")).toBeInTheDocument();
  });

  it("„Od” nie dojdzie do „Do” (min. 15 minut)", async () => {
    wyrenderuj("create", { ...NOWY, durationMin: 15 });
    expect(screen.getByRole("button", { name: "Zwiększ Od" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Zmniejsz Do" })).toBeDisabled();
  });

  it("Enter dodaje zadanie, × usuwa", async () => {
    wyrenderuj();
    const pole = screen.getByRole("textbox", { name: "Nowe zadanie" });
    await userEvent.type(pole, "A{Enter}");
    expect(screen.getByText("A")).toBeInTheDocument();
    expect(pole).toHaveValue("");
    await userEvent.click(screen.getByRole("button", { name: "Usuń zadanie A" }));
    expect(screen.queryByText("A")).not.toBeInTheDocument();
  });

  it("zapis tworzy blok z zadaniami i zamyka arkusz", async () => {
    const { onDone } = wyrenderuj();
    await userEvent.type(screen.getByRole("textbox", { name: "Nazwa bloku" }), "Bieg");
    await userEvent.click(screen.getByRole("button", { name: "Sport" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Nowe zadanie" }), "A{Enter}");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(createBlock).toHaveBeenCalledWith({
      title: "Bieg",
      categoryId: "c2",
      date: "2026-11-17",
      startMin: 600,
      durationMin: 60,
      recurrence: null,
      note: "",
      remind: true,
      tasks: ["A"],
    });
  });

  it("bez nazwy zapis jest nieaktywny", () => {
    wyrenderuj();
    expect(screen.getByRole("button", { name: "Zapisz blok" })).toBeDisabled();
  });

  it("„Własne” bez dni: zapis nieaktywny", async () => {
    wyrenderuj();
    await userEvent.type(screen.getByRole("textbox", { name: "Nazwa bloku" }), "Bieg");
    await userEvent.click(screen.getByRole("radio", { name: "Własne" }));
    const zapis = screen.getByRole("button", { name: "Zapisz blok" });
    expect(zapis).toBeEnabled();
    // Domyślnie zaznaczony jest dzień z daty (wtorek); zdjęcie go zostawia pustą listę
    await userEvent.click(screen.getByRole("button", { name: "Dzień wt" }));
    expect(zapis).toBeDisabled();
  });

  it("błąd akcji zostaje w arkuszu", async () => {
    createBlock.mockResolvedValue({ ok: false, message: "Nie udało się zapisać." });
    const { onDone } = wyrenderuj();
    await userEvent.type(screen.getByRole("textbox", { name: "Nazwa bloku" }), "Bieg");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie udało się zapisać.");
    expect(onDone).not.toHaveBeenCalled();
  });

  it("edycja bloku cyklicznego pyta o zakres, a zmiana kategorii wyłącza „Tylko to wystąpienie”", async () => {
    const { onDone } = wyrenderuj("edit", CYKLICZNY);
    await userEvent.click(screen.getByRole("button", { name: "Studia" }));
    await userEvent.click(screen.getByRole("button", { name: "Sport" }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(changeOccurrence).not.toHaveBeenCalled();
    expect(screen.getByRole("radio", { name: /Tylko to wystąpienie/ })).toBeDisabled();
    expect(screen.getByText("Kategoria, notatka i przypomnienie zmieniają się dla całej serii.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Zapisz zmianę" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-17",
      scope: "following",
      patch: { categoryId: "c2" },
    });
  });

  it("zmiana dnia nie pierwszego wystąpienia wyłącza „To i następne”", async () => {
    wyrenderuj("edit", CYKLICZNY);
    await userEvent.click(screen.getByRole("button", { name: "Dzień" }));
    await userEvent.click(await screen.findByRole("button", { name: /18/ }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(screen.getByRole("radio", { name: /To i następne/ })).toBeDisabled();
  });

  it("edycja bloku jednorazowego zapisuje od razu tylko zmienione pola", async () => {
    const { onDone } = wyrenderuj("edit", { ...NOWY, title: "Algebra", blockId: "b2", occurrenceDate: "2026-11-17" });
    await userEvent.click(screen.getByRole("button", { name: "Zwiększ Do" }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b2",
      date: "2026-11-17",
      scope: "all",
      patch: { durationMin: 75 },
    });
  });

  it("blok z końcem serii: „Nie” odblokowuje zapis mimo daty końca przed dniem", async () => {
    wyrenderuj("edit", { ...CYKLICZNY, recurrence: { freq: "weekly", until: "2026-11-10" } });
    expect(screen.getByRole("button", { name: "Zapisz blok" })).toBeDisabled();
    await userEvent.click(screen.getByRole("radio", { name: "Nie" }));
    expect(screen.getByRole("button", { name: "Zapisz blok" })).toBeEnabled();
  });

  it("data poza końcem serii: komunikat i „Usuń datę końca” czyści koniec w zapisie", async () => {
    wyrenderuj("edit", { ...CYKLICZNY, recurrence: { freq: "weekly", until: "2026-11-20" } });
    await userEvent.click(screen.getByRole("button", { name: "Dzień" }));
    await userEvent.click(await screen.findByRole("button", { name: /^24$/ }));
    expect(screen.getByRole("alert")).toHaveTextContent("Koniec powtarzania nie może być przed początkiem.");
    expect(screen.getByRole("button", { name: "Zapisz blok" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Usuń datę końca" }));
    expect(screen.getByRole("button", { name: "Zapisz blok" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    await userEvent.click(screen.getByRole("radio", { name: /Wszystkie wystąpienia/ }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz zmianę" }));
    await waitFor(() => expect(changeOccurrence).toHaveBeenCalled());
    const patch = changeOccurrence.mock.calls[0][0].patch;
    expect(patch.recurrence).toEqual({ freq: "weekly" });
  });

  it("edycja bez applyOptimistic wyłącza pole zadań", () => {
    wyrenderuj("edit", { ...NOWY, title: "Algebra", blockId: "b2", occurrenceDate: "2026-11-17" });
    expect(screen.getByRole("textbox", { name: "Nowe zadanie" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Dodaj zadanie" })).toBeDisabled();
  });
  it("„Powtarzaj do” widać tylko przy powtarzaniu; wybrana data trafia do createBlock", async () => {
    wyrenderuj("create", { ...NOWY, title: "Algebra" });
    expect(screen.queryByRole("button", { name: "Powtarzaj do" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Co tydzień" }));
    const doKiedy = screen.getByRole("button", { name: "Powtarzaj do" });
    expect(doKiedy).toHaveTextContent("bez końca");
    await userEvent.click(doKiedy);
    await userEvent.click(await screen.findByRole("button", { name: /^25$/ }));
    expect(screen.getByRole("button", { name: "Powtarzaj do" })).toHaveTextContent("25.11.2026");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    await waitFor(() => expect(createBlock).toHaveBeenCalled());
    expect(createBlock.mock.calls[0][0].recurrence).toEqual({ freq: "weekly", until: "2026-11-25" });
  });

  it("„Powtarzaj do” można wyczyścić (seria bez końca)", async () => {
    wyrenderuj("edit", { ...CYKLICZNY, recurrence: { freq: "weekly", until: "2026-12-31" } });
    await userEvent.click(screen.getByRole("button", { name: "Powtarzaj do" }));
    await userEvent.click(await screen.findByRole("button", { name: "Wyczyść" }));
    expect(screen.getByRole("button", { name: "Powtarzaj do" })).toHaveTextContent("bez końca");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    await userEvent.click(screen.getByRole("radio", { name: /Wszystkie wystąpienia/ }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz zmianę" }));
    await waitFor(() => expect(changeOccurrence).toHaveBeenCalled());
    expect(changeOccurrence.mock.calls[0][0].patch.recurrence).toEqual({ freq: "weekly" });
  });

  it("zmiana dnia w serii codziennej wyłącza „To i następne” i „Wszystkie”", async () => {
    wyrenderuj("edit", { ...CYKLICZNY, recurrence: { freq: "daily" }, firstOccurrence: true });
    await userEvent.click(screen.getByRole("button", { name: "Dzień" }));
    await userEvent.click(await screen.findByRole("button", { name: /18/ }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(screen.getByRole("radio", { name: /Tylko to wystąpienie/ })).toBeEnabled();
    expect(screen.getByRole("radio", { name: /To i następne/ })).toBeDisabled();
    expect(screen.getByRole("radio", { name: /Wszystkie wystąpienia/ })).toBeDisabled();
    expect(
      screen.getByText("Zmiana dnia działa dla tego wystąpienia albo dla całej serii tygodniowej."),
    ).toBeInTheDocument();
  });
});
