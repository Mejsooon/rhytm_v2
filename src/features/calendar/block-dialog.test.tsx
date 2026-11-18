import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createBlock, changeOccurrence, createCategory } = vi.hoisted(() => ({
  createBlock: vi.fn(),
  changeOccurrence: vi.fn(),
  createCategory: vi.fn(),
}));
vi.mock("./actions", () => ({ createBlock, changeOccurrence }));
vi.mock("@/features/categories/actions", () => ({ createCategory }));

import { BlockDialog, type BlockDialogInitial } from "./block-dialog";
import type { CategoryRow } from "./load-calendar";

function kategoria(
  id: string,
  name: string,
  color: string,
  isSystem = false,
): CategoryRow {
  return {
    id,
    name,
    color,
    hidden: false,
    is_system: isSystem,
    position: 1,
    user_id: "u1",
    created_at: null,
  };
}
const KATEGORIE = [
  kategoria("c1", "Studia", "#0070f3"),
  kategoria("c2", "Projekty", "#15803d"),
  kategoria("c3", "Sport", "#c2410c", true),
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
  title: "rhytm — kod",
  categoryId: "c2",
  durationMin: 150,
  recurrence: { freq: "weekly", until: "2027-01-31" },
  blockId: "b1",
  occurrenceDate: "2026-11-17",
};

function wyrenderuj(
  mode: "create" | "edit" = "create",
  initial: BlockDialogInitial = NOWY,
) {
  const onSaved = vi.fn();
  const onCancel = vi.fn();
  render(
    <BlockDialog
      mode={mode}
      initial={initial}
      categories={KATEGORIE}
      clock="24"
      weekStart="mon"
      today="2026-11-17"
      onSaved={onSaved}
      onCancel={onCancel}
    />,
  );
  return { onSaved, onCancel };
}

beforeEach(() => vi.clearAllMocks());

