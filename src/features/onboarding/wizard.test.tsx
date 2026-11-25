import { Activity } from "react";
import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OnboardingDraft } from "./model";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const saveOnboardingStep = vi.fn();
const completeOnboarding = vi.fn();
vi.mock("./actions", () => ({
  saveOnboardingStep: (...a: unknown[]) => saveOnboardingStep(...a),
  completeOnboarding: () => completeOnboarding(),
}));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

import { OnboardingWizard } from "./wizard";

const NOW = new Date("2026-11-17T09:00:00Z");
const draft: OnboardingDraft = {
  name: "Mejson",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "24",
  roles: ["student", "sport"],
  studyField: "",
  workoutsOn: true,
  kmOn: false,
  weeklyWorkouts: 3,
  weeklyKm: 25,
  sleepGoalMin: 480,
  source: null,
  sourceOther: "",
  pages: null,
  notify: {
    perm: false,
    before: true,
    renew: true,
    weekly: true,
    habits: false,
  },
};

function pokaz(step: number, d: OnboardingDraft = draft) {
  render(
    <OnboardingWizard
      step={step as 1}
      initialDraft={d}
      avatarUrl={null}
      userId="u1"
      now={NOW}
    />,
  );
  return within(screen.getByTestId("wizard-footer"));
}

beforeEach(() => {
  push.mockReset();
  saveOnboardingStep.mockReset();
  completeOnboarding.mockReset();
  saveOnboardingStep.mockResolvedValue({ ok: true });
});

