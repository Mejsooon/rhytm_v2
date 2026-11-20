import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, saveTemplate, deleteTemplate } = vi.hoisted(() => ({
  push: vi.fn(),
  saveTemplate: vi.fn(),
  deleteTemplate: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("./actions", () => ({ saveTemplate, deleteTemplate }));

import { daneSportu, SZABLON_PUSH } from "./sport-test-data";
import { TemplateEditor, type TemplateEditorData } from "./template-editor";

const WYC = "Wyciskanie na ławce";
const POMPKI = "Pompki na poręczach";

function dane(nowy = false): TemplateEditorData {
  const s = daneSportu();
  return {
    profile: s.profile,
    exercises: s.exercises,
    template: nowy ? null : s.templates[0],
  };
}

const zapisz = () =>
  screen.getAllByRole("button", { name: "Zapisz szablon" })[0];
// Nazwy ćwiczeń w kolejności wierszy tabeli
const kolejnosc = () =>
  screen.getAllByTestId("wiersz-cwiczenia").map((w) => w.dataset.name);

beforeEach(() => {
  vi.clearAllMocks();
  saveTemplate.mockResolvedValue({ ok: true, id: SZABLON_PUSH });
  deleteTemplate.mockResolvedValue({ ok: true });
});

describe("TemplateEditor — nowy szablon", () => {
  it("ścieżka „Nowy szablon”, nagłówek, brak ćwiczeń i brak „Usuń szablon”", () => {
    render(<TemplateEditor data={dane(true)} />);
    expect(
      screen.getByText("Nowy szablon", { selector: "span" }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Szablony treningów" }),
    ).toHaveAttribute("href", "/sport/szablony");
    expect(
      screen.getByRole("heading", { name: "Nowy szablon" }),
    ).toBeInTheDocument();
    expect(screen.getByText("0 ćwiczeń · 0 serii")).toBeInTheDocument();
    expect(
      screen.getByText("Brak ćwiczeń — dodaj pierwsze poniżej."),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Usuń szablon" }),
    ).not.toBeInTheDocument();
  });

  it("„Zapisz szablon” nieaktywny bez nazwy lub ćwiczeń; klik pokazuje „Podaj nazwę.”", async () => {
    render(<TemplateEditor data={dane(true)} />);
    expect(zapisz()).toHaveAttribute("aria-disabled", "true");
    await userEvent.click(zapisz());
    expect(screen.getByText("Podaj nazwę.")).toBeInTheDocument();
    expect(saveTemplate).not.toHaveBeenCalled();

    // Sama nazwa nie wystarczy
    await userEvent.type(screen.getByLabelText("Nazwa szablonu"), "Push");
    expect(zapisz()).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText("Podaj nazwę.")).not.toBeInTheDocument();
  });

  it("nowe ćwiczenie z dymka: 3 serie, „8–10”, „2:00”", async () => {
    render(<TemplateEditor data={dane(true)} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Ćwiczenie" }));
    await userEvent.click(
      await screen.findByRole("button", { name: /^Hip thrust/ }),
    );
    expect(kolejnosc()).toEqual(["Hip thrust"]);
    expect(screen.getByTestId("serie-Hip thrust")).toHaveTextContent("3");
    expect(screen.getByLabelText("Hip thrust: powtórzenia")).toHaveValue(
      "8–10",
    );
    expect(screen.getByLabelText("Hip thrust: przerwa")).toHaveValue("2:00");
    // Pola powtórzeń i przerwy mają ≥ 44 px na telefonie
    expect(screen.getByLabelText("Hip thrust: powtórzenia")).toHaveClass(
      "max-[799px]:h-11",
    );
    expect(screen.getByLabelText("Hip thrust: przerwa")).toHaveClass(
      "max-[799px]:h-11",
    );
    expect(screen.getByText("1 ćwiczenie · 3 serie")).toBeInTheDocument();
  });

  it("godzina startu widoczna tylko przy wybranych dniach (domyślnie 17:00)", async () => {
    render(<TemplateEditor data={dane(true)} />);
    expect(
      screen.queryByRole("button", { name: "Godzina startu" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Wt" }));
    expect(screen.getByRole("button", { name: "Wt" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // Zaznaczony dzień wypełniony na czarno jak w makiecie
    expect(screen.getByRole("button", { name: "Wt" })).toHaveClass(
      "bg-primary",
      "text-primary-foreground",
    );
    expect(
      screen.getByRole("button", { name: "Godzina startu" }),
    ).toHaveTextContent("17:00");
    await userEvent.click(screen.getByRole("button", { name: "Wt" }));
    expect(
      screen.queryByRole("button", { name: "Godzina startu" }),
    ).not.toBeInTheDocument();
  });

  it("zapis nowego: dane szablonu i powrót do listy z komunikatem „Dodano”", async () => {
    render(<TemplateEditor data={dane(true)} />);
    await userEvent.type(screen.getByLabelText("Nazwa szablonu"), " Nogi ");
    await userEvent.click(screen.getByRole("button", { name: "Nd" }));
    await userEvent.click(screen.getByRole("button", { name: "Pn" }));
    await userEvent.click(screen.getByRole("button", { name: "+ Ćwiczenie" }));
    await userEvent.click(
      await screen.findByRole("button", { name: /^Hip thrust/ }),
    );
    const przerwa = screen.getByLabelText("Hip thrust: przerwa");
    await userEvent.clear(przerwa);
    await userEvent.type(przerwa, "1:30");
    expect(zapisz()).toHaveAttribute("aria-disabled", "false");
    await userEvent.click(zapisz());

    expect(saveTemplate).toHaveBeenCalledWith({
      name: "Nogi",
      weekdays: [1, 7],
      startTime: "17:00",
      items: [
        {
          exerciseName: "Hip thrust",
          setsCount: 3,
          repsText: "8–10",
          restS: 90,
        },
      ],
    });
    expect(push).toHaveBeenCalledWith(
      `/sport/szablony?komunikat=dodano&nazwa=${encodeURIComponent("Nogi")}`,
    );
  });
});

describe("TemplateEditor — istniejący szablon", () => {
  it("ścieżka „Edycja: X” na żywo, wypełnione pola, przerwa jako m:ss", async () => {
    render(<TemplateEditor data={dane()} />);
    expect(screen.getByText("Edycja: Push")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Edytuj szablon" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nazwa szablonu")).toHaveValue("Push");
    expect(screen.getByRole("button", { name: "Cz" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Godzina startu" }),
    ).toHaveTextContent("15:00");
    expect(kolejnosc()).toEqual([WYC, POMPKI]);
    expect(screen.getByLabelText(`${WYC}: przerwa`)).toHaveValue("2:00");
    expect(screen.getByLabelText(`${POMPKI}: przerwa`)).toHaveValue("1:30");
    expect(screen.getByText("2 ćwiczenia · 7 serii")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Nazwa szablonu"));
    expect(screen.getByText("Edycja: bez nazwy")).toBeInTheDocument();
  });

  it("serie −/+ w zakresie 1–10", async () => {
    render(<TemplateEditor data={dane()} />);
    const serie = screen.getByTestId(`serie-${WYC}`);
    expect(serie).toHaveTextContent("4");
    const wiecej = screen.getByRole("button", { name: `${WYC}: więcej serii` });
    for (let i = 0; i < 8; i++) await userEvent.click(wiecej);
    expect(serie).toHaveTextContent("10");
    const mniej = screen.getByRole("button", { name: `${WYC}: mniej serii` });
    for (let i = 0; i < 12; i++) await userEvent.click(mniej);
    expect(serie).toHaveTextContent("1");
  });

  it("↑ ↓ ✕ zmieniają kolejność i usuwają; skrajne strzałki nieaktywne", async () => {
    render(<TemplateEditor data={dane()} />);
    expect(
      screen.getByRole("button", { name: `Przesuń ${WYC} w górę` }),
    ).toHaveAttribute("aria-disabled", "true");
    expect(
      screen.getByRole("button", { name: `Przesuń ${POMPKI} w dół` }),
    ).toHaveAttribute("aria-disabled", "true");

    await userEvent.click(
      screen.getByRole("button", { name: `Przesuń ${WYC} w dół` }),
    );
    expect(kolejnosc()).toEqual([POMPKI, WYC]);
    await userEvent.click(
      screen.getByRole("button", { name: `Przesuń ${WYC} w górę` }),
    );
    expect(kolejnosc()).toEqual([WYC, POMPKI]);
    // Nieaktywna strzałka nic nie zmienia
    await userEvent.click(
      screen.getByRole("button", { name: `Przesuń ${WYC} w górę` }),
    );
    expect(kolejnosc()).toEqual([WYC, POMPKI]);

    await userEvent.click(screen.getByRole("button", { name: `Usuń ${WYC}` }));
    expect(kolejnosc()).toEqual([POMPKI]);
    expect(
      within(screen.getByTestId("wiersz-cwiczenia")).getByText("1"),
    ).toBeInTheDocument();
  });

  it("zapis zmian: id, kolejność, przerwy w sekundach; komunikat „zapisano”", async () => {
    render(<TemplateEditor data={dane()} />);
    await userEvent.click(
      screen.getByRole("button", { name: `Przesuń ${POMPKI} w górę` }),
    );
    await userEvent.click(zapisz());
    expect(saveTemplate).toHaveBeenCalledWith({
      id: SZABLON_PUSH,
      name: "Push",
      weekdays: [4],
      startTime: "15:00",
      items: [
        {
          exerciseName: POMPKI,
          setsCount: 3,
          repsText: "8–10",
          restS: 90,
        },
        { exerciseName: WYC, setsCount: 4, repsText: "5", restS: 120 },
      ],
    });
    expect(push).toHaveBeenCalledWith(
      `/sport/szablony?komunikat=zapisano&nazwa=${encodeURIComponent("Push")}`,
    );
  });

  it("zła przerwa blokuje zapis z komunikatem", async () => {
    render(<TemplateEditor data={dane()} />);
    const przerwa = screen.getByLabelText(`${WYC}: przerwa`);
    await userEvent.clear(przerwa);
    await userEvent.type(przerwa, "dwie");
    await userEvent.click(zapisz());
    expect(saveTemplate).not.toHaveBeenCalled();
    expect(przerwa).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByText("Przerwa w formacie m:ss, np. 2:00."),
    ).toBeInTheDocument();
  });

  it("błąd serwera zostaje na ekranie, bez przejścia", async () => {
    saveTemplate.mockResolvedValue({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    render(<TemplateEditor data={dane()} />);
    await userEvent.click(zapisz());
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("„Usuń szablon” usuwa i wraca z komunikatem „usunięto”", async () => {
    render(<TemplateEditor data={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: "Usuń szablon" }));
    expect(deleteTemplate).toHaveBeenCalledWith(SZABLON_PUSH);
    expect(push).toHaveBeenCalledWith(
      `/sport/szablony?komunikat=usunieto&nazwa=${encodeURIComponent("Push")}`,
    );
  });

  it("„Anuluj” wraca do listy", () => {
    render(<TemplateEditor data={dane()} />);
    for (const a of screen.getAllByRole("link", { name: "Anuluj" }))
      expect(a).toHaveAttribute("href", "/sport/szablony");
  });
});
