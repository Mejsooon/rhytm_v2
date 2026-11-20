import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveSleepLog } = vi.hoisted(() => ({ saveSleepLog: vi.fn() }));
vi.mock("./actions", () => ({ saveSleepLog }));

import type { SleepLog } from "./sleep";
import { SleepDialog } from "./sleep-dialog";

const LOGI: SleepLog[] = [
  {
    date: "2026-11-16",
    sleptAt: "22:30",
    wokeAt: "06:30",
    feeling: 5,
    tags: ["Trening"],
    note: "dobrze",
  },
  {
    date: "2026-11-17",
    sleptAt: "23:48",
    wokeAt: "07:00",
    feeling: 4,
    tags: [],
    note: null,
  },
];

function wyrenderuj(
  opcje: { date?: string; existing?: SleepLog; clock?: "24" | "12" } = {},
) {
  // existing wskazuje dzień wpisu — okno samo znajduje go w logs

  const onOpenChange = vi.fn();
  render(
    <SleepDialog
      open
      onOpenChange={onOpenChange}
      date={
        (opcje.existing?.date ??
          opcje.date ??
          "2026-11-17") as `${number}-${number}-${number}`
      }
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
  it("„Anuluj” w stopce bez ramki (ghost), na telefonie 44 px", () => {
    wyrenderuj();
    const anuluj = screen.getByRole("button", { name: "Anuluj" });
    expect(anuluj).toHaveClass("border-transparent", "bg-transparent", "hover:bg-accent");
    expect(anuluj.className).not.toContain("border-input");
    expect(anuluj).toHaveClass("max-[799px]:h-11");
  });

  it("kolumna „Data pobudki” nie węższa niż data z dniem tygodnia (wyzwalacz .igroup nie wychodzi na „Zasnąłem”)", () => {
    wyrenderuj();
    const siatka = screen.getByRole("button", { name: "Data pobudki" }).parentElement
      ?.parentElement as HTMLElement;
    expect(siatka).toHaveClass("grid-cols-[minmax(max-content,1fr)_minmax(0,1fr)_minmax(0,1fr)]");
  });

  it("tytuł z nocy i domyślne 23:00 → 07:00 dla nowego wpisu", () => {
    wyrenderuj({ date: "2026-11-15" });
    expect(
      screen.getByRole("dialog", { name: "Wpis snu" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Noc z soboty na niedzielę")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zasnąłem" })).toHaveTextContent(
      "23:00",
    );
    expect(screen.getByRole("button", { name: "Wstałem" })).toHaveTextContent(
      "07:00",
    );
    expect(screen.getByText("8:00")).toBeInTheDocument();
    expect(
      screen.getByText("100% celu 8:00 · powyżej celu"),
    ).toBeInTheDocument();
  });

  it("czas na żywo: 23:48 → 07:00 daje 7:12 i 90% celu", () => {
    wyrenderuj({ existing: LOGI[1] });
    expect(screen.getByText("7:12")).toBeInTheDocument();
    expect(
      screen.getByText("90% celu 8:00 · brakuje 48 min"),
    ).toBeInTheDocument();
  });

  it("godziny w formacie 12 h", () => {
    wyrenderuj({ existing: LOGI[1], clock: "12" });
    expect(screen.getByRole("button", { name: "Zasnąłem" })).toHaveTextContent(
      "11:48 PM",
    );
  });

  it("zmiana daty pobudki na dzień z wpisem ładuje jego wartości", async () => {
    const u = userEvent.setup();
    wyrenderuj({ existing: LOGI[1] });
    await u.click(screen.getByRole("button", { name: "Data pobudki" }));
    await u.click(screen.getByRole("button", { name: "16" }));
    expect(screen.getByRole("button", { name: "Zasnąłem" })).toHaveTextContent(
      "22:30",
    );
    expect(screen.getByRole("button", { name: "Wstałem" })).toHaveTextContent(
      "06:30",
    );
    expect(screen.getByRole("radio", { name: /Super/ })).toBeChecked();
    expect(screen.getByRole("button", { name: "Trening" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/Notatka/)).toHaveValue("dobrze");
    expect(
      screen.getByText("Noc z niedzieli na poniedziałek"),
    ).toBeInTheDocument();
  });

  it("zmiana daty z dnia z wpisem na dzień bez wpisu przywraca domyślne 23:00 → 07:00", async () => {
    const u = userEvent.setup();
    wyrenderuj({ existing: LOGI[1] });
    await u.click(screen.getByRole("radio", { name: /Dobrze/ }));
    await u.click(screen.getByRole("button", { name: "Data pobudki" }));
    await u.click(screen.getByRole("button", { name: "15" }));
    expect(screen.getByRole("button", { name: "Zasnąłem" })).toHaveTextContent(
      "23:00",
    );
    expect(screen.getByRole("button", { name: "Wstałem" })).toHaveTextContent(
      "07:00",
    );
    expect(
      screen
        .getByRole("radiogroup", { name: "Samopoczucie" })
        .querySelector("[aria-checked=true]"),
    ).toBeNull();
  });

  it("dni z przyszłości są zablokowane w kalendarzu", async () => {
    const u = userEvent.setup();
    wyrenderuj({ existing: LOGI[1] });
    await u.click(screen.getByRole("button", { name: "Data pobudki" }));
    expect(screen.getByRole("button", { name: "18" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "16" })).toBeEnabled();
  });

  it("dni starsze niż 60 dni (poza wczytanym snem) są zablokowane", async () => {
    // dziś 17.11 → najstarszy dozwolony dzień to 19.09 (dziś − 59)
    const u = userEvent.setup();
    wyrenderuj({ date: "2026-09-19" });
    await u.click(screen.getByRole("button", { name: "Data pobudki" }));
    expect(screen.getByText("wrzesień 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "18" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "19" })).toBeEnabled();
  });

  it("samopoczucie 1–5 z etykietami, ponowny klik czyści", async () => {
    const u = userEvent.setup();
    wyrenderuj({ date: "2026-11-15" });
    const grupa = screen.getByRole("radiogroup", { name: "Samopoczucie" });
    for (const e of ["Źle", "Słabo", "OK", "Dobrze", "Super"]) {
      expect(
        within(grupa).getByRole("radio", { name: new RegExp(e) }),
      ).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Kawa po 16" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Stres" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await u.click(screen.getByRole("button", { name: "Kawa po 16" }));
    expect(screen.getByRole("button", { name: "Kawa po 16" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
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
    await waitFor(() =>
      expect(saveSleepLog).toHaveBeenCalledWith(
        expect.objectContaining({ feeling: null, tags: [], note: null }),
      ),
    );
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
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie można zapisać snu z przyszłości.",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeEnabled();
  });
});
