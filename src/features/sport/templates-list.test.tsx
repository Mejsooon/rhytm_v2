import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, replace, toastError, createGymSession } = vi.hoisted(() => ({
  push: vi.fn(),
  replace: vi.fn(),
  toastError: vi.fn(),
  createGymSession: vi.fn(),
}));
// Stały obiekt routera (jak w Next) — efekt komunikatu zależy od niego
const router = { push, replace };
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("./actions", () => ({ createGymSession }));

import type { TemplatesData } from "./load-sport";
import { daneSportu, SZABLON_PUSH } from "./sport-test-data";
import { TemplatesList } from "./templates-list";

const NOGI = "c1000000-0000-4000-8000-000000000002";

function dane(): TemplatesData {
  const s = daneSportu();
  return {
    today: s.today,
    profile: s.profile,
    exercises: s.exercises,
    templates: [
      // Push: czwartek, 4 + 3 serie, ostatnio czw 12.11 (strefa Warszawy)
      { ...s.templates[0], last_used_at: "2026-11-12T15:00:00.000Z" },
      {
        id: NOGI,
        user_id: "u1",
        name: "Nogi",
        weekdays: [],
        start_time: "17:00:00",
        last_used_at: null,
        created_at: null,
        items: [],
      },
    ],
  };
}

// „Nowy szablon” w nagłówku web (primary); drugi taki link to „+” w nagłówku telefonu
const webNowy = () =>
  screen
    .getAllByRole("link", { name: "Nowy szablon" })
    .find((l) => l.classList.contains("bg-primary")) as HTMLElement;
const karta = (nazwa: string) => screen.getByRole("region", { name: nazwa });

beforeEach(() => {
  vi.clearAllMocks();
  createGymSession.mockResolvedValue({ ok: true, id: "nowa-sesja" });
});

