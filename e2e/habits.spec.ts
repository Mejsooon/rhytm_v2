import { expect, test, type Page } from "@playwright/test";

import { poZapisie } from "./helpers/kalendarz";
import {
  dzisWarszawa,
  policzNawyki,
  wpisySnu,
  zalozKontoNawykow,
  zasiejNawyk,
} from "./helpers/nawyki";

// Nawyki działają na „dziś” w strefie profilu (Europe/Warsaw), więc dane zasiewamy względem prawdziwego dziś (helpers/nawyki.ts).

// Wybór godziny w dymku TimePicker: klik przycisku, godzina, minuty (zamykają dymek)
async function ustawGodzine(
  page: Page,
  pole: string,
  godzina: string,
  minuty: string,
) {
  await page.getByRole("button", { name: pole, exact: true }).click();
  // Godziny mają etykiety „23”, minuty „:30”
  await page.getByRole("button", { name: godzina, exact: true }).click();
  await page.getByRole("button", { name: `:${minuty}`, exact: true }).click();
}

test.describe("nawyki i sen (web)", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
  });

  test("nowy nawyk codziennie → odhaczenie dziś → „1/1” i stan po odświeżeniu", async ({
    page,
  }, info) => {
    await zalozKontoNawykow(page, info.project.name);
    await page.goto("/nawyki");
    const web = page.getByTestId("web-nawyki");

    // Na nowym koncie przycisk jest w nagłówku i w pustym stanie
    await web.getByRole("button", { name: "Nowy nawyk", exact: true }).first().click();
    const okno = page.getByRole("dialog", { name: "Nowy nawyk" });
    await okno.getByLabel("Nazwa").fill("Woda 2 l");
    // Domyślny harmonogram to „Codziennie”
    await expect(
      okno.getByRole("radio", { name: "Codziennie" }),
    ).toHaveAttribute("aria-checked", "true");
    await okno.getByRole("button", { name: "Dodaj nawyk" }).click();
    await expect(okno).toBeHidden();
    await expect(web.getByRole("link", { name: "Woda 2 l" })).toBeVisible();

    const zapis = poZapisie(page);
    await web.getByRole("button", { name: "Odhacz dziś: Woda 2 l" }).click();
    await expect(
      web.getByRole("button", { name: "Cofnij odhaczenie: Woda 2 l" }),
    ).toBeVisible();
    await expect(web.getByText("1/1 dziś", { exact: true })).toBeVisible();
    await zapis;

    await page.reload();
    await expect(
      web.getByRole("button", { name: "Cofnij odhaczenie: Woda 2 l" }),
    ).toBeVisible();
    await expect(web.getByText("1/1 dziś", { exact: true })).toBeVisible();
  });

  test("zmiana na „Wybrane dni” dodaje drugą pozycję w historii harmonogramu", async ({
    page,
  }, info) => {
    const userId = await zalozKontoNawykow(page, info.project.name);
    const id = await zasiejNawyk(userId, { name: "Czytanie" });
    await page.goto(`/nawyki/${id}`);
    const web = page.getByTestId("web-nawyk");

    const historia = web
      .locator("section")
      .filter({
        has: page.getByRole("heading", { name: "Historia harmonogramu" }),
      });
    await expect(historia).toContainText("codziennie");
    await expect(historia).not.toContainText("pn, śr, pt");

    await web.getByRole("button", { name: "Edytuj" }).click();
    const okno = page.getByRole("dialog", { name: "Edytuj nawyk" });
    await okno.getByRole("radio", { name: "Wybrane dni" }).click();
    for (const dzien of ["poniedziałek", "środa", "piątek"]) {
      await okno.getByRole("button", { name: dzien, exact: true }).click();
    }
    await okno.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(okno).toBeHidden();

    // Nowa wersja od dziś na górze, stara („codziennie”) ze skończonym zakresem pod nią
    await expect(historia).toContainText("pn, śr, pt");
    await expect(historia).toContainText("codziennie");
    await expect(historia.getByText(/^od \d{2}\.\d{2}\.\d{4}$/)).toHaveCount(1);
    await expect(
      historia.getByText(/^\d{2}\.\d{2} – \d{2}\.\d{2}\.\d{4}$/),
    ).toHaveCount(1);
  });

  test("„+ Wpis snu” 23:30 → 07:00 daje „Ostatnia noc” 7:30; drugi wpis na ten sam dzień edytuje pierwszy", async ({
    page,
  }, info) => {
    const userId = await zalozKontoNawykow(page, info.project.name);
    await page.goto("/nawyki");
    const web = page.getByTestId("web-nawyki");
    const kartaSnu = web
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "Sen", exact: true }) });

    await web.getByRole("button", { name: "+ Wpis snu" }).click();
    const okno = page.getByRole("dialog", { name: "Wpis snu" });
    await ustawGodzine(page, "Zasnąłem", "23", "30");
    await expect(okno.getByText("7:30", { exact: true })).toBeVisible();
    await okno.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(okno).toBeHidden();
    await expect(kartaSnu.locator("b").getByText("7:30", { exact: true })).toBeVisible();

    // Drugi wpis na dziś: okno startuje z zapisanymi godzinami i zapisuje zmianę w tym samym wpisie
    await web.getByRole("button", { name: "+ Wpis snu" }).click();
    const drugie = page.getByRole("dialog", { name: "Wpis snu" });
    await expect(
      page.getByRole("button", { name: "Zasnąłem", exact: true }),
    ).toHaveText("23:30");
    await ustawGodzine(page, "Zasnąłem", "23", "00");
    await drugie.getByRole("button", { name: "Zapisz", exact: true }).click();
    // Błąd zapisu zostawiłby okno otwarte z komunikatem, więc zamknięcie oznacza brak błędu
    await expect(drugie).toBeHidden();
    await expect(kartaSnu.locator("b").getByText("8:00", { exact: true })).toBeVisible();

    // Nadal jeden wpis (jeden na dzień), z nową godziną
    const wpisy = await wpisySnu(userId);
    expect(wpisy).toHaveLength(1);
    expect(wpisy[0].date).toBe(dzisWarszawa());
    expect(wpisy[0].slept_at.slice(0, 5)).toBe("23:00");
  });

  test("usunięcie nawyku w szczegółach: wraca na listę, nawyk znika także po odświeżeniu", async ({
    page,
  }, info) => {
    const userId = await zalozKontoNawykow(page, info.project.name);
    const id = await zasiejNawyk(userId, { name: "Do usunięcia" });
    await page.goto("/nawyki");
    await expect(
      page
        .getByTestId("web-nawyki")
        .getByRole("link", { name: "Do usunięcia" }),
    ).toBeVisible();

    await page.goto(`/nawyki/${id}`);
    await page
      .getByTestId("web-nawyk")
      .getByRole("button", { name: "Więcej akcji" })
      .click();
    await page.getByRole("button", { name: "Usuń nawyk…" }).click();
    const okno = page.getByRole("alertdialog", {
      name: "Usunąć nawyk „Do usunięcia”?",
    });
    await okno.getByRole("button", { name: "Usuń na zawsze" }).click();

    await expect(page).toHaveURL(/\/nawyki$/);
    const web = page.getByTestId("web-nawyki");
    await expect(web.getByText("Dodaj pierwszy nawyk albo wpis snu")).toBeVisible();
    await expect(web.getByRole("link", { name: "Do usunięcia" })).toHaveCount(
      0,
    );

    await page.reload();
    await expect(web.getByText("Dodaj pierwszy nawyk albo wpis snu")).toBeVisible();
    await expect(web.getByRole("link", { name: "Do usunięcia" })).toHaveCount(
      0,
    );
    expect(await policzNawyki(userId, "Do usunięcia")).toBe(0);
  });
});

