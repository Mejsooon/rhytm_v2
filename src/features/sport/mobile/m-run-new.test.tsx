import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveRun } = vi.hoisted(() => ({ saveRun: vi.fn() }));
vi.mock("../actions", () => ({ saveRun }));

import type { SportItem } from "../model";
import { bieg, daneSportu } from "../sport-test-data";
import { MRunNew } from "./m-run-new";

const profil = daneSportu().profile;
const onClose = vi.fn();
const ID = "a1000000-0000-4000-8000-000000000015";

function pokaz(
  item: SportItem | null = null,
  date = "2026-11-17",
  start = "16:00",
) {
  render(
    <MRunNew
      item={item}
      date={date}
      start={start}
      today="2026-11-17"
      profile={profil}
      onClose={onClose}
    />,
  );
  return screen.getByRole("dialog");
}

const dystans = () => screen.getByRole("textbox", { name: "Dystans (km)" });
const czas = () => screen.getByRole("textbox", { name: "Czas" });
const tempo = () => screen.getByTestId("tempo");

beforeEach(() => {
  vi.clearAllMocks();
  saveRun.mockResolvedValue({ ok: true, id: "nowy" });
});

describe("MRunNew", () => {
  it("nagłówek Anuluj / Nowy bieg / Zapisz, wartości z makiety i tempo liczone", async () => {
    const okno = pokaz();
    expect(okno).toHaveAccessibleName("Nowy bieg");
    expect(within(okno).getByRole("button", { name: "Zapisz" })).toBeVisible();
    expect(dystans()).toHaveValue("10,0");
    expect(czas()).toHaveValue("52:00");
    // 3120 s / 10 km = 5:12
    expect(tempo()).toHaveTextContent("5:12 /km");
    expect(screen.getByRole("button", { name: "Spokojny" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("chipy rodzaju", async () => {
    pokaz();
    expect(
      screen
        .getAllByRole("button", { pressed: false })
        .map((b) => b.textContent),
    ).toEqual(
      expect.arrayContaining(["Tempo", "Interwały", "Długi", "Zawody"]),
    );
    await userEvent.click(screen.getByRole("button", { name: "Interwały" }));
    expect(screen.getByRole("button", { name: "Interwały" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Spokojny" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("−/+ dystansu (0,5 km) i czasu (1 min) przeliczają tempo", async () => {
    pokaz();
    await userEvent.click(screen.getByRole("button", { name: "Więcej" }));
    expect(dystans()).toHaveValue("10,5");
    await userEvent.click(screen.getByRole("button", { name: "Mniej" }));
    await userEvent.click(screen.getByRole("button", { name: "Mniej" }));
    expect(dystans()).toHaveValue("9,5");
    await userEvent.click(screen.getByRole("button", { name: "Dłużej" }));
    expect(czas()).toHaveValue("53:00");
    await userEvent.click(screen.getByRole("button", { name: "Krócej" }));
    await userEvent.click(screen.getByRole("button", { name: "Krócej" }));
    expect(czas()).toHaveValue("51:00");
    // 3060 / 9,5 = 322,1 → 5:22
    expect(tempo()).toHaveTextContent("5:22 /km");
  });

  it("dolne granice: 0,5 km i 1 minuta", async () => {
    pokaz({ ...bieg(ID, "2026-11-15"), distanceKm: 0.5, durationS: 60 });
    await userEvent.click(screen.getByRole("button", { name: "Mniej" }));
    await userEvent.click(screen.getByRole("button", { name: "Krócej" }));
    expect(dystans()).toHaveValue("0,5");
    expect(czas()).toHaveValue("01:00");
  });

  it("wartości można wpisać; zły zapis daje „—” zamiast tempa", async () => {
    pokaz();
    await userEvent.clear(dystans());
    await userEvent.type(dystans(), "10,37");
    await userEvent.clear(czas());
    await userEvent.type(czas(), "51:51");
    // 3111 / 10,37 = 300 → 5:00
    expect(tempo()).toHaveTextContent("5:00 /km");
    await userEvent.clear(czas());
    await userEvent.type(czas(), "abc");
    expect(tempo()).toHaveTextContent("—");
  });

  it("trudność 1–10 z opisem wg progów makiety", async () => {
    pokaz();
    expect(screen.getByText("Trudność")).toBeInTheDocument();
    const opisy: [number, string][] = [
      [1, "lekko"],
      [3, "lekko"],
      [4, "umiarkowanie"],
      [6, "umiarkowanie"],
      [7, "ciężko"],
      [8, "ciężko"],
      [9, "maksymalnie"],
      [10, "maksymalnie"],
    ];
    for (const [n, opis] of opisy) {
      await userEvent.click(
        screen.getByRole("button", { name: `Trudność ${n} z 10` }),
      );
      expect(screen.getByText(`Trudność · ${opis}`)).toBeInTheDocument();
    }
    // Ponowne stuknięcie czyści (trudność jest opcjonalna)
    await userEvent.click(
      screen.getByRole("button", { name: "Trudność 10 z 10" }),
    );
    expect(screen.getByText("Trudność")).toBeInTheDocument();
  });

  it("dzień i godzina, przełącznik kalendarza i notatka", async () => {
    pokaz();
    expect(screen.getByRole("button", { name: /Data/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Start/ })).toBeInTheDocument();
    expect(
      screen.getByRole("switch", { name: "Pokaż w kalendarzu głównym" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByPlaceholderText("Jak poszło?")).toBeInTheDocument();
  });

  it("Zapisz wysyła bieg i zamyka", async () => {
    pokaz();
    await userEvent.click(screen.getByRole("button", { name: "Tempo" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Trudność 7 z 10" }),
    );
    await userEvent.click(
      screen.getByRole("switch", { name: "Pokaż w kalendarzu głównym" }),
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "Notatka" }),
      "Dobrze",
    );
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(saveRun).toHaveBeenCalledWith({
      kind: "tempo",
      date: "2026-11-17",
      start: "16:00",
      distanceKm: 10,
      durationS: 3120,
      difficulty: 7,
      note: "Dobrze",
      showInCalendar: false,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("bieg w przyszłości startuje bez czasu i zapisuje się jako plan", async () => {
    pokaz(null, "2026-11-20", "07:00");
    expect(czas()).toHaveValue("");
    expect(tempo()).toHaveTextContent("—");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(saveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-11-20",
        start: "07:00",
        distanceKm: 10,
        durationS: null,
      }),
    );
  });

  it("puste pole czasu: „+” wpisuje wartość z makiety", async () => {
    pokaz(null, "2026-11-20");
    await userEvent.click(screen.getByRole("button", { name: "Dłużej" }));
    expect(czas()).toHaveValue("52:00");
  });

  it("zły zapis dystansu zatrzymuje zapis z komunikatem", async () => {
    pokaz();
    await userEvent.clear(dystans());
    await userEvent.type(dystans(), "dużo");
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(saveRun).not.toHaveBeenCalled();
    expect(
      screen.getByText("Podaj dystans w km, np. 10,5."),
    ).toBeInTheDocument();
  });

  it("błąd serwera zostaje w arkuszu", async () => {
    saveRun.mockResolvedValue({
      ok: false,
      message: "Dystans musi być większy od 0 i nie większy niż 300 km.",
      field: "distanceKm",
    });
    pokaz();
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(
      await screen.findByText(
        "Dystans musi być większy od 0 i nie większy niż 300 km.",
      ),
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // Arkusz odblokowany po błędzie
    expect(screen.getByRole("button", { name: "Zapisz" })).toBeEnabled();
  });

  it("w trakcie zapisu Zapisz i Anuluj są zablokowane", async () => {
    let zakoncz!: (v: { ok: true }) => void;
    saveRun.mockReturnValue(new Promise((r) => (zakoncz = r)));
    pokaz();
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(screen.getByRole("button", { name: "Zapisz" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeDisabled();
    await act(async () => zakoncz({ ok: true }));
    expect(onClose).toHaveBeenCalled();
  });

  it("edycja: wartości z biegu, tytuł „Edytuj bieg”, id w zapisie", async () => {
    const okno = pokaz(
      bieg(ID, "2026-11-15", {
        runKind: "long",
        title: "Długi bieg",
        startMin: 9 * 60,
        distanceKm: 12,
        durationS: 4212,
        difficulty: 7,
        note: "Nogi dobrze",
        showInCalendar: false,
      }),
      "2026-11-15",
      "09:00",
    );
    expect(okno).toHaveAccessibleName("Edytuj bieg");
    expect(dystans()).toHaveValue("12,0");
    expect(czas()).toHaveValue("1:10:12");
    expect(screen.getByRole("button", { name: "Długi" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("Trudność · ciężko")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(saveRun).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ID,
        kind: "long",
        date: "2026-11-15",
        start: "09:00",
        distanceKm: 12,
        durationS: 4212,
        note: "Nogi dobrze",
        showInCalendar: false,
      }),
    );
  });

  it("plan bez danych: tytuł „Uzupełnij dane biegu”", () => {
    const okno = pokaz(
      bieg(ID, "2026-11-17", { planned: true, distanceKm: 10 }),
    );
    expect(okno).toHaveAccessibleName("Uzupełnij dane biegu");
    expect(czas()).toHaveValue("");
  });
});
