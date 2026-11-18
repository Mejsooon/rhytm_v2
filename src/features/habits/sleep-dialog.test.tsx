import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveSleepLog } = vi.hoisted(() => ({ saveSleepLog: vi.fn() }));
vi.mock("./actions", () => ({ saveSleepLog }));

import type { SleepLog } from "./sleep";
import { SleepDialog } from "./sleep-dialog";

const LOGI: SleepLog[] = [
  { date: "2026-11-16", sleptAt: "22:30", wokeAt: "06:30", feeling: 5, tags: ["Trening"], note: "dobrze" },
  { date: "2026-11-17", sleptAt: "23:48", wokeAt: "07:00", feeling: 4, tags: [], note: null },
];

function wyrenderuj(opcje: { date?: string; existing?: SleepLog; clock?: "24" | "12" } = {}) {
  const onOpenChange = vi.fn();
  render(
    <SleepDialog
      open
      onOpenChange={onOpenChange}
      date={(opcje.date ?? "2026-11-17") as `${number}-${number}-${number}`}
      existing={opcje.existing}
      logs={LOGI}
      goalMin={480}
      clock={opcje.clock ?? "24"}
      weekStart="mon"
      today="2026-11-17"
    />,
  );
  return { onOpenChange };
}

beforeEach(() => vi.clearAllMocks());

describe("SleepDialog", () => {
  it("tytuł z nocy i domyślne 23:00 → 07:00 dla nowego wpisu", () => {
    wyrenderuj({ date: "2026-11-15" });
    expect(screen.getByRole("dialog", { name: "Noc z soboty na niedzielę" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zasnąłem" })).toHaveTextContent("23:00");
    expect(screen.getByRole("button", { name: "Wstałem" })).toHaveTextContent("07:00");
    expect(screen.getByText("8:00")).toBeInTheDocument();
    expect(screen.getByText("100% celu 8:00 · powyżej celu")).toBeInTheDocument();
  });

  it("czas na żywo: 23:48 → 07:00 daje 7:12 i 90% celu", () => {
    wyrenderuj({ existing: LOGI[1] });
    expect(screen.getByText("7:12")).toBeInTheDocument();
    expect(screen.getByText("90% celu 8:00 · brakuje 48 min")).toBeInTheDocument();
  });

  it("godziny w formacie 12 h", () => {
    wyrenderuj({ existing: LOGI[1], clock: "12" });
    expect(screen.getByRole("button", { name: "Zasnąłem" })).toHaveTextContent("11:48 PM");
  });

  it("zmiana daty pobudki na dzień z wpisem ładuje jego wartości", async () => {
    const u = userEvent.setup();
    wyrenderuj({ existing: LOGI[1] });
    await u.click(screen.getByRole("button", { name: "Data pobudki" }));
    await u.click(screen.getByRole("button", { name: "16" }));
    expect(screen.getByRole("button", { name: "Zasnąłem" })).toHaveTextContent("22:30");
    expect(screen.getByRole("button", { name: "Wstałem" })).toHaveTextContent("06:30");
    expect(screen.getByRole("radio", { name: /Super/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Trening" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText(/Notatka/)).toHaveValue("dobrze");
    expect(screen.getByRole("dialog", { name: "Noc z niedzieli na poniedziałek" })).toBeInTheDocument();
  });

  it("dni z przyszłości są zablokowane w kalendarzu", async () => {
    const u = userEvent.setup();
    wyrenderuj({ existing: LOGI[1] });
    await u.click(screen.getByRole("button", { name: "Data pobudki" }));
    expect(screen.getByRole("button", { name: "18" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "16" })).toBeEnabled();
  });

  it("samopoczucie 1–5 z etykietami, ponowny klik czyści", async () => {
    const u = userEvent.setup();
    wyrenderuj({ date: "2026-11-15" });
    const grupa = screen.getByRole("radiogroup", { name: "Samopoczucie" });
    for (const e of ["Źle", "Słabo", "OK", "Dobrze", "Super"]) {
      expect(within(grupa).getByRole("radio", { name: new RegExp(e) })).toBeInTheDocument();
    }
    const dobrze = within(grupa).getByRole("radio", { name: /Dobrze/ });
    await u.click(dobrze);
    expect(dobrze).toBeChecked();
    await u.click(dobrze);
    expect(dobrze).not.toBeChecked();
  });

  it("chipy tagów są wielokrotnego wyboru", async () => {
    const u = userEvent.setup();
    wyrenderuj({ date: "2026-11-15" });
    await u.click(screen.getByRole("button", { name: "Kawa po 16" }));
    await u.click(screen.getByRole("button", { name: "Stres" }));
    expect(screen.getByRole("button", { name: "Kawa po 16" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Stres" })).toHaveAttribute("aria-pressed", "true");
    await u.click(screen.getByRole("button", { name: "Kawa po 16" }));
    expect(screen.getByRole("button", { name: "Kawa po 16" })).toHaveAttribute("aria-pressed", "false");
  });

  it("zapis woła saveSleepLog z dokładnym SleepInput i zamyka okno", async () => {
    const u = userEvent.setup();
    saveSleepLog.mockResolvedValue({ ok: true });
    const { onOpenChange } = wyrenderuj({ date: "2026-11-15" });
    await u.click(screen.getByRole("radio", { name: /OK/ }));
    await u.click(screen.getByRole("button", { name: "Trening" }));
    await u.type(screen.getByLabelText(/Notatka/), "kawa po 18");
    await u.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() =>
      expect(saveSleepLog).toHaveBeenCalledWith({
        date: "2026-11-15",
        sleptAt: "23:00",
        wokeAt: "07:00",
        feeling: 3,
        tags: ["Trening"],
        note: "kawa po 18",
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("pusta notatka idzie jako null", async () => {
    const u = userEvent.setup();
    saveSleepLog.mockResolvedValue({ ok: true });
    wyrenderuj({ date: "2026-11-15" });
    await u.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(saveSleepLog).toHaveBeenCalledWith(expect.objectContaining({ feeling: null, tags: [], note: null })));
  });

  it("błąd zostawia okno otwarte, w trakcie zapisu Anuluj i Esc nie działają", async () => {
    const u = userEvent.setup();
    let zakoncz!: (v: { ok: false; message: string }) => void;
    saveSleepLog.mockReturnValue(new Promise((r) => (zakoncz = r)));
    const { onOpenChange } = wyrenderuj({ existing: LOGI[1] });
    await u.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeDisabled();
    await u.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
    zakoncz({ ok: false, message: "Nie można zapisać snu z przyszłości." });
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie można zapisać snu z przyszłości.");
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeEnabled();
  });
});