test.describe("nawyki: archiwum i ilość (web)", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
  });

  test("archiwizacja z menu → archiwum → przywrócenie", async ({ page }, info) => {
    const userId = await zalozKontoNawykow(page, info.project.name);
    await zasiejNawyk(userId, { name: "Medytacja" });
    await page.goto("/nawyki");
    const web = page.getByTestId("web-nawyki");

    await web.getByRole("button", { name: "Więcej: Medytacja" }).click();
    await page.getByRole("button", { name: "Archiwizuj" }).click();
    await expect(web.getByRole("link", { name: "Archiwum (1)" })).toBeVisible();
    await expect(web.getByRole("link", { name: "Medytacja" })).toHaveCount(0);

    await web.getByRole("link", { name: "Archiwum (1)" }).click();
    await expect(page).toHaveURL(/\/nawyki\/archiwum$/);
    await page.getByRole("button", { name: "Przywróć" }).filter({ visible: true }).click();
    await expect(page.getByText("Archiwum jest puste.")).toBeVisible();
    await page.goto("/nawyki");
    await expect(web.getByRole("link", { name: "Medytacja" })).toBeVisible();
  });

  test("nawyk „Ilość”: połowa celu nie odhacza, „Cały cel” odhacza", async ({
    page,
  }, info) => {
    await zalozKontoNawykow(page, info.project.name);
    await page.goto("/nawyki");
    const web = page.getByTestId("web-nawyki");
    await web.getByRole("button", { name: "Nowy nawyk", exact: true }).first().click();
    const okno = page.getByRole("dialog", { name: "Nowy nawyk" });
    await okno.getByLabel("Nazwa").fill("Woda");
    await okno.getByRole("radio", { name: "Ilość" }).click();
    await okno.getByLabel("Ilość", { exact: true }).fill("2");
    await okno.getByLabel("Jednostka").fill("l");
    await okno.getByRole("button", { name: "Dodaj nawyk" }).click();
    await expect(okno).toBeHidden();

    await web.getByRole("button", { name: "Woda: 0 z 2 l" }).click();
    const dymek = page.getByRole("dialog", { name: "Ilość: Woda" });
    await dymek.getByLabel("Zrobiona ilość").fill("1");
    await dymek.getByRole("button", { name: "Zapisz" }).click();
    await expect(web.getByText("0/1 dziś")).toBeVisible();

    await web.getByRole("button", { name: "Woda: 1 z 2 l" }).click();
    await dymek.getByRole("button", { name: "Cały cel" }).click();
    await expect(web.getByRole("button", { name: "Woda: 2 z 2 l" })).toBeVisible();
    await expect(web.getByText("1/1 dziś")).toBeVisible();
  });
});

