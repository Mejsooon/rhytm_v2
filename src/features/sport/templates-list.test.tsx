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

const karta = (nazwa: string) => screen.getByRole("region", { name: nazwa });

beforeEach(() => {
  vi.clearAllMocks();
  createGymSession.mockResolvedValue({ ok: true, id: "nowa-sesja" });
});

describe("TemplatesList", () => {
  it("ścieżka, nagłówek i „Nowy szablon” w nagłówku", () => {
    render(<TemplatesList data={dane()} flash={null} />);
    expect(screen.getByRole("link", { name: "Sport" })).toHaveAttribute(
      "href",
      "/sport",
    );
    expect(
      screen.getByRole("heading", { name: "Szablony treningów" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Gotowa lista ćwiczeń i serii. „Rozpocznij” tworzy trening z wypełnionymi ciężarami z ostatniego razu.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nowy szablon" })).toHaveAttribute(
      "href",
      "/sport/szablony/nowy",
    );
  });

  it("karta: „ostatnio”, liczba ćwiczeń i serii, dni, lista ćwiczeń, „Edytuj”", () => {
    render(<TemplatesList data={dane()} flash={null} />);
    const push_ = karta("Push");
    expect(within(push_).getByText("ostatnio: czw 12.11")).toBeInTheDocument();
    expect(
      within(push_).getByText("2 ćwiczenia · 7 serii · Cz"),
    ).toBeInTheDocument();
    expect(
      within(push_).getByText("Wyciskanie na ławce · Pompki na poręczach"),
    ).toBeInTheDocument();
    expect(within(push_).getByRole("link", { name: "Edytuj" })).toHaveAttribute(
      "href",
      `/sport/szablony/${SZABLON_PUSH}`,
    );

    const nogi = karta("Nogi");
    expect(within(nogi).getByText("ostatnio: —")).toBeInTheDocument();
    expect(within(nogi).getByText("0 ćwiczeń · 0 serii")).toBeInTheDocument();
    expect(within(nogi).getByText("Brak ćwiczeń")).toBeInTheDocument();
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