describe("TemplatesList", () => {
  it("okruszki są nawigacją „Okruszki”", () => {
    render(<TemplatesList data={dane()} flash={null} />);
    const nav = screen.getByRole("navigation", { name: "Okruszki" });
    expect(nav).toHaveTextContent("Sport");
  });

  it("ścieżka, nagłówek i „Nowy szablon” w nagłówku", () => {
    render(<TemplatesList data={dane()} flash={null} />);
    expect(screen.getByRole("link", { name: "Sport" })).toHaveAttribute(
      "href",
      "/sport",
    );
    // Dwa nagłówki w DOM: web (h1 w treści) i telefon (.m-head); CSS pokazuje jeden
    expect(
      screen.getAllByRole("heading", { name: "Szablony treningów" }),
    ).toHaveLength(2);
    expect(
      screen.getByText(
        "Gotowa lista ćwiczeń i serii. „Rozpocznij” tworzy trening z wypełnionymi ciężarami z ostatniego razu.",
      ),
    ).toBeInTheDocument();
    expect(webNowy()).toHaveAttribute("href", "/sport/szablony/nowy");
  });

  it("telefon: nagłówek .m-head ze strzałką do Sportu i „+” do edytora; web bez okruszków", () => {
    render(<TemplatesList data={dane()} flash={null} />);
    const naglowek = screen
      .getAllByRole("banner")
      .find((h) => h.classList.contains("m-head"));
    expect(naglowek).toBeDefined();
    expect(
      within(naglowek as HTMLElement).getByRole("link", { name: "Wstecz" }),
    ).toHaveAttribute("href", "/sport");
    expect(
      within(naglowek as HTMLElement).getByRole("link", {
        name: "Nowy szablon",
      }),
    ).toHaveAttribute("href", "/sport/szablony/nowy");
    // Okruszki web znikają na telefonie
    expect(
      screen.getByRole("navigation", { name: "Okruszki" }).closest("header"),
    ).toHaveClass("max-[799px]:hidden");
  });

  it("telefon: karta ma liczbę ćwiczeń, listę ćwiczeń, dni z godziną i stopkę Edytuj / Rozpocznij", () => {
    render(<TemplatesList data={dane()} flash={null} />);
    const push_ = karta("Push");
    // Odznaka z liczbą ćwiczeń i opis widoczne tylko na telefonie
    expect(within(push_).getByText("2 ćwiczenia")).toHaveClass(
      "hidden",
      "max-[799px]:inline-flex",
    );
    expect(
      within(push_).getByText("Wyciskanie na ławce · Pompki na poręczach"),
    ).toHaveClass("hidden", "max-[799px]:block");
    expect(within(push_).getByText(/^czw · \d{1,2}:\d{2}/)).toHaveClass(
      "max-[799px]:block",
    );
    expect(
      within(karta("Nogi")).getByText("bez stałego dnia"),
    ).toBeInTheDocument();
    // Stopka: Edytuj po lewej (kolejność odwrócona na telefonie), tło i linia
    expect(
      within(push_).getByRole("button", { name: "Rozpocznij" }).parentElement,
    ).toHaveClass("max-[799px]:flex-row-reverse", "max-[799px]:border-t");
    // Web: odznaki ćwiczeń i meta chowają się na telefonie
    expect(within(push_).getByText("2 ćwiczenia · 7 serii · Cz")).toHaveClass(
      "max-[799px]:hidden",
    );
  });

  it("karta: „ostatnio”, liczba ćwiczeń i serii, dni, lista ćwiczeń, „Edytuj”", () => {
    render(<TemplatesList data={dane()} flash={null} />);
    const push_ = karta("Push");
    expect(within(push_).getByText("ostatnio: czw 12.11")).toBeInTheDocument();
    expect(
      within(push_).getByText("2 ćwiczenia · 7 serii · Cz"),
    ).toBeInTheDocument();
    // Ćwiczenia jako osobne odznaki (.bdg.out z makiety)
    expect(within(push_).getByText("Wyciskanie na ławce")).toBeInTheDocument();
    expect(within(push_).getByText("Pompki na poręczach")).toBeInTheDocument();
    expect(within(push_).getByRole("link", { name: "Edytuj" })).toHaveAttribute(
      "href",
      `/sport/szablony/${SZABLON_PUSH}`,
    );

    const nogi = karta("Nogi");
    expect(within(nogi).getByText("ostatnio: —")).toBeInTheDocument();
    expect(within(nogi).getByText("0 ćwiczeń · 0 serii")).toBeInTheDocument();
    expect(within(nogi).getByText("Brak ćwiczeń")).toBeInTheDocument();
  });

  it("karta jak .card: promień 16 px, cień, odznaka „ostatnio”, odznaki ćwiczeń i przyciski sm", () => {
    render(<TemplatesList data={dane()} flash={null} />);
    const push_ = karta("Push");
    expect(push_).toHaveClass("rounded-xl", "border-border", "shadow-card");
    expect(within(push_).getByText("ostatnio: czw 12.11")).toHaveClass(
      "bg-muted",
      "tabular-nums",
    );
    expect(
      within(push_).getByText("Wyciskanie na ławce").closest("span.rounded-sm"),
    ).toHaveClass("bg-white", "border-input");
    // Rozpocznij = primary sm, Edytuj = secondary sm; na telefonie 44 px
    expect(
      within(push_).getByRole("button", { name: "Rozpocznij" }),
    ).toHaveClass("bg-primary", "h-7", "max-[799px]:h-11");
    expect(within(push_).getByRole("link", { name: "Edytuj" })).toHaveClass(
      "bg-white",
      "h-7",
      "max-[799px]:h-11",
    );
    // „Nowy szablon” w nagłówku = primary md (32 px)
    expect(webNowy()).toHaveClass("bg-primary", "h-8");
  });

  it("długa nazwa szablonu ma truncate", () => {
    const d = dane();
    const dluga =
      "Bardzo długa nazwa szablonu treningowego dla całego tygodnia";
    d.templates[0] = { ...d.templates[0], name: dluga };
    render(<TemplatesList data={d} flash={null} />);
    expect(screen.getByText(dluga)).toHaveClass("min-w-0", "truncate");
  });

  it("długa nazwa ćwiczenia w karcie szablonu ma truncate", () => {
    const d = dane();
    const dluga =
      "Bardzo długi wyciskanie sztangi leżąc na ławce skośnej głową w dół";
    d.templates[0] = {
      ...d.templates[0],
      items: [{ ...d.templates[0].items[0], exerciseName: dluga }],
    };
    render(<TemplatesList data={d} flash={null} />);
    // Nazwa jest też w opisie telefonu (jedna pozycja = ten sam tekst); odznaka web ma truncate
    const tekst = screen
      .getAllByText(dluga)
      .find((el) => el.classList.contains("truncate")) as HTMLElement;
    expect(tekst).toHaveClass("min-w-0", "truncate");
    expect(tekst.closest("span.rounded-sm")).toHaveClass("max-w-full");
  });

  it("karta „+ Nowy szablon” ma przerywaną ramkę i prowadzi do edytora", () => {
    render(<TemplatesList data={dane()} flash={null} />);
    expect(screen.getByRole("link", { name: "+ Nowy szablon" })).toHaveClass(
      "border-dashed",
      "min-h-[190px]",
    );
  });

  it("karta „+ Nowy szablon” prowadzi do edytora", () => {
    render(<TemplatesList data={dane()} flash={null} />);
    expect(
      screen.getByRole("link", { name: "+ Nowy szablon" }),
    ).toHaveAttribute("href", "/sport/szablony/nowy");
  });

  it("„Rozpocznij” tworzy trening z dziś (godzina szablonu) i przechodzi do niego", async () => {
    render(<TemplatesList data={dane()} flash={null} />);
    await userEvent.click(
      within(karta("Push")).getByRole("button", { name: "Rozpocznij" }),
    );
    expect(createGymSession).toHaveBeenCalledWith({
      date: "2026-11-17",
      start: "15:00",
      templateId: SZABLON_PUSH,
    });
    expect(push).toHaveBeenCalledWith("/sport/trening/nowa-sesja");
  });

  it("błąd „Rozpocznij” → toast, bez przejścia", async () => {
    createGymSession.mockResolvedValue({ ok: false, message: "Ups." });
    render(<TemplatesList data={dane()} flash={null} />);
    await userEvent.click(
      within(karta("Push")).getByRole("button", { name: "Rozpocznij" }),
    );
    expect(toastError).toHaveBeenCalledWith("Ups.");
    expect(push).not.toHaveBeenCalled();
  });

  it("zielony komunikat zostaje po wyczyszczeniu adresu i wraca przy kolejnym zapisie", () => {
    const tekst = "Zapisano zmiany w szablonie „Push”.";
    const { rerender } = render(<TemplatesList data={dane()} flash={tekst} />);
    expect(screen.getByRole("status")).toHaveTextContent(tekst);
    // .alert.ok: zielona ramka i delikatne tło
    expect(screen.getByRole("status")).toHaveClass(
      "border-success-border",
      "rounded-lg",
    );
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith("/sport/szablony", { scroll: false });

    // Po router.replace serwer oddaje stronę bez komunikatu — pasek dalej widać, adresu nie zmieniamy znowu
    rerender(<TemplatesList data={dane()} flash={null} />);
    expect(screen.getByRole("status")).toHaveTextContent(tekst);
    expect(replace).toHaveBeenCalledTimes(1);

    // Drugi zapis tego samego szablonu: ten sam tekst znowu czyści adres
    rerender(<TemplatesList data={dane()} flash={tekst} />);
    expect(screen.getByRole("status")).toHaveTextContent(tekst);
    expect(replace).toHaveBeenCalledTimes(2);

    // Inny komunikat zastępuje poprzedni
    rerender(<TemplatesList data={dane()} flash="Usunięto szablon „Pull”." />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Usunięto szablon „Pull”.",
    );
  });

  it("„Rozpocznij” w trakcie: przyciski zablokowane, kliknięty aria-busy z tą samą etykietą", async () => {
    let zakoncz: (v: unknown) => void = () => {};
    createGymSession.mockReturnValue(
      new Promise((r) => {
        zakoncz = r;
      }),
    );
    const d = dane();
    d.templates[1].items = d.templates[0].items;
    render(<TemplatesList data={d} flash={null} />);
    const przycisk = within(karta("Push")).getByRole("button", {
      name: "Rozpocznij",
    });
    await userEvent.click(przycisk);
    expect(przycisk).toBeDisabled();
    expect(przycisk).toHaveAttribute("aria-busy", "true");
    const drugi = within(karta("Nogi")).getByRole("button", {
      name: "Rozpocznij",
    });
    expect(drugi).toBeDisabled();
    expect(drugi).not.toHaveAttribute("aria-busy");

    // Błąd odblokowuje przyciski
    await act(async () => zakoncz({ ok: false, message: "Ups." }));
    expect(przycisk).toBeEnabled();
    expect(przycisk).not.toHaveAttribute("aria-busy");
    expect(createGymSession).toHaveBeenCalledTimes(1);
  });

  it("bez komunikatu nie ma paska statusu", () => {
    render(<TemplatesList data={dane()} flash={null} />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
