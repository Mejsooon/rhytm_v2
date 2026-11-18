import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveRun } = vi.hoisted(() => ({ saveRun: vi.fn() }));
vi.mock("./actions", () => ({ saveRun }));

import { runKcal } from "./model";
import { RunDialog } from "./run-dialog";
import { bieg, daneSportu } from "./sport-test-data";

const { profile } = daneSportu();

function wyrenderuj(
  zmiany: Partial<Parameters<typeof RunDialog>[0]> = {},
  waga: number | null = 72,
) {
  const onClose = vi.fn();
  render(
    <RunDialog
      item={null}
      date="2026-11-17"
      start="16:00"
      profile={{ ...profile, weightKg: waga }}
      onClose={onClose}
      {...zmiany}
    />,
  );
  return { onClose };
}

beforeEach(() => {
  vi.clearAllMocks();
  saveRun.mockResolvedValue({ ok: true, id: "x" });
});

describe("RunDialog", () => {
  it("nowy bieg: Spokojny, data i godzina z parametrów, pokaż w kalendarzu włączone", () => {
    wyrenderuj();
    expect(screen.getByRole("dialog", { name: "Nowy bieg" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Spokojny" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Tempo" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Data" })).toHaveTextContent(
      "17.11.2026",
    );
    expect(screen.getByRole("button", { name: "Start" })).toHaveTextContent(
      "16:00",
    );
    expect(
      screen.getByRole("switch", {
        name: "Pokaż w kalendarzu głównym jako blok",
      }),
    ).toBeChecked();
  });

  it("10 km i 58:00 pokazuje tempo i kcal na żywo", async () => {
    wyrenderuj();
    await userEvent.type(screen.getByLabelText("Dystans (km)"), "10");
    await userEvent.type(screen.getByLabelText("Czas"), "58:00");
    expect(screen.getByTestId("tempo")).toHaveTextContent("5:48 /km");
    expect(screen.getByTestId("kcal")).toHaveTextContent(
      `≈ ${runKcal(10, 3480, 72)}`,
    );
  });

  it("bez wagi w profilu kcal to „—”", async () => {
    wyrenderuj({}, null);
    await userEvent.type(screen.getByLabelText("Dystans (km)"), "10");
    await userEvent.type(screen.getByLabelText("Czas"), "58:00");
    expect(screen.getByTestId("tempo")).toHaveTextContent("5:48 /km");
    expect(screen.getByTestId("kcal")).toHaveTextContent("—");
  });

  it("bez czasu przycisk zapisuje plan", async () => {
    const { onClose } = wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: "Tempo" }));
    await userEvent.type(screen.getByLabelText("Dystans (km)"), "10,5");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz bieg" }));
    expect(saveRun).toHaveBeenCalledWith({
      kind: "tempo",
      date: "2026-11-17",
      start: "16:00",
      distanceKm: 10.5,
      durationS: null,
      difficulty: null,
      note: "",
      showInCalendar: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("z czasem zapisuje sekundy, trudność i notatkę", async () => {
    wyrenderuj();
    await userEvent.type(screen.getByLabelText("Dystans (km)"), "10");
    await userEvent.type(screen.getByLabelText("Czas"), "1:02:05");
    await userEvent.click(screen.getByRole("button", { name: "7" }));
    await userEvent.type(screen.getByLabelText(/Notatka/), "deszcz");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz bieg" }));
    expect(saveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        distanceKm: 10,
        durationS: 3725,
        difficulty: 7,
        note: "deszcz",
      }),
    );
  });

  it("zły zapis czasu zostaje w oknie i nie woła serwera", async () => {
    const { onClose } = wyrenderuj();
    await userEvent.type(screen.getByLabelText("Dystans (km)"), "10");
    await userEvent.type(screen.getByLabelText("Czas"), "58");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz bieg" }));
    expect(saveRun).not.toHaveBeenCalled();
    expect(
      screen.getByText("Podaj czas jako h:mm:ss albo mm:ss, np. 58:00."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("edycja ładuje dane biegu i zapisuje z id", async () => {
    const item = bieg("a1000000-0000-4000-8000-000000000015", "2026-11-15", {
      title: "Długi bieg",
      runKind: "long",
      startMin: 9 * 60,
      distanceKm: 12,
      durationS: 4212,
      difficulty: 7,
      note: "Nogi dobrze.",
      showInCalendar: false,
    });
    wyrenderuj({ item, date: item.date, start: "09:00" });
    expect(screen.getByRole("dialog", { name: "Edytuj bieg" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Długi" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText("Dystans (km)")).toHaveValue("12,0");
    expect(screen.getByLabelText("Czas")).toHaveValue("1:10:12");
    expect(screen.getByRole("button", { name: "7" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByLabelText(/Notatka/)).toHaveValue("Nogi dobrze.");
    expect(
      screen.getByRole("switch", { name: /kalendarzu/ }),
    ).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Zapisz bieg" }));
    expect(saveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "a1000000-0000-4000-8000-000000000015",
        kind: "long",
        date: "2026-11-15",
        start: "09:00",
        distanceKm: 12,
        durationS: 4212,
        showInCalendar: false,
      }),
    );
  });

  it("plan: „Uzupełnij dane” ma własny tytuł", () => {
    const item = bieg("a1000000-0000-4000-8000-000000000017", "2026-11-17", {
      planned: true,
      distanceKm: 10,
    });
    wyrenderuj({ item, date: item.date, start: "16:00" });
    expect(
      screen.getByRole("dialog", { name: "Uzupełnij dane biegu" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Czas")).toHaveValue("");
  });

  it("błąd serwera zostaje w oknie, z błędem przy polu", async () => {
    saveRun.mockResolvedValue({
      ok: false,
      message: "Dystans musi być większy od 0 i nie większy niż 300 km.",
      field: "distanceKm",
    });
    const { onClose } = wyrenderuj();
    await userEvent.type(screen.getByLabelText("Dystans (km)"), "0");
    await userEvent.type(screen.getByLabelText("Czas"), "58:00");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz bieg" }));
    expect(
      await screen.findByText(
        "Dystans musi być większy od 0 i nie większy niż 300 km.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Nowy bieg" })).toBeVisible();
  });

  it("błąd bez pola i wyjątek pokazują komunikat ogólny", async () => {
    saveRun.mockRejectedValue(new Error("sieć"));
    const { onClose } = wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: "Zapisz bieg" }));
    expect(
      await screen.findByText("Nie udało się zapisać. Spróbuj ponownie."),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