test.describe("nawyki i sen (telefon)", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "mobile", "układ telefonu");
  });

  test("segment „Sen” → „Dodaj wpis snu” → −/+ → Zapisz → słupek; „Nawyki” → duży checkbox → pierścień „1 z 1”", async ({
    page,
  }, info) => {
    const userId = await zalozKontoNawykow(page, info.project.name);
    await zasiejNawyk(userId, { name: "Czytanie" });
    await page.goto("/nawyki");
    const m = page.getByTestId("m-nawyki");

    await m.getByRole("radio", { name: "Sen" }).click();
    await m.getByRole("button", { name: "Dodaj wpis snu" }).click();
    const arkusz = page.getByRole("dialog", { name: "Wpis snu" });
    // 23:00 → 22:45 (−) i 07:00 → 07:15 (+): razem 8:30
    await arkusz.getByRole("button", { name: "Zasnąłem wcześniej" }).click();
    await arkusz.getByRole("button", { name: "Wstałem później" }).click();
    await expect(arkusz.getByTestId("zasniecie")).toHaveText("22:45");
    await expect(arkusz.getByTestId("pobudka")).toHaveText("07:15");
    await arkusz.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(arkusz).toBeHidden();

    // Dzisiejsza noc to ostatni słupek wykresu
    await expect(m.getByRole("button", { name: /· 8:30 h$/ })).toHaveCount(1);
    await expect(m.getByRole("button", { name: /· 8:30 h$/ })).toBeVisible();

    await m.getByRole("radio", { name: "Nawyki" }).click();
    const zapis = poZapisie(page);
    await m.getByRole("checkbox", { name: "Czytanie" }).click();
    await expect(m.getByRole("checkbox", { name: "Czytanie" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(m.getByRole("img", { name: "1 z 1 nawyków" })).toBeVisible();
    await expect(m.getByText("1 z 1 zrobione dziś")).toBeVisible();
    await zapis;
  });
});

test.describe("Dziś: nawyki na dziś (web)", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
  });

  test("nowe konto: „Nowy nawyk” z Pierwszych kroków → okno → zapis → kafelek „zacznij passę” → klik odhacza", async ({
    page,
  }, info) => {
    await zalozKontoNawykow(page, info.project.name);
    await page.goto("/dzis");
    const nawyki = page
      .getByTestId("web-dzis")
      .getByRole("region", { name: "Nawyki na dziś" });

    await page
      .getByTestId("web-dzis")
      .getByRole("button", { name: "Nowy nawyk", exact: true })
      .click();
    const okno = page.getByRole("dialog", { name: "Nowy nawyk" });
    await okno.getByLabel("Nazwa").fill("Woda");
    await okno.getByRole("button", { name: "Dodaj nawyk" }).click();
    await expect(okno).toBeHidden();

    const woda = nawyki.getByRole("button", { name: /Woda/ });
    await expect(woda).toContainText("zacznij passę");
    await expect(woda).toHaveAttribute("aria-pressed", "false");
    await expect(nawyki).toContainText("0 / 1");

    const zapis = poZapisie(page);
    await woda.click();
    await expect(woda).toHaveAttribute("aria-pressed", "true");
    await expect(nawyki).toContainText("1 / 1");
    await zapis;
  });
});
