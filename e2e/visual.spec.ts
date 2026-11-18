import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import { zalozKontoKalendarza, zasiejBlok, zasiejZadanie, WTOREK } from "./helpers/kalendarz";
import { dzisWarszawa, przesunDate, zalozKontoNawykow, zasiejNawyk, zasiejSen } from "./helpers/nawyki";
import { adminClient, createConfirmedUser, createUserAtOnboardingEnd, logInViaForm, randomPassword, uniqueEmail } from "./helpers/konto";

// Zrzuty ekranów do ręcznego porównania z makietami. Test pada tylko, gdy strona się nie renderuje.
// Zrzuty: test-results/visual/<ekran>-<web|mobile>.png; zrzuty makiet: `pnpm mockups:shots` → test-results/mockups/<Makieta>.png.
const KATALOG = "test-results/visual";

async function zrzut(page: Page, ekran: string, projekt: string) {
  mkdirSync(KATALOG, { recursive: true });
  // Czcionki z pakietu `geist` muszą się załadować, zanim zrobimy zrzut
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${KATALOG}/${ekran}-${projekt}.png`, fullPage: true });
}

// Ekrany bez sesji: ścieżka, nagłówek strony (dowód renderu) i makiety (web / telefon)
const EKRANY_PUBLICZNE = [
  { ekran: "logowanie", sciezka: "/logowanie", tekst: /Zaloguj się do rhytm|Witaj z powrotem/, makieta: "Login / MLogin" },
  { ekran: "rejestracja", sciezka: "/rejestracja", tekst: "Załóż konto", makieta: "Register / MRegister" },
  { ekran: "reset-hasla", sciezka: "/reset-hasla", tekst: /Nie pamiętasz hasła\?|Reset hasła/, makieta: "Forgot / MForgot" },
  { ekran: "link-wygasl", sciezka: "/link-wygasl", tekst: "Link wygasł", makieta: "EmailConfirmed (stan „Link wygasł”)" },
];

for (const { ekran, sciezka, tekst, makieta } of EKRANY_PUBLICZNE) {
  test(`zrzut ${sciezka} (makieta ${makieta})`, async ({ page }, info) => {
    await page.goto(sciezka);
    await expect(page.getByRole("heading", { level: 1, name: tekst })).toBeVisible();
    await zrzut(page, ekran, info.project.name);
  });
}

test("zrzut 404 dla gościa (makieta NotFound)", async ({ page }, info) => {
  // /dev/* przechodzi przez proxy bez logowania, więc zwykła 404 pokazuje się gościowi bez przekierowania
  const odpowiedz = await page.goto("/dev/nie-ma-takiej-strony");
  expect(odpowiedz?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Tej strony nie ma" })).toBeVisible();
  await zrzut(page, "404", info.project.name);
});

test("zrzut /potwierdzono (makieta EmailConfirmed)", async ({ page }, info) => {
  await page.goto("/potwierdzono");
  await expect(page.getByRole("heading", { name: "E-mail potwierdzony" })).toBeVisible();
  await zrzut(page, "potwierdzono", info.project.name);
});

test("zrzut /dev/kontrolki (bez makiety)", async ({ page }, info) => {
  // Strona istnieje tylko poza produkcją; na `pnpm start` zwraca 404
  const odpowiedz = await page.goto("/dev/kontrolki");
  test.skip(odpowiedz?.status() === 404, "/dev/kontrolki działa tylko w trybie dev");
  await zrzut(page, "kontrolki", info.project.name);
});

test.describe("ekrany z sesją", () => {
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("zrzut /dzis, pusty (makieta EmptyToday / MToday)", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);
    await expect(page.getByText("Plan dnia jest pusty")).toBeVisible();
    await zrzut(page, "dzis", info.project.name);
  });

  test("zrzuty /onboarding/1–7 (makiety Onboarding… / MOnboarding)", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createUserAtOnboardingEnd(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/onboarding\/7$/);
    // Makiety: Onboarding (1), OnboardingRole (2), OnboardingGoals (3), OnboardingSource (4), OnboardingPages (5), OnboardingNotify (6), OnboardingDone (7)
    for (const krok of [1, 2, 3, 4, 5, 6, 7]) {
      await page.goto(`/onboarding/${krok}`);
      await expect(page.getByRole("progressbar", { name: "Postęp onboardingu" })).toHaveAttribute("aria-valuenow", String(krok));
      await zrzut(page, `onboarding-${krok}`, info.project.name);
    }
  });

  test("zrzut /ustawienia/ogolne (makieta Settings)", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);
    await page.goto("/ustawienia/ogolne");
    await expect(page.getByRole("heading", { name: "Profil", exact: true })).toBeVisible();
    await zrzut(page, "ustawienia-ogolne", info.project.name);
  });

  test("zrzut 404 po zalogowaniu (makieta NotFound)", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);
    await page.goto("/xyz");
    await expect(page.getByRole("heading", { name: "Tej strony nie ma" })).toBeVisible();
    await zrzut(page, "404-zalogowany", info.project.name);
  });

  test("zrzuty /kalendarz i /ustawienia/kategorie (makiety Calendar…, MCalendar…, BlockDialog, ScopeDialog, CategoryDialog, Settings)", async ({ page }, info) => {
    const projekt = info.project.name;
    const { userId, kategorie } = await zalozKontoKalendarza(page, projekt);
    // Stały tydzień z kilkoma blokami: seria z zadaniami, blok jednorazowy i dwa nakładające się
    const matematyka = await zasiejBlok(userId, {
      title: "Matematyka",
      date: WTOREK,
      startMin: 600,
      categoryId: kategorie["Nauka"],
      recurrence: { freq: "weekly" },
    });
    await zasiejZadanie(userId, matematyka, WTOREK, "Zadania z analizy", true);
    await zasiejZadanie(userId, matematyka, WTOREK, "Powtórka wzorów");
    await zasiejBlok(userId, { title: "Bieg", date: "2027-01-13", startMin: 420, categoryId: kategorie["Sport"] });
    await zasiejBlok(userId, { title: "Projekt", date: WTOREK, startMin: 840, durationMin: 120, categoryId: kategorie["Praca"] });
    await zasiejBlok(userId, { title: "Siłownia", date: "2027-01-14", startMin: 1080, categoryId: kategorie["Sport"] });

    const tydzien = `/kalendarz?widok=tydzien&data=${WTOREK}`;
    const blok = page.getByRole("button", { name: /Matematyka/ });

    if (projekt === "web") {
      await page.goto(tydzien);
      await expect(blok).toBeVisible();
      await zrzut(page, "kalendarz-tydzien", projekt);

      // Dymek bloku i okno zakresu (edycja bloku z serii)
      await blok.click();
      await expect(page.getByRole("dialog", { name: "Szczegóły bloku" })).toContainText("1 z 2");
      await zrzut(page, "kalendarz-dymek-bloku", projekt);
      await page.getByRole("button", { name: "Edytuj" }).click();
      await expect(page.getByRole("dialog", { name: "Edytuj blok" })).toBeVisible();
      await page.getByRole("button", { name: "Zapisz blok" }).click();
      await expect(page.getByRole("dialog", { name: "Zmieniasz blok, który się powtarza" })).toBeVisible();
      await zrzut(page, "kalendarz-okno-zakresu", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      // Anuluj w oknie zakresu wraca do formularza bloku
      await expect(page.getByRole("dialog", { name: "Edytuj blok" })).toBeVisible();
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await page.getByRole("button", { name: "Nowy blok" }).click();
      await expect(page.getByRole("dialog", { name: "Nowy blok" })).toBeVisible();
      await zrzut(page, "kalendarz-okno-nowy-blok", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();

      await page.getByRole("button", { name: /^Kategorie, widoczne \d+ z \d+$/ }).click();
      await page.getByRole("menuitem", { name: "+ Kategoria" }).click();
      await expect(page.getByRole("dialog", { name: "Nowa kategoria" })).toBeVisible();
      await zrzut(page, "kalendarz-okno-kategorii", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();

      await page.goto(`/kalendarz?widok=dzien&data=${WTOREK}`);
      await expect(page.getByText("Dzień w liczbach")).toBeVisible();
      await zrzut(page, "kalendarz-dzien", projekt);

      await page.goto(`/kalendarz?widok=miesiac&data=${WTOREK}`);
      await expect(page.getByTestId(`komorka-${WTOREK}`)).toBeVisible();
      await zrzut(page, "kalendarz-miesiac", projekt);
    } else {
      // Telefon: dzień (domyślny widok), tydzień, miesiąc i arkusz nowego bloku
      await page.goto(`/kalendarz?widok=dzien&data=${WTOREK}`);
      await expect(blok).toBeVisible();
      await zrzut(page, "kalendarz-dzien", projekt);

      await page.getByRole("button", { name: "Dodaj blok", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Nowy blok" })).toBeVisible();
      await zrzut(page, "kalendarz-arkusz-bloku", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();

      await page.goto(tydzien);
      await expect(blok).toBeVisible();
      await zrzut(page, "kalendarz-tydzien", projekt);

      await page.goto(`/kalendarz?widok=miesiac&data=${WTOREK}`);
      await expect(page.getByTestId("kropka-kategorii").first()).toBeVisible();
      await zrzut(page, "kalendarz-miesiac", projekt);
    }

    await page.goto("/ustawienia/kategorie");
    await expect(page.locator("section").getByRole("heading", { name: "Kategorie kalendarza" })).toBeVisible();
    await zrzut(page, "ustawienia-kategorie", projekt);
  });

  test("zrzuty /nawyki i /nawyki/[id] (makiety Habits, HabitDetail, HabitDialog, SleepDialog, MHabits, MSleep, MHabitNew, MHabitDetail)", async ({ page }, info) => {
    const projekt = info.project.name;
    const userId = await zalozKontoNawykow(page, projekt);
    // Dwa nawyki z historią odhaczeń z ostatnich dni i 10 nocy snu; daty względem dziś, bo ekran zawsze pokazuje „dziś”
    const dzis = dzisWarszawa();
    const woda = await zasiejNawyk(userId, { name: "Woda 2 l", odDni: 40 });
    const czytanie = await zasiejNawyk(userId, { name: "Czytanie", odDni: 40, type: "weekdays", weekdays: [1, 2, 3, 4, 5] });
    const odhaczenia = [];
    for (let i = 1; i <= 20; i++) {
      if (i % 4 !== 0) odhaczenia.push({ habit_id: woda, user_id: userId, date: przesunDate(dzis, -i) });
      if (i % 3 !== 0) odhaczenia.push({ habit_id: czytanie, user_id: userId, date: przesunDate(dzis, -i) });
    }
    const { error } = await adminClient().from("habit_checks").insert(odhaczenia);
    if (error) throw new Error(`Nie udało się zasiać odhaczeń: ${error.message}`);
    for (let i = 0; i < 10; i++) await zasiejSen(userId, i, i % 3 === 0 ? "00:10" : "23:15", i % 2 === 0 ? "07:05" : "06:40");

    await page.goto("/nawyki");
    if (projekt === "web") {
      const web = page.getByTestId("web-nawyki");
      await expect(web.getByRole("link", { name: "Woda 2 l" })).toBeVisible();
      await zrzut(page, "nawyki", projekt);

      await web.getByRole("button", { name: "Nowy nawyk", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Nowy nawyk" })).toBeVisible();
      await zrzut(page, "nawyki-okno-nawyku", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await web.getByRole("button", { name: "+ Wpis snu" }).click();
      await expect(page.getByRole("dialog", { name: "Wpis snu" })).toBeVisible();
      await zrzut(page, "nawyki-okno-snu", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await page.goto(`/nawyki/${woda}`);
      await expect(page.getByTestId("web-nawyk").getByRole("heading", { name: "Woda 2 l", level: 1 })).toBeVisible();
      await zrzut(page, "nawyk-szczegoly", projekt);
    } else {
      const m = page.getByTestId("m-nawyki");
      await expect(m.getByRole("checkbox", { name: "Woda 2 l" })).toBeVisible();
      await zrzut(page, "nawyki", projekt);

      await m.getByRole("button", { name: "Nowy nawyk", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Nowy nawyk" })).toBeVisible();
      await zrzut(page, "nawyki-arkusz-nawyku", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await m.getByRole("radio", { name: "Sen" }).click();
      await expect(m.getByRole("button", { name: "Dodaj wpis snu" })).toBeVisible();
      await zrzut(page, "nawyki-sen", projekt);
      await m.getByRole("button", { name: "Dodaj wpis snu" }).click();
      await expect(page.getByRole("dialog", { name: "Wpis snu" })).toBeVisible();
      await zrzut(page, "nawyki-arkusz-snu", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await page.goto(`/nawyki/${woda}`);
      await expect(page.getByTestId("m-nawyk").getByRole("heading", { name: "Woda 2 l", level: 1 })).toBeVisible();
      await zrzut(page, "nawyk-szczegoly", projekt);
    }
  });
});
