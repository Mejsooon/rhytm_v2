import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  push,
  replace,
  toastError,
  createGymSession,
  deleteSession,
  skipTemplateOccurrence,
  saveRun,
} = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  toastError: vi.fn(),
  createGymSession: vi.fn(),
  deleteSession: vi.fn(),
  skipTemplateOccurrence: vi.fn(),
  saveRun: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace }) }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("./actions", () => ({
  createGymSession,
  deleteSession,
  skipTemplateOccurrence,
  saveRun,
}));

import { bieg, daneSportu, SESJA_PUSH, SZABLON_PUSH } from "./sport-test-data";
import { SportView } from "./sport-view";

beforeEach(() => vi.clearAllMocks());

const kalendarz = () => screen.getByTestId("kalendarz-sportu");
const tabela = () => screen.getByRole("table");

describe("SportView", () => {
  it("nagłówek: ‹ Dziś ›, tytuł z miesiącem, filtr i przyciski", () => {
    render(<SportView data={daneSportu()} selectedKey={null} newGym={null} />);
    expect(screen.getByRole("heading", { name: "Sport" })).toBeInTheDocument();
    expect(screen.getByText("listopad 2026")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Poprzedni" })).toHaveAttribute(
      "href",
      "/sport?miesiac=2026-10",
    );
    expect(screen.getByRole("link", { name: "Następny" })).toHaveAttribute(
      "href",
      "/sport?miesiac=2026-12",
    );
    expect(screen.getByRole("link", { name: "Dziś" })).toHaveAttribute(
      "href",
      "/sport?miesiac=2026-11",
    );
    expect(
      screen.getByRole("radiogroup", { name: "Aktywność" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Zaplanowany, bez danych")).toBeInTheDocument();
  });

  it("filtr „Bieg” chowa treningi siłowe w kalendarzu i tabeli", async () => {
    render(<SportView data={daneSportu()} selectedKey={null} newGym={null} />);
    expect(
      within(kalendarz()).getByRole("button", { name: "Push, czw 12.11" }),
    ).toBeInTheDocument();
    expect(within(tabela()).getByText("Push")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Bieg" }));
    expect(
      within(kalendarz()).queryByRole("button", { name: "Push, czw 12.11" }),
    ).not.toBeInTheDocument();
    expect(
      within(kalendarz()).queryByRole("button", { name: "Push, czw 19.11" }),
    ).not.toBeInTheDocument();
    expect(within(tabela()).queryByText("Push")).not.toBeInTheDocument();
    expect(within(tabela()).queryByText("Pull")).not.toBeInTheDocument();
    expect(within(tabela()).getByText("Długi bieg")).toBeInTheDocument();
    // Σ tydz. liczy tylko widoczne treningi
    expect(screen.getByTestId("suma-2026-11-09")).toHaveTextContent("2 tr.");
    expect(screen.getByText("listopad · 3 wykonanych")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "Siłownia" }));
    expect(within(tabela()).queryByText("Długi bieg")).not.toBeInTheDocument();
    expect(within(tabela()).getByText("Push")).toBeInTheDocument();
  });

  it("`?wybrany=` otwiera dymek", () => {
    render(
      <SportView
        data={daneSportu()}
        selectedKey="s:a1000000-0000-4000-8000-000000000015"
        newGym={null}
      />,
    );
    expect(
      screen.getByRole("dialog", { name: "Długi bieg" }),
    ).toBeInTheDocument();
  });

  it("klik w trening otwiera dymek, drugi klik i Esc zamykają", async () => {
    render(<SportView data={daneSportu()} selectedKey={null} newGym={null} />);
    const chip = screen.getByRole("button", { name: "Długi bieg, nd 15.11" });
    await userEvent.click(chip);
    expect(
      screen.getByRole("dialog", { name: "Długi bieg" }),
    ).toBeInTheDocument();
    expect(chip).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(chip);
    expect(
      screen.queryByRole("dialog", { name: "Długi bieg" }),
    ).not.toBeInTheDocument();
    await userEvent.click(chip);
    await userEvent.keyboard("{Escape}");
    expect(
      screen.queryByRole("dialog", { name: "Długi bieg" }),
    ).not.toBeInTheDocument();
  });

  it("„Usuń” → „Usunąć trening?” → akcja", async () => {
    deleteSession.mockResolvedValue({ ok: true });
    render(
      <SportView
        data={daneSportu()}
        selectedKey={`s:${SESJA_PUSH}`}
        newGym={null}
      />,
    );
    const dymek = screen.getByRole("dialog", { name: "Push" });
    await userEvent.click(within(dymek).getByRole("button", { name: "Usuń" }));
    const okno = screen.getByRole("alertdialog");
    expect(okno).toHaveTextContent("Usunąć trening?");
    await userEvent.click(within(okno).getByRole("button", { name: "Usuń" }));
    expect(deleteSession).toHaveBeenCalledWith(SESJA_PUSH);
    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole("dialog", { name: "Push" }),
    ).not.toBeInTheDocument();
  });

  it("„Rozpocznij” z szablonu tworzy trening i przechodzi do niego", async () => {
    createGymSession.mockResolvedValue({ ok: true, id: "nowa-sesja" });
    render(
      <SportView
        data={daneSportu()}
        selectedKey={`t:${SZABLON_PUSH}:2026-11-19`}
        newGym={null}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Rozpocznij" }));
    expect(createGymSession).toHaveBeenCalledWith({
      date: "2026-11-19",
      start: "15:00",
      templateId: SZABLON_PUSH,
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/sport/trening/nowa-sesja"),
    );
  });

  it("błąd tworzenia treningu pokazuje toast", async () => {
    createGymSession.mockResolvedValue({
      ok: false,
      message: "Nie znaleziono szablonu.",
    });
    render(
      <SportView
        data={daneSportu()}
        selectedKey={`t:${SZABLON_PUSH}:2026-11-19`}
        newGym={null}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Rozpocznij" }));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith("Nie znaleziono szablonu."),
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("„+ Trening siłowy”: Pusty trening, szablony i link do listy szablonów", async () => {
    createGymSession.mockResolvedValue({ ok: true, id: "pusta" });
    render(<SportView data={daneSportu()} selectedKey={null} newGym={null} />);
    await userEvent.click(
      screen.getByRole("button", { name: "+ Trening siłowy" }),
    );
    expect(
      screen.getByRole("link", { name: "Szablony treningów…" }),
    ).toHaveAttribute("href", "/sport/szablony");
    expect(screen.getByRole("button", { name: "Push" })).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Pusty trening" }),
    );
    expect(createGymSession).toHaveBeenCalledWith({
      date: "2026-11-17",
      start: expect.stringMatching(/^\d\d:(00|15|30|45)$/),
    });
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith("/sport/trening/pusta"),
    );
  });

  it("„Nowy bieg” i „Edytuj” ustawiają stan okna biegu w adresie", async () => {
    render(
      <SportView
        data={daneSportu()}
        selectedKey="s:a1000000-0000-4000-8000-000000000015"
        newGym={null}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Edytuj" }));
    expect(push).toHaveBeenLastCalledWith(
      "/sport?miesiac=2026-11&bieg=a1000000-0000-4000-8000-000000000015",
      { scroll: false },
    );
    await userEvent.click(screen.getByRole("button", { name: "Nowy bieg" }));
    expect(push).toHaveBeenLastCalledWith(
      expect.stringMatching(
        /^\/sport\?miesiac=2026-11&nowy=bieg&data=2026-11-17&godzina=\d\d:(00|15|30|45)$/,
      ),
      { scroll: false },
    );
  });

  it("?nowy=silownia tworzy pusty trening raz i przechodzi do niego", async () => {
    createGymSession.mockResolvedValue({ ok: true, id: "z-kalendarza" });
    const dane = daneSportu();
    const { rerender } = render(
      <SportView
        data={dane}
        selectedKey={null}
        newGym={{ date: "2026-11-20", start: "18:30" }}
      />,
    );
    rerender(
      <SportView
        data={dane}
        selectedKey={null}
        newGym={{ date: "2026-11-20", start: "18:30" }}
      />,
    );
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith("/sport/trening/z-kalendarza"),
    );
    expect(createGymSession).toHaveBeenCalledTimes(1);
    expect(createGymSession).toHaveBeenCalledWith({
      date: "2026-11-20",
      start: "18:30",
    });
  });

  it("nowe dane z innym miesiącem zamykają dymek", async () => {
    const dane = daneSportu();
    const { rerender } = render(
      <SportView data={dane} selectedKey={null} newGym={null} />,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Długi bieg, nd 15.11" }),
    );
    expect(
      screen.getByRole("dialog", { name: "Długi bieg" }),
    ).toBeInTheDocument();
    rerender(
      <SportView
        data={{ ...dane, month: "2026-12" }}
        selectedKey={null}
        newGym={null}
      />,
    );
    expect(
      screen.queryByRole("dialog", { name: "Długi bieg" }),
    ).not.toBeInTheDocument();
  });

  it("nowe dane z tym samym `wybrany` otwierają dymek ponownie", async () => {
    const dane = daneSportu();
    const klucz = "s:a1000000-0000-4000-8000-000000000015";
    const { rerender } = render(
      <SportView data={dane} selectedKey={klucz} newGym={null} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(
      screen.queryByRole("dialog", { name: "Długi bieg" }),
    ).not.toBeInTheDocument();
    rerender(
      <SportView data={{ ...dane }} selectedKey={klucz} newGym={null} />,
    );
    expect(
      screen.getByRole("dialog", { name: "Długi bieg" }),
    ).toBeInTheDocument();
  });

  it("zamknięcie dymka usuwa nieaktualny `?wybrany=` z adresu", async () => {
    render(
      <SportView
        data={daneSportu()}
        selectedKey="s:a1000000-0000-4000-8000-000000000015"
        newGym={null}
      />,
    );
    // Otwarty dymek zostaje, adres się nie zmienia
    expect(replace).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(replace).toHaveBeenCalledWith("/sport?miesiac=2026-11", {
      scroll: false,
    });
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("Anuluj w potwierdzeniu usunięcia zostawia dymek, Esc zamyka tylko potwierdzenie", async () => {
    render(
      <SportView
        data={daneSportu()}
        selectedKey={`s:${SESJA_PUSH}`}
        newGym={null}
      />,
    );
    const dymek = screen.getByRole("dialog", { name: "Push" });
    await userEvent.click(within(dymek).getByRole("button", { name: "Usuń" }));
    const okno = screen.getByRole("alertdialog");
    await userEvent.click(within(okno).getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Push" })).toBeInTheDocument();

    await userEvent.click(
      within(screen.getByRole("dialog", { name: "Push" })).getByRole("button", {
        name: "Usuń",
      }),
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Push" })).toBeInTheDocument();
  });

  it("?nowy=bieg otwiera okno nowego biegu z datą i godziną; zamknięcie czyści adres", async () => {
    render(
      <SportView
        data={daneSportu()}
        selectedKey={null}
        newGym={null}
        newRun={{ date: "2026-11-20", start: "07:30" }}
      />,
    );
    expect(screen.getByRole("dialog", { name: "Nowy bieg" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Data" })).toHaveTextContent(
      "20.11.2026",
    );
    expect(screen.getByRole("button", { name: "Start" })).toHaveTextContent(
      "07:30",
    );
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(replace).toHaveBeenCalledWith("/sport?miesiac=2026-11", {
      scroll: false,
    });
    expect(
      screen.queryByRole("dialog", { name: "Nowy bieg" }),
    ).not.toBeInTheDocument();
  });

  it("?bieg={id} otwiera okno edycji tego biegu", () => {
    render(
      <SportView
        data={daneSportu()}
        selectedKey={null}
        newGym={null}
        runId="a1000000-0000-4000-8000-000000000015"
      />,
    );
    expect(screen.getByRole("dialog", { name: "Edytuj bieg" })).toBeVisible();
    expect(screen.getByLabelText("Dystans (km)")).toHaveValue("12,0");
  });

  it("?bieg= spoza wczytanych danych bierze bieg wczytany na serwerze", () => {
    const poza = bieg("a1000000-0000-4000-8000-000000000099", "2025-01-05", {
      distanceKm: 5,
      durationS: 1500,
    });
    render(
      <SportView
        data={daneSportu()}
        selectedKey={null}
        newGym={null}
        runId={poza.sessionId}
        runItem={poza}
      />,
    );
    expect(screen.getByLabelText("Dystans (km)")).toHaveValue("5,0");
  });

  it("„Nowy bieg” w nagłówku przechodzi na adres okna biegu", async () => {
    render(<SportView data={daneSportu()} selectedKey={null} newGym={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Nowy bieg" }));
    expect(push).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\/sport\?miesiac=2026-11&nowy=bieg&data=2026-11-17&godzina=\d\d:\d\d$/,
      ),
      { scroll: false },
    );
  });

  it("zamknięcie okna `?bieg=` czyści bieg z adresu i zostawia miesiąc", async () => {
    render(
      <SportView
        data={daneSportu()}
        selectedKey={null}
        newGym={null}
        runId="a1000000-0000-4000-8000-000000000015"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(replace).toHaveBeenCalledWith("/sport?miesiac=2026-11", {
      scroll: false,
    });
    expect(
      screen.queryByRole("dialog", { name: "Edytuj bieg" }),
    ).not.toBeInTheDocument();
  });
});
