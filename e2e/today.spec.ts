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
// Pełne Dziś (zamiast EmptyToday) wymaga wszystkich czterech pierwszych kroków: blok, nawyk, trening i wpis snu.

// Konto z czterema krokami: blok „Matematyka” dziś 10:00–11:30 z dwoma zadaniami, nawyk „Czytanie”
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

  test("blok z 2 zadaniami → dymek na planie dnia → odhaczenie → „1/2” na osi i w kafelku „Zadania”, także po odświeżeniu", async ({
    page,
  }, info) => {
    const { blokId } = await zalozPelneDzis(page, info.project.name);
    const web = page.getByTestId("web-dzis");

    // Cztery kroki zrobione → pełne Dziś, nie EmptyToday
    await expect(web.getByRole("heading", { name: "Plan dnia" })).toBeVisible();
    await expect(
      web.getByRole("heading", { name: "Ten tydzień" }),
    ).toBeVisible();

    const os = web.getByTestId("os-dnia");
    // Trening na osi planu dnia: link do jego podglądu na /sport
    await expect(os.getByRole("link", { name: /Spokojny/ })).toHaveAttribute(
      "href",
      /^\/sport\?miesiac=\d{4}-\d{2}&wybrany=/,
    );

    // Blok po kluczu wystąpienia (przy otwartym dymku też dostępny)
    const blok = os.locator(`[data-occurrence-key^="${blokId}"]`);
    const kafelekZadan = web
      .getByTestId("kafelek-tygodnia")
      .filter({ hasText: "Zadania" });
    await expect(blok).toContainText("Matematyka");
    await expect(blok).toContainText("0/2");
    await expect(kafelekZadan).toContainText("0/2");

    await blok.click();
    const dymek = page.getByRole("dialog", { name: "Szczegóły bloku" });
    await expect(dymek).toContainText("0 z 2");

    const zapis = poZapisie(page);
    await dymek.getByRole("checkbox", { name: "Powtórka wzorów" }).check();
    await expect(dymek).toContainText("1 z 2");
    await expect(blok).toContainText("1/2");
    await expect(kafelekZadan).toContainText("1/2");
    await expect(kafelekZadan).toContainText("50% · dziś 1/2");
    await zapis;

    await page.reload();
    await expect(blok).toContainText("1/2");
    await expect(kafelekZadan).toContainText("50% · dziś 1/2");
    await blok.click();
    await expect(
      page
        .getByRole("dialog", { name: "Szczegóły bloku" })
        .getByRole("checkbox", { name: "Powtórka wzorów" }),
    ).toBeChecked();
  });

  test("„+” → Zadanie „Kupić mleko” „Jutro” → Dodaj → toast „Dodano”, zadanie w bazie z jutrzejszą datą", async ({
    page,
  }, info) => {
    const { userId } = await zalozPelneDzis(page, info.project.name);
    const jutro = przesunDate(dzisWarszawa(), 1);
    const m = page.getByTestId("m-dzis");

    await m.getByRole("button", { name: "Szybko dodaj" }).click();
    const arkusz = page.getByRole("dialog", { name: "Szybko dodaj" });
    // Domyślny rodzaj to „Zadanie”
    await expect(
      arkusz.getByRole("radio", { name: "Zadanie" }),
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
          .from("tasks")
          .select("due_date, block_id, done")
          .eq("user_id", userId)
          .eq("title", "Kupić mleko");
        return data ?? [];
      })
      .toEqual([{ due_date: jutro, block_id: null, done: false }]);
  });

  test("nawyk odhaczony na Dziś → kafelek „Nawyki” 1/1, także po odświeżeniu", async ({
    page,
  }, info) => {
    await zalozPelneDzis(page, info.project.name);
    const m = page.getByTestId("m-dzis");
    // Kafelek to link „Nawyki” z wartością x/y (link „Wszystkie” ma inną nazwę)
    const kafelekNawykow = m.getByRole("link").filter({ hasText: /^Nawyki/ });
    await expect(kafelekNawykow).toContainText("0/1");

    const zapis = poZapisie(page);
    const nawyk = m.getByRole("checkbox", { name: "Czytanie" });
    await nawyk.click();
    await expect(nawyk).toHaveAttribute("aria-checked", "true");
    await expect(kafelekNawykow).toContainText("1/1");
    await zapis;

    await page.reload();
    await expect(nawyk).toHaveAttribute("aria-checked", "true");
    await expect(kafelekNawykow).toContainText("1/1");
  });
});
