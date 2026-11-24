import { expect, test, type Page } from "@playwright/test";

import { poZapisie, zasiejBlok, zasiejZadanie } from "./helpers/kalendarz";
import { adminClient } from "./helpers/konto";
import {
  dzisWarszawa,
  przesunDate,
  zalozKontoNawykow,
  zasiejNawyk,
  zasiejSen,
} from "./helpers/nawyki";
import { zasiejBieg } from "./helpers/sport";

// Dziś pracuje na prawdziwym „dziś” w strefie profilu (Europe/Warsaw), więc dane zasiewamy względem niego.

// Konto z danymi: blok „Matematyka” dziś 10:00–11:30 z dwoma zadaniami, nawyk „Czytanie”
// (codziennie), bieg dziś o 07:00 i wpis snu z ostatniej nocy. Po zasianiu strona Dziś jest wczytana na nowo.
async function zalozPelneDzis(page: Page, projekt: string) {
  const userId = await zalozKontoNawykow(page, projekt);
  const dzis = dzisWarszawa();
  const blokId = await zasiejBlok(userId, {
    title: "Matematyka",
    date: dzis,
    startMin: 600,
    durationMin: 90,
  });
  await zasiejZadanie(userId, blokId, dzis, "Zadania z analizy");
  await zasiejZadanie(userId, blokId, dzis, "Powtórka wzorów");
  await zasiejNawyk(userId, { name: "Czytanie" });
  await zasiejBieg(userId, { dniTemu: 0, km: 8, sekundy: 2880 });
  await zasiejSen(userId, 0, "23:00", "07:00");
  await page.goto("/dzis");
  return { userId, blokId };
}

test.describe("Dziś (web)", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
  });

  test("blok z 2 zadaniami → dymek na planie dnia → odhaczenie → „1/2” na liście, także po odświeżeniu", async ({
    page,
  }, info) => {
    const { blokId } = await zalozPelneDzis(page, info.project.name);
    const web = page.getByTestId("web-dzis");

    await expect(web.getByRole("heading", { name: "Plan dnia" })).toBeVisible();
    await expect(
      web.getByRole("heading", { name: "Ten tydzień" }),
    ).toBeVisible();

    const lista = web.getByTestId("plan-dnia-lista");
    // Wykonany trening na liście planu dnia: link do jego podglądu na /sport z odznaką „zrobione”
    const trening = lista.getByRole("link", { name: /Spokojny/ });
    await expect(trening).toHaveAttribute(
      "href",
      /^\/sport\?miesiac=\d{4}-\d{2}&wybrany=/,
    );
    await expect(trening).toContainText("zrobione");

    // Blok po kluczu wystąpienia (przy otwartym dymku też dostępny)
    const blok = lista.locator(`[data-occurrence-key^="${blokId}"]`);
    await expect(blok).toContainText("Matematyka");
    await expect(blok).toContainText("0/2");

    await blok.click();
    const dymek = page.getByRole("dialog", { name: "Szczegóły bloku" });
    await expect(dymek).toContainText("0 z 2");

    const zapis = poZapisie(page);
    await dymek.getByRole("checkbox", { name: "Powtórka wzorów" }).check();
    await expect(dymek).toContainText("1 z 2");
    await expect(blok).toContainText("1/2");
    await zapis;

    await page.reload();
    await expect(blok).toContainText("1/2");
    await blok.click();
    await expect(
      page
        .getByRole("dialog", { name: "Szczegóły bloku" })
        .getByRole("checkbox", { name: "Powtórka wzorów" }),
    ).toBeChecked();
  });

  test("kafelek nawyku „Czytanie” → odhaczony, licznik „1 / 1”, także po odświeżeniu", async ({
    page,
  }, info) => {
    await zalozPelneDzis(page, info.project.name);
    const web = page.getByTestId("web-dzis");
    const nawyki = web.getByRole("region", { name: "Nawyki na dziś" });
    const czytanie = nawyki.getByRole("button", { name: /Czytanie/ });
    await expect(czytanie).toHaveAttribute("aria-pressed", "false");
    await expect(nawyki).toContainText("0 / 1");

    const zapis = poZapisie(page);
    await czytanie.click();
    await expect(czytanie).toHaveAttribute("aria-pressed", "true");
    await expect(nawyki).toContainText("1 / 1");
    await zapis;

    await page.reload();
    await expect(czytanie).toHaveAttribute("aria-pressed", "true");
    await expect(nawyki).toContainText("1 / 1");
  });

  test("klik w przerwę po ostatnim bloku → „Nowy blok” od 12:00 → zapis → blok na liście i w bazie", async ({
    page,
  }, info) => {
    const { userId } = await zalozPelneDzis(page, info.project.name);
    const web = page.getByTestId("web-dzis");
    const lista = web.getByTestId("plan-dnia-lista");

    // Ostatnia przerwa zaczyna się o 11:30 (koniec „Matematyki”) → blok od pełnej godziny w górę
    await lista.getByRole("button", { name: /wolne, dodaj blok/ }).last().click();
    const okno = page.getByRole("dialog", { name: "Nowy blok" });
    await expect(okno.getByRole("button", { name: "Od" })).toHaveText(
      /12:00/,
    );
    await okno.getByLabel("Tytuł").fill("Algebra");
    await okno.getByRole("button", { name: "Zapisz blok" }).click();
    await expect(okno).toBeHidden();
    await expect(lista).toContainText("Algebra");
    await expect
      .poll(async () => {
        const { data } = await adminClient()
          .from("blocks")
          .select("start_local, duration_min")
          .eq("user_id", userId)
          .eq("title", "Algebra");
        return data ?? [];
      })
      .toEqual([
        { start_local: `${dzisWarszawa()}T12:00:00`, duration_min: 60 },
      ]);
  });
});