describe("OnboardingWizard", () => {
  it("krok 1: puste imię blokuje „Dalej”", () => {
    const stopka = pokaz(1, { ...draft, name: "" });
    expect(stopka.getByRole("button", { name: "Dalej" })).toBeDisabled();
  });

  it("krok 1: z imieniem „Dalej” jest aktywne", () => {
    const stopka = pokaz(1);
    expect(stopka.getByRole("button", { name: "Dalej" })).toBeEnabled();
  });

  it("pokazuje „Krok n z 7” i pasek postępu", () => {
    pokaz(3);
    expect(screen.getAllByText("Krok 3 z 7").length).toBeGreaterThan(0);
    const pasek = screen.getByRole("progressbar");
    expect(pasek).toHaveAttribute("aria-valuenow", "3");
  });

  it("podwójny klik zapisuje raz, potem przechodzi do kroku 3", async () => {
    const stopka = pokaz(2);
    const dalej = stopka.getByRole("button", { name: "Dalej" });
    await userEvent.dblClick(dalej);
    expect(saveOnboardingStep).toHaveBeenCalledTimes(1);
    expect(saveOnboardingStep).toHaveBeenCalledWith(2, {
      roles: ["student", "sport"],
      study_field: "",
    });
    expect(push).toHaveBeenCalledWith("/onboarding/3");
  });

  it("dwa synchroniczne kliknięcia wysyłają jeden request", async () => {
    saveOnboardingStep.mockReturnValue(new Promise(() => {}));
    const stopka = pokaz(2);
    const dalej = stopka.getByRole("button", { name: "Dalej" });
    dalej.click();
    dalej.click();
    expect(saveOnboardingStep).toHaveBeenCalledTimes(1);
  });

  it("błąd akcji: komunikat w role=alert, bez przejścia", async () => {
    saveOnboardingStep.mockResolvedValue({
      ok: false,
      message: "Nie udało się zapisać.",
    });
    const stopka = pokaz(2);
    await userEvent.click(stopka.getByRole("button", { name: "Dalej" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać.",
    );
    expect(push).not.toHaveBeenCalled();
    expect(stopka.getByRole("button", { name: "Dalej" })).toBeEnabled();
  });

  it("„Pomiń” tylko na kroku 4 i zapisuje null-e", async () => {
    const { unmount } = render(
      <OnboardingWizard
        step={3}
        initialDraft={draft}
        avatarUrl={null}
        now={NOW}
        userId="u1"
      />,
    );
    expect(
      screen.queryByRole("button", { name: "Pomiń" }),
    ).not.toBeInTheDocument();
    unmount();
    const stopka = pokaz(4);
    await userEvent.click(stopka.getByRole("button", { name: "Pomiń" }));
    expect(saveOnboardingStep).toHaveBeenCalledWith(4, {
      referral_source: null,
      referral_other: null,
    });
    expect(push).toHaveBeenCalledWith("/onboarding/5");
  });

  it("krok 7: „Przejdź do Dziś” zamiast „Dalej”, woła completeOnboarding", async () => {
    completeOnboarding.mockResolvedValue({ ok: false, message: "Błąd końca." });
    const stopka = pokaz(7);
    expect(
      stopka.queryByRole("button", { name: "Dalej" }),
    ).not.toBeInTheDocument();
    await userEvent.click(
      stopka.getByRole("button", { name: "Przejdź do Dziś" }),
    );
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
    expect(saveOnboardingStep).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Błąd końca.");
  });

  it("krok 7: podwójny klik „Przejdź do Dziś” woła completeOnboarding raz", async () => {
    completeOnboarding.mockReturnValue(new Promise(() => {}));
    const stopka = pokaz(7);
    const przycisk = stopka.getByRole("button", { name: "Przejdź do Dziś" });
    await userEvent.dblClick(przycisk);
    expect(completeOnboarding).toHaveBeenCalledTimes(1);
  });

  it("„Wstecz” na kroku 3 idzie do kroku 2", async () => {
    const stopka = pokaz(3);
    await userEvent.click(stopka.getByRole("button", { name: "Wstecz" }));
    expect(push).toHaveBeenCalledWith("/onboarding/2");
  });

  it("„Wstecz” jest nieaktywne w trakcie zapisu", async () => {
    saveOnboardingStep.mockReturnValue(new Promise(() => {}));
    const stopka = pokaz(3);
    await userEvent.click(stopka.getByRole("button", { name: "Dalej" }));
    expect(stopka.getByRole("button", { name: "Wstecz" })).toBeDisabled();
    for (const b of screen.getAllByRole("button", { name: "Wstecz" }))
      expect(b).toBeDisabled();
  });

  it("„Wstecz” na kroku 1 jest nieaktywne", () => {
    const stopka = pokaz(1);
    expect(stopka.getByRole("button", { name: "Wstecz" })).toBeDisabled();
  });

  it("telefon: nagłówek ma „Wstecz” od kroku 2, a „Wyloguj” jest zawsze", async () => {
    pokaz(2);
    expect(screen.getAllByRole("button", { name: "Wstecz" }).length).toBe(2);
    expect(
      screen.getAllByRole("button", { name: "Wyloguj" }).length,
    ).toBeGreaterThan(0);
  });

  it("po ukryciu i przywróceniu trasy (Activity) przyciski nie zostają zablokowane", async () => {
    const wizard = (mode: "visible" | "hidden") => (
      <Activity mode={mode}>
        <OnboardingWizard
          step={3}
          initialDraft={draft}
          avatarUrl={null}
          now={NOW}
          userId="u1"
        />
      </Activity>
    );
    const { rerender } = render(wizard("visible"));
    const stopka = within(screen.getByTestId("wizard-footer"));
    await userEvent.click(stopka.getByRole("button", { name: "Dalej" }));
    expect(push).toHaveBeenCalledWith("/onboarding/4");
    // Po udanym zapisie przyciski czekają na zmianę kroku
    expect(stopka.getByRole("button", { name: "Dalej" })).toBeDisabled();

    // Użytkownik odchodzi (trasa chowana w Activity) i wraca na ten sam krok
    await act(async () => rerender(wizard("hidden")));
    await act(async () => rerender(wizard("visible")));
    expect(stopka.getByRole("button", { name: "Dalej" })).toBeEnabled();
    expect(stopka.getByRole("button", { name: "Wstecz" })).toBeEnabled();
  });

  it("pasek górny: „Krok N z 7” jako szara odznaka bez font-mono, „Wyloguj” po prawej", () => {
    pokaz(3);
    // Pierwszy w DOM jest nagłówek web (drugi to nagłówek telefonu)
    const odznaka = screen.getAllByText("Krok 3 z 7")[0];
    expect(odznaka).toHaveClass("bg-muted", "ml-auto");
    expect(odznaka).not.toHaveClass("font-mono");
    const naglowek = odznaka.closest("header") as HTMLElement;
    const wyloguj = within(naglowek).getByRole("button", { name: "Wyloguj" });
    // „Wyloguj” jest za odznaką, na końcu paska
    expect(
      odznaka.compareDocumentPosition(wyloguj) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(naglowek.lastElementChild).toContainElement(wyloguj);
  });

  it("„Wyloguj” to wspólny Button ghost sm (web 28 px), a na telefonie zostaje 44 px; logo web z gap-2", () => {
    pokaz(3);
    const [web, telefon] = screen.getAllByRole("button", { name: "Wyloguj" });
    expect(web).toHaveAttribute("type", "submit");
    expect(web).toHaveClass(
      "h-7",
      "bg-transparent",
      "text-muted-foreground",
      "hover:bg-accent",
    );
    expect(telefon).toHaveAttribute("type", "submit");
    expect(telefon).toHaveClass("max-[799px]:h-11", "text-muted-foreground");
    expect(telefon).not.toHaveClass("max-[799px]:h-10");
    const logo = document.querySelector("header svg")?.parentElement;
    expect(logo).toHaveClass("gap-2");
    expect(logo).not.toHaveClass("gap-2.5");
  });

  it("7 segmentów postępu, wypełnione do bieżącego kroku", () => {
    pokaz(3);
    const pasek = screen.getByRole("progressbar");
    expect(pasek).toHaveAttribute("aria-label", "Postęp onboardingu");
    expect(pasek).toHaveAttribute("aria-valuemin", "1");
    expect(pasek).toHaveAttribute("aria-valuemax", "7");
    expect(pasek).toHaveAttribute("aria-valuenow", "3");
    const segmenty = Array.from(pasek.children);
    expect(segmenty).toHaveLength(7);
    expect(segmenty.map((s) => s.classList.contains("bg-primary"))).toEqual([
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    // Segmenty (web i telefon): pełne zaokrąglenie, tor w tokenie border (.steps z CMOnboarding)
    expect(segmenty[0]).toHaveClass("h-1", "rounded-full", "bg-primary");
    expect(segmenty[6]).toHaveClass("bg-border");
    expect(screen.getByRole("progressbar")).toHaveClass("grid-cols-7", "gap-1", "px-4", "pb-2");
  });

  it("stopka: „Wstecz” ghost z ChevronLeft, „Dalej” primary z ChevronRight", () => {
    const stopka = pokaz(3);
    const wstecz = stopka.getByRole("button", { name: "Wstecz" });
    expect(wstecz).toHaveClass("bg-transparent");
    expect(wstecz.querySelector("svg.lucide-chevron-left")).not.toBeNull();
    const dalej = stopka.getByRole("button", { name: "Dalej" });
    expect(dalej).toHaveClass("bg-primary");
    expect(dalej.querySelector("svg.lucide-chevron-right")).not.toBeNull();
    // Stopka web: pasek oddzielony linią, na całą szerokość kolumny; na telefonie (przyklejona) tło nieprzezroczyste
    expect(screen.getByTestId("wizard-footer")).toHaveClass(
      "border-t",
      "bg-white",
      "min-[800px]:bg-black/[.025]",
    );
  });

  it("stopka w ostatnim kroku: „Przejdź do Dziś” primary z ChevronRight", () => {
    const stopka = pokaz(7);
    const koniec = stopka.getByRole("button", { name: "Przejdź do Dziś" });
    expect(koniec).toHaveClass("bg-primary");
    expect(koniec.querySelector("svg.lucide-chevron-right")).not.toBeNull();
  });

  it("ramka web: tło panel, karta 1120×720 z cieniem, kolumna kroku 520 px", () => {
    const { container } = render(
      <OnboardingWizard
        step={1}
        initialDraft={draft}
        avatarUrl={null}
        now={NOW}
        userId="u1"
      />,
    );
    // Tło panel na obu szerokościach (CMOnboarding ma #fafafa)
    expect(container.firstElementChild).toHaveClass("bg-panel");
    const karta = screen.getByRole("progressbar").parentElement as HTMLElement;
    expect(karta).toHaveClass(
      "max-w-[1120px]",
      "min-[800px]:h-[720px]",
      "min-[800px]:shadow-card",
    );
    expect(
      screen.getByTestId("wizard-footer").parentElement?.parentElement,
    ).toHaveClass("grid-cols-[520px_1fr]");
  });

  it("telefon bez zmian: klasy max-[799px]: nagłówka, stopki i przycisków", () => {
    pokaz(2);
    const stopka = screen.getByTestId("wizard-footer");
    expect(stopka).toHaveClass("max-[799px]:sticky", "max-[799px]:bottom-0");
    const dalej = within(stopka).getByRole("button", { name: "Dalej" });
    expect(dalej).toHaveClass("max-[799px]:w-full", "max-[799px]:order-1");
    // „Wstecz” w stopce znika na telefonie, w nagłówku telefonu jest osobny
    expect(within(stopka).getByRole("button", { name: "Wstecz" })).toHaveClass(
      "max-[799px]:hidden",
    );
    const naglowekTel = screen.getAllByText("Krok 2 z 7")[1].closest("header");
    expect(naglowekTel).toHaveClass("min-[800px]:hidden");
    expect(
      within(naglowekTel as HTMLElement).getByRole("button", {
        name: "Wstecz",
      }),
    ).toHaveClass("max-[799px]:h-11", "max-[799px]:w-11");
    // m-head bez ramki i tła, plakietka kroku bez mono
    expect(naglowekTel).toHaveClass("m-head", "border-b-0", "bg-transparent");
  });

  it("nowy initialDraft z serwera zastępuje lokalny szkic", () => {
    const { rerender } = render(
      <OnboardingWizard
        step={1}
        initialDraft={draft}
        avatarUrl={null}
        now={NOW}
        userId="u1"
      />,
    );
    expect(screen.getAllByLabelText("Imię lub pseudonim")[0]).toHaveValue(
      "Mejson",
    );
    rerender(
      <OnboardingWizard
        step={1}
        initialDraft={{ ...draft, name: "Ola" }}
        avatarUrl={null}
        now={NOW}
        userId="u1"
      />,
    );
    expect(screen.getAllByLabelText("Imię lub pseudonim")[0]).toHaveValue(
      "Ola",
    );
  });
});