describe("BlockDialog", () => {
  it("pokazuje dzień, od i do z initial; kategorie bez systemowych", () => {
    wyrenderuj();
    expect(
      screen.getByRole("dialog", { name: "Nowy blok" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dzień" })).toHaveTextContent(
      "17.11.2026",
    );
    expect(screen.getByRole("button", { name: "Od" })).toHaveTextContent(
      "10:00",
    );
    expect(screen.getByRole("button", { name: "Do" })).toHaveTextContent(
      "11:00",
    );
    expect(screen.getByRole("button", { name: "Studia" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Sport" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Przypomnienie" })).toBeChecked();
  });

  it("pusty tytuł blokuje „Zapisz blok”", async () => {
    wyrenderuj();
    const zapisz = screen.getByRole("button", { name: "Zapisz blok" });
    expect(zapisz).toBeDisabled();
    await userEvent.type(screen.getByLabelText("Tytuł"), "Algebra");
    expect(zapisz).toBeEnabled();
  });

  it("zmiana „od” przesuwa „do” z zachowaniem czasu trwania", async () => {
    wyrenderuj("create", { ...NOWY, durationMin: 90 });
    await userEvent.click(screen.getByRole("button", { name: "Od" }));
    await userEvent.click(screen.getByRole("button", { name: "12" }));
    await userEvent.click(screen.getByRole("button", { name: ":00" }));
    expect(screen.getByRole("button", { name: "Od" })).toHaveTextContent(
      "12:00",
    );
    expect(screen.getByRole("button", { name: "Do" })).toHaveTextContent(
      "13:30",
    );
  });

  it("„do” nie później niż „od” blokuje zapis i pokazuje komunikat", async () => {
    wyrenderuj("create", { ...NOWY, title: "X" });
    await userEvent.click(screen.getByRole("button", { name: "Do" }));
    await userEvent.click(screen.getByRole("button", { name: "09" }));
    await userEvent.click(screen.getByRole("button", { name: ":00" }));
    expect(
      screen.getByText("Koniec musi być co najmniej 15 minut po początku."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zapisz blok" })).toBeDisabled();
  });

  it("„Własne…” bez dni blokuje zapis", async () => {
    wyrenderuj("create", { ...NOWY, title: "X" });
    await userEvent.click(screen.getByRole("radio", { name: "Własne…" }));
    // Domyślnie zaznaczony dzień daty (wt); odznaczenie zostawia zero dni
    await userEvent.click(screen.getByRole("button", { name: "wt" }));
    expect(screen.getByRole("button", { name: "Zapisz blok" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "pt" }));
    expect(screen.getByRole("button", { name: "Zapisz blok" })).toBeEnabled();
  });

  it("podsumowanie „Co tydzień” z datą końca to zdanie z makiety", () => {
    wyrenderuj("create", {
      ...NOWY,
      recurrence: { freq: "weekly", until: "2027-01-31" },
    });
    expect(
      screen.getByText(
        "Co tydzień we wtorki, do 31.01.2027. Każde powtórzenie ma własną, pustą listę zadań.",
      ),
    ).toBeInTheDocument();
  });

  it("podsumowanie zmienia się na żywo z wyborem powtarzania", async () => {
    wyrenderuj();
    expect(screen.getByText(/^Jednorazowy blok\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Dni robocze" }));
    expect(screen.getByText(/^Pon–pt, bez końca\./)).toBeInTheDocument();
  });

  it("zapis nowego bloku woła createBlock z danymi i onSaved", async () => {
    createBlock.mockResolvedValue({ ok: true, id: "b9" });
    const { onSaved } = wyrenderuj();
    await userEvent.type(screen.getByLabelText("Tytuł"), "  Algebra ");
    await userEvent.click(screen.getByRole("button", { name: "Studia" }));
    await userEvent.type(screen.getByLabelText(/Notatka/), "Rozdział 3");
    await userEvent.click(
      screen.getByRole("switch", { name: "Przypomnienie" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(createBlock).toHaveBeenCalledWith({
      title: "Algebra",
      categoryId: "c1",
      date: "2026-11-17",
      startMin: 600,
      durationMin: 60,
      recurrence: null,
      note: "Rozdział 3",
      remind: false,
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("błąd akcji pokazuje komunikat i nie zamyka okna", async () => {
    createBlock.mockResolvedValue({
      ok: false,
      message: "Nowe powtarzanie musi obejmować ten dzień.",
    });
    const { onSaved } = wyrenderuj("create", { ...NOWY, title: "X" });
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(
      await screen.findByText("Nowe powtarzanie musi obejmować ten dzień."),
    ).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("„+ Nowa” otwiera okno kategorii; po dodaniu wraca okno bloku z nową kategorią i tytułem", async () => {
    createCategory.mockResolvedValue({ ok: true, id: "c9" });
    wyrenderuj();
    await userEvent.type(screen.getByLabelText("Tytuł"), "Hiszpański");
    await userEvent.click(screen.getByRole("button", { name: "+ Nowa" }));
    expect(
      screen.getByRole("dialog", { name: "Nowa kategoria" }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Nazwa"), "Języki");
    await userEvent.click(
      screen.getByRole("button", { name: "Dodaj kategorię" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Nowy blok" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tytuł")).toHaveValue("Hiszpański");
    expect(screen.getByRole("button", { name: "Języki" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("Anuluj w oknie kategorii wraca do okna bloku", async () => {
    wyrenderuj("create", { ...NOWY, title: "Zostaje" });
    await userEvent.click(screen.getByRole("button", { name: "+ Nowa" }));
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(
      await screen.findByRole("dialog", { name: "Nowy blok" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Tytuł")).toHaveValue("Zostaje");
  });

  it("edycja bloku cyklicznego: „Zapisz blok” otwiera zakres; „To i następne” woła changeOccurrence", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    const { onSaved } = wyrenderuj("edit", CYKLICZNY);
    expect(
      screen.getByRole("dialog", { name: "Edytuj blok" }),
    ).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText("Tytuł"));
    await userEvent.type(screen.getByLabelText("Tytuł"), "rhytm — UI");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(changeOccurrence).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", {
        name: "Zmieniasz blok, który się powtarza",
      }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/To i następne/));
    await userEvent.click(
      screen.getByRole("button", { name: "Zapisz zmianę" }),
    );
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-17",
      scope: "following",
      patch: { title: "rhytm — UI" },
    });
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
  });

  it("Anuluj w oknie zakresu nic nie zapisuje i wraca do formularza", async () => {
    wyrenderuj("edit", CYKLICZNY);
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(changeOccurrence).not.toHaveBeenCalled();
    expect(
      await screen.findByRole("dialog", { name: "Edytuj blok" }),
    ).toBeInTheDocument();
  });

  it("zmiana kategorii, notatki lub przypomnienia wyłącza „Tylko to wystąpienie”", async () => {
    wyrenderuj("edit", CYKLICZNY);
    await userEvent.click(screen.getByRole("button", { name: "Studia" }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(screen.getByLabelText(/Tylko to wystąpienie/)).toBeDisabled();
    expect(
      screen.getByText(
        "Kategoria, notatka i przypomnienie zmieniają się dla całej serii.",
      ),
    ).toBeInTheDocument();
  });

  it("sama zmiana godzin zostawia „Tylko to wystąpienie” dostępne", async () => {
    wyrenderuj("edit", CYKLICZNY);
    await userEvent.click(screen.getByRole("button", { name: "Od" }));
    await userEvent.click(screen.getByRole("button", { name: "11" }));
    await userEvent.click(screen.getByRole("button", { name: ":00" }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(screen.getByLabelText(/Tylko to wystąpienie/)).toBeEnabled();
  });

  it("edycja bloku jednorazowego zapisuje od razu, bez okna zakresu", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    wyrenderuj("edit", {
      ...NOWY,
      title: "Algebra",
      blockId: "b2",
      occurrenceDate: "2026-11-17",
    });
    await userEvent.type(screen.getByLabelText("Tytuł"), "!");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b2",
      date: "2026-11-17",
      scope: "all",
      patch: { title: "Algebra!" },
    });
  });

  it("Anuluj i ✕ wołają onCancel", async () => {
    const { onCancel } = wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    await userEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("blok 23:00–24:00 pokazuje „Do” 24:00 i zapisuje 60 minut", async () => {
    createBlock.mockResolvedValue({ ok: true });
    wyrenderuj("create", {
      ...NOWY,
      title: "Noc",
      startMin: 23 * 60,
      durationMin: 60,
    });
    expect(screen.getByRole("button", { name: "Do" })).toHaveTextContent(
      "24:00",
    );
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(createBlock).toHaveBeenCalledWith(
      expect.objectContaining({ startMin: 1380, durationMin: 60 }),
    );
  });

  it("edycja bloku 23:00–24:00 pokazuje 24:00", () => {
    wyrenderuj("edit", {
      ...NOWY,
      title: "Noc",
      startMin: 1380,
      durationMin: 60,
      blockId: "b3",
      occurrenceDate: "2026-11-17",
    });
    expect(screen.getByRole("button", { name: "Do" })).toHaveTextContent(
      "24:00",
    );
  });

  it("zmiana dnia + „Wszystkie wystąpienia” przekazuje nową datę w patchu", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    wyrenderuj("edit", CYKLICZNY);
    await userEvent.click(screen.getByRole("button", { name: "Dzień" }));
    await userEvent.click(screen.getByRole("button", { name: "18" }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    await userEvent.click(screen.getByLabelText(/Wszystkie wystąpienia/));
    await userEvent.click(
      screen.getByRole("button", { name: "Zapisz zmianę" }),
    );
    expect(changeOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "all",
        date: "2026-11-17",
        patch: expect.objectContaining({ date: "2026-11-18" }),
      }),
    );
  });

  it("podwójne kliknięcie „Zapisz blok” woła createBlock raz", async () => {
    let koniec: (v: { ok: true }) => void = () => {};
    createBlock.mockReturnValue(new Promise((r) => (koniec = r)));
    wyrenderuj("create", { ...NOWY, title: "X" });
    const zapisz = screen.getByRole("button", { name: "Zapisz blok" });
    await userEvent.dblClick(zapisz);
    expect(createBlock).toHaveBeenCalledTimes(1);
    koniec({ ok: true });
  });

  it("zmiana dnia poza pierwszym wystąpieniem wyłącza „To i następne” z podpowiedzią", async () => {
    wyrenderuj("edit", CYKLICZNY);
    await userEvent.click(screen.getByRole("button", { name: "Dzień" }));
    await userEvent.click(screen.getByRole("button", { name: "18" }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(screen.getByLabelText(/To i następne/)).toBeDisabled();
    expect(screen.getByLabelText(/Tylko to wystąpienie/)).toBeEnabled();
    expect(
      screen.getByText(
        "Zmiana dnia działa dla tego wystąpienia albo dla całej serii.",
      ),
    ).toBeInTheDocument();
  });

  it("zmiana dnia na pierwszym wystąpieniu zostawia „To i następne” dostępne", async () => {
    wyrenderuj("edit", { ...CYKLICZNY, firstOccurrence: true });
    await userEvent.click(screen.getByRole("button", { name: "Dzień" }));
    await userEvent.click(screen.getByRole("button", { name: "18" }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(screen.getByLabelText(/To i następne/)).toBeEnabled();
  });
  it("zmiana dnia w serii codziennej wyłącza „To i następne” i „Wszystkie” z podpowiedzią", async () => {
    wyrenderuj("edit", {
      ...CYKLICZNY,
      recurrence: { freq: "daily" },
      firstOccurrence: true,
    });
    await userEvent.click(screen.getByRole("button", { name: "Dzień" }));
    await userEvent.click(screen.getByRole("button", { name: "18" }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz blok" }));
    expect(screen.getByLabelText(/Tylko to wystąpienie/)).toBeEnabled();
    expect(screen.getByLabelText(/To i następne/)).toBeDisabled();
    expect(screen.getByLabelText(/Wszystkie wystąpienia/)).toBeDisabled();
    expect(
      screen.getByText(
        "Zmiana dnia działa dla tego wystąpienia albo dla całej serii tygodniowej.",
      ),
    ).toBeInTheDocument();
  });
});