test.describe("Dziś (telefon)", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "mobile", "układ telefonu");
  });

  test("„+” → Blok „Kupić mleko” „Jutro” → Dodaj → toast „Dodano”, blok w bazie na jutro 09:00", async ({
    page,
  }, info) => {
    const { userId } = await zalozPelneDzis(page, info.project.name);
    const jutro = przesunDate(dzisWarszawa(), 1);
    const m = page.getByTestId("m-dzis");

    await m.getByRole("button", { name: "Szybko dodaj" }).click();
    const arkusz = page.getByRole("dialog", { name: "Szybko dodaj" });
    // Domyślny rodzaj to „Blok” (rodzaju „Zadanie” nie ma)
    await expect(
      arkusz.getByRole("radio", { name: "Blok" }),
    ).toHaveAttribute("aria-checked", "true");
    await arkusz.getByRole("textbox").fill("Kupić mleko");
    const chipJutro = arkusz
      .getByRole("group", { name: "Kiedy" })
      .getByRole("button", { name: "Jutro", exact: true });
    await chipJutro.click();
    await expect(chipJutro).toHaveAttribute("aria-pressed", "true");
    await arkusz.getByRole("button", { name: "Dodaj", exact: true }).click();

    await expect(arkusz).toBeHidden();
    await expect(page.getByText("Dodano", { exact: true })).toBeVisible();
    await expect
      .poll(async () => {
        const { data } = await adminClient()
          .from("blocks")
          .select("start_local, duration_min")
          .eq("user_id", userId)
          .eq("title", "Kupić mleko");
        return data ?? [];
      })
      .toEqual([{ start_local: `${jutro}T09:00:00`, duration_min: 60 }]);
  });

  test("nawyk odhaczony na Dziś → kafelek „Czytanie” wciśnięty, licznik „1 / 1”, także po odświeżeniu", async ({
    page,
  }, info) => {
    await zalozPelneDzis(page, info.project.name);
    const m = page.getByTestId("m-dzis");
    // Sekcja „Nawyki na dziś” z kafelkami (aria-pressed) i licznikiem „x / y”
    const nawyki = m.getByRole("region", { name: "Nawyki na dziś" });
    const czytanie = nawyki.getByRole("button", { name: /Czytanie/ });
    await expect(czytanie).toHaveAttribute("aria-pressed", "false");
    await expect(nawyki).toContainText("0 / 1");

    const zapis = poZapisie(page);
    await czytanie.click();
    await expect(czytanie).toHaveAttribute("aria-pressed", "true");
    await expect(nawyki).toContainText("1 / 1");
    await zapis;

    await page.reload();
    await expect(czytanie).toHaveAttribute("aria-pressed", "true");
    await expect(nawyki).toContainText("1 / 1");
  });
});
