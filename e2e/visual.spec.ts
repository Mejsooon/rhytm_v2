import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import {
  zalozKontoKalendarza,
  zasiejBlok,
  zasiejOdnowienie,
  zasiejZadanie,
  WTOREK,
} from "./helpers/kalendarz";
import {
  dzisWarszawa,
  przesunDate,
  zalozKontoNawykow,
  zasiejNawyk,
  zasiejSen,
} from "./helpers/nawyki";
import {
  dzienTygodnia,
  zasiejBieg,
  zasiejSzablon,
  zasiejTrening,
} from "./helpers/sport";
import {
  utworzBooks,
  utworzProjekty,
  utworzSubscriptions,
  zalozKontoStron,
  zasiejPustaStrone,
  zasiejWiersze,
} from "./helpers/strony";
import {
  adminClient,
  createConfirmedUser,
  createUserAtOnboardingEnd,
  logInViaForm,
  randomPassword,
  uniqueEmail,
} from "./helpers/konto";

// Zrzuty ekranów do ręcznego porównania z makietami. Test pada tylko, gdy strona się nie renderuje.
// Zrzuty: test-results/visual/<ekran>-<web|mobile>.png; zrzuty makiet: `pnpm mockups:shots` → test-results/mockups/<Makieta>.png.
const KATALOG = "test-results/visual";

async function zrzut(page: Page, ekran: string, projekt: string) {
  mkdirSync(KATALOG, { recursive: true });
  // Czcionki z pakietu `geist` muszą się załadować, zanim zrobimy zrzut
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `${KATALOG}/${ekran}-${projekt}.png`,
    fullPage: true,
  });
}

// Ekrany bez sesji: ścieżka, nagłówek strony (dowód renderu) i makiety (web / telefon)
const EKRANY_PUBLICZNE = [
  {
    ekran: "logowanie",
    sciezka: "/logowanie",
    tekst: /Zaloguj się do rhytm|Witaj z powrotem/,
    makieta: "CLogin / CMLogin",
  },
  {
    ekran: "rejestracja",
    sciezka: "/rejestracja",
    tekst: "Załóż konto",
    makieta: "CRegister / CMRegister",
  },
  {
    ekran: "reset-hasla",
    sciezka: "/reset-hasla",
    tekst: /Nie pamiętasz hasła\?|Reset hasła/,
    makieta: "CForgot / CMForgot",
  },
  {
    ekran: "link-wygasl",
    sciezka: "/link-wygasl",
    tekst: "Link wygasł",
    makieta: "CEmailConfirmed / CMEmailLink (stan „Link wygasł”)",
  },
];

for (const { ekran, sciezka, tekst, makieta } of EKRANY_PUBLICZNE) {
  test(`zrzut ${sciezka} (makieta ${makieta})`, async ({ page }, info) => {
    await page.goto(sciezka);
    await expect(
      page.getByRole("heading", { level: 1, name: tekst }),
    ).toBeVisible();
    await zrzut(page, ekran, info.project.name);
  });
}

test("zrzut 404 dla gościa (makieta CNotFound)", async ({ page }, info) => {
  // /dev/* przechodzi przez proxy bez logowania, więc zwykła 404 pokazuje się gościowi bez przekierowania
  const odpowiedz = await page.goto("/dev/nie-ma-takiej-strony");
  expect(odpowiedz?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Tej strony nie ma" }),
  ).toBeVisible();
  await zrzut(page, "404", info.project.name);
});

test("zrzut /potwierdzono (makiety CEmailConfirmed, CMEmailLink)", async ({
  page,
}, info) => {
  await page.goto("/potwierdzono");
  await expect(
    page.getByRole("heading", { name: "E-mail potwierdzony" }),
  ).toBeVisible();
  await zrzut(page, "potwierdzono", info.project.name);
});

test("zrzut /dev/kontrolki (bez makiety)", async ({ page }, info) => {
  // Strona istnieje tylko poza produkcją; na `pnpm start` zwraca 404
  const odpowiedz = await page.goto("/dev/kontrolki");
  test.skip(
    odpowiedz?.status() === 404,
    "/dev/kontrolki działa tylko w trybie dev",
  );
  await zrzut(page, "kontrolki", info.project.name);
});

test.describe("ekrany z sesją", () => {
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("zrzut /dzis, pusty (makiety S2EmptyToday, CMEmptyToday)", async ({
    page,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);
    // Ten sam tekst pustego planu jest w obu układach — zawężamy do aktywnego
    await expect(
      page
        .getByTestId(info.project.name === "web" ? "web-dzis" : "m-dzis")
        .getByText("Nie masz jeszcze bloków na dziś."),
    ).toBeVisible();
    await zrzut(page, "dzis", info.project.name);
  });

  test("zrzuty /dzis, pełne (makiety S2Today, CMToday, CMQuickAdd)", async ({
    page,
  }, info) => {
    const projekt = info.project.name;
    const { userId, kategorie } = await zalozKontoKalendarza(page, projekt);
    const dzis = dzisWarszawa();
    // Bloki dnia (jeden z zadaniami), nawyki, bieg i siłownia, sen z kilku nocy
    const matematyka = await zasiejBlok(userId, {
      title: "Matematyka",
      date: dzis,
      startMin: 600,
      durationMin: 90,
      categoryId: kategorie["Nauka"],
    });
    await zasiejZadanie(userId, matematyka, dzis, "Zadania z analizy", true);
    await zasiejZadanie(userId, matematyka, dzis, "Powtórka wzorów");
    await zasiejZadanie(userId, matematyka, dzis, "Lista 4");
    await zasiejBlok(userId, {
      title: "Projekt",
      date: dzis,
      startMin: 780,
      durationMin: 120,
      categoryId: kategorie["Praca"],
    });
    await zasiejBlok(userId, {
      title: "Angielski",
      date: dzis,
      startMin: 1200,
      durationMin: 60,
      categoryId: kategorie["Nauka"],
    });
    await zasiejBieg(userId, { dniTemu: 0, km: 8, sekundy: 2880 });
    await zasiejBieg(userId, {
      dniTemu: 2,
      km: 6,
      sekundy: 1860,
      kind: "tempo",
    });
    await zasiejSzablon(userId, {
      name: "Push",
      weekdays: [dzienTygodnia(dzis)],
      startTime: "18:00",
      cwiczenia: [{ name: "Wyciskanie leżąc", sets: 3, reps: "8" }],
    });
    const woda = await zasiejNawyk(userId, { name: "Woda 2 l" });
    await zasiejNawyk(userId, { name: "Czytanie" });
    await zasiejNawyk(userId, { name: "Rozciąganie" });
    const { error } = await adminClient()
      .from("habit_checks")
      .insert(
        [0, 1, 2].map((i) => ({
          habit_id: woda,
          user_id: userId,
          date: przesunDate(dzis, -i),
        })),
      );
    if (error)
      throw new Error(`Nie udało się zasiać odhaczeń: ${error.message}`);
    for (let i = 0; i < 4; i++)
      await zasiejSen(userId, i, i % 2 === 0 ? "23:15" : "00:05", "07:00");
    await page.goto("/dzis");
    if (projekt === "web") {
      const web = page.getByTestId("web-dzis");
      await expect(
        web.getByRole("heading", { name: "Plan dnia" }),
      ).toBeVisible();
      await zrzut(page, "dzis-pelne", projekt);

      // Dymek bloku na planie dnia (ten sam co w kalendarzu)
      await web
        .getByTestId("plan-dnia-lista")
        .locator(`[data-occurrence-key^="${matematyka}"]`)
        .click();
      await expect(
        page.getByRole("dialog", { name: "Szczegóły bloku" }),
      ).toContainText("1 z 3");
      await zrzut(page, "dzis-dymek-bloku", projekt);
    } else {
      const m = page.getByTestId("m-dzis");
      await expect(m.getByRole("button", { name: /Woda 2 l/ })).toBeVisible();
      await zrzut(page, "dzis-pelne", projekt);

      await m.getByRole("button", { name: "Szybko dodaj" }).click();
      await expect(
        page.getByRole("dialog", { name: "Szybko dodaj" }),
      ).toBeVisible();
      await zrzut(page, "dzis-szybko-dodaj", projekt);
    }
  });

  test("zrzuty /onboarding/1–7 (makiety COnboarding… / CMOnboarding)", async ({
    page,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createUserAtOnboardingEnd(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/onboarding\/7$/);
    // Makiety: COnboarding (1), COnboardingRole (2), COnboardingGoals (3), COnboardingSource (4), COnboardingPages (5), COnboardingNotify (6), COnboardingDone (7)
    for (const krok of [1, 2, 3, 4, 5, 6, 7]) {
      await page.goto(`/onboarding/${krok}`);
      await expect(
        page.getByRole("progressbar", { name: "Postęp onboardingu" }),
      ).toHaveAttribute("aria-valuenow", String(krok));
      await zrzut(page, `onboarding-${krok}`, info.project.name);
    }
  });

  test("zrzuty /ustawienia i /ustawienia/ogolne (makiety Settings, CMSettings, CMSettingsGeneral)", async ({
    page,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);
    // Indeks (CMSettings) to ekran telefonu; web pokazuje tu tylko link do Ogólnych
    await page.goto("/ustawienia");
    await zrzut(page, "ustawienia-indeks", info.project.name);
    await page.goto("/ustawienia/ogolne");
    await expect(
      page.getByRole("heading", { name: "Profil", exact: true }),
    ).toBeVisible();
    await zrzut(page, "ustawienia-ogolne", info.project.name);
  });

  test("zrzuty /ustawienia/konto i /ustawienia/powiadomienia (makiety S2SettingsAccount, S2SettingsNotifications, CMSettingsAccount, CMSettingsNotifications)", async ({
    page,
  }, info) => {
    const projekt = info.project.name;
    const userId = await zalozKontoNawykow(page, projekt);
    // Trzy nawyki jak w makiecie; dwa z przypomnieniem
    const woda = await zasiejNawyk(userId, { name: "Woda 2 l" });
    await zasiejNawyk(userId, {
      name: "Rozciąganie",
      type: "weekdays",
      weekdays: [1, 3, 5, 7],
    });
    await zasiejNawyk(userId, {
      name: "Angielski",
      type: "times_per_week",
      timesPerWeek: 4,
    });
    const admin = adminClient();
    await admin.from("habits").update({ remind_at: "12:00" }).eq("id", woda);
    await admin
      .from("notification_settings")
      .upsert(
        { user_id: userId, habits_enabled: true, quiet_enabled: true },
        { onConflict: "user_id" },
      );

    await page.goto("/ustawienia/konto");
    await expect(
      page.getByRole("heading", { name: "Sesje", exact: true }),
    ).toBeVisible();
    await zrzut(page, "ustawienia-konto", projekt);

    await page.goto("/ustawienia/powiadomienia");
    await expect(
      page.getByRole("heading", { name: "Przypomnienia nawyków" }),
    ).toBeVisible();
    // Stan push wykryty po stronie przeglądarki (w CI bez VAPID: „nieskonfigurowany”)
    await expect(
      page
        .getByTestId("karta-powiadomienia")
        .getByRole("switch", { name: "Push na tym urządzeniu" }),
    ).toHaveAttribute("aria-disabled", "true");
    await zrzut(page, "ustawienia-powiadomienia", projekt);
  });

  test("zrzut 404 po zalogowaniu (makieta CNotFound)", async ({
    page,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);
    await page.goto("/xyz");
    await expect(
      page.getByRole("heading", { name: "Tej strony nie ma" }),
    ).toBeVisible();
    await zrzut(page, "404-zalogowany", info.project.name);
  });

  test("zrzuty /kalendarz i /ustawienia/kalendarz (makiety Calendar…, MCalendar…, BlockDialog, ScopeDialog, CategoryDialog, Settings)", async ({
    page,
  }, info) => {
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
    await zasiejBlok(userId, {
      title: "Bieg",
      date: "2027-01-13",
      startMin: 420,
      categoryId: kategorie["Sport"],
    });
    await zasiejBlok(userId, {
      title: "Projekt",
      date: WTOREK,
      startMin: 840,
      durationMin: 120,
      categoryId: kategorie["Praca"],
    });
    await zasiejBlok(userId, {
      title: "Siłownia",
      date: "2027-01-14",
      startMin: 1080,
      categoryId: kategorie["Sport"],
    });

    const tydzien = `/kalendarz?widok=tydzien&data=${WTOREK}`;
    const blok = page.getByRole("button", { name: /Matematyka/ });

    if (projekt === "web") {
      await page.goto(tydzien);
      await expect(blok).toBeVisible();
      await zrzut(page, "kalendarz-tydzien", projekt);

      // Dymek bloku i okno zakresu (edycja bloku z serii)
      await blok.click();
      await expect(
        page.getByRole("dialog", { name: "Szczegóły bloku" }),
      ).toContainText("1 z 2");
      await zrzut(page, "kalendarz-dymek-bloku", projekt);
      await page.getByRole("button", { name: "Edytuj" }).click();
      await expect(
        page.getByRole("dialog", { name: "Edytuj blok" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Zapisz blok" }).click();
      await expect(
        page.getByRole("dialog", {
          name: "Zmieniasz blok, który się powtarza",
        }),
      ).toBeVisible();
      await zrzut(page, "kalendarz-okno-zakresu", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      // Anuluj w oknie zakresu wraca do formularza bloku
      await expect(
        page.getByRole("dialog", { name: "Edytuj blok" }),
      ).toBeVisible();
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await page.getByRole("button", { name: "Nowy blok" }).click();
      await expect(
        page.getByRole("dialog", { name: "Nowy blok" }),
      ).toBeVisible();
      await zrzut(page, "kalendarz-okno-nowy-blok", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();

      await page.getByRole("button", { name: "Nowa kategoria" }).click();
      await expect(
        page.getByRole("dialog", { name: "Nowa kategoria" }),
      ).toBeVisible();
      await zrzut(page, "kalendarz-okno-kategorii", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();

      await page.goto(`/kalendarz?widok=dzien&data=${WTOREK}`);
      await expect(page.getByRole("complementary", { name: "Plan dnia" })).toBeVisible();
      await zrzut(page, "kalendarz-dzien", projekt);

      await page.goto(`/kalendarz?widok=miesiac&data=${WTOREK}`);
      await expect(page.getByTestId(`komorka-${WTOREK}`)).toBeVisible();
      await zrzut(page, "kalendarz-miesiac", projekt);
    } else {
      // Telefon: dzień (domyślny widok), tydzień, miesiąc i arkusz nowego bloku
      await page.goto(`/kalendarz?widok=dzien&data=${WTOREK}`);
      await expect(blok).toBeVisible();
      await zrzut(page, "kalendarz-dzien", projekt);

      await page
        .getByRole("button", { name: "Nowy wpis", exact: true })
        .click();
      await page
        .getByRole("dialog", { name: "Nowy wpis" })
        .getByRole("button", { name: /^Blok/ })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Nowy blok" }),
      ).toBeVisible();
      await zrzut(page, "kalendarz-arkusz-bloku", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();

      await page.goto(tydzien);
      await expect(blok).toBeVisible();
      await zrzut(page, "kalendarz-tydzien", projekt);

      await page.goto(`/kalendarz?widok=miesiac&data=${WTOREK}`);
      await expect(page.getByTestId("kropka-kategorii").first()).toBeVisible();
      await zrzut(page, "kalendarz-miesiac", projekt);
    }

    await page.goto("/ustawienia/kalendarz");
    await expect(
      page
        .getByTestId("karta-kategorie")
        .getByRole("heading", { name: "Kategorie" }),
    ).toBeVisible();
    await zrzut(page, "ustawienia-kategorie", projekt);
  });

  test("zrzuty odnowień w kalendarzu (makiety S2Calendar, S2CalendarRenewal, S2CalendarMonth; telefon: CMCalendarDay, CMCalendarWeek, CMCalendarMonth, CMRenewalSheet)", async ({
    page,
  }, info) => {
    const projekt = info.project.name;
    const { userId, kategorie } = await zalozKontoKalendarza(page, projekt);
    await zasiejBlok(userId, {
      title: "Matematyka",
      date: WTOREK,
      startMin: 600,
      categoryId: kategorie["Nauka"],
    });
    // Netflix w sobotę stałego tygodnia (16.01.2027), co miesiąc 43 zł
    await zasiejOdnowienie(page, userId, {
      title: "Netflix",
      amount: 43,
      date: "2027-01-16",
    });

    if (projekt === "mobile") {
      // Telefon: plakietka w pasku nad osią dnia, arkusz podglądu, lista tygodnia i miesiąc z kropką
      await page.goto("/kalendarz?widok=dzien&data=2027-01-16");
      const plakietka = page.getByRole("button", { name: "↻ Netflix · 43,00 zł" });
      await expect(plakietka).toBeVisible();
      await zrzut(page, "kalendarz-dzien-odnowienie", projekt);
      await plakietka.click();
      await expect(
        page.getByRole("dialog", { name: "Odnowienie Netflix" }),
      ).toContainText("Tylko podgląd");
      await zrzut(page, "kalendarz-arkusz-odnowienia", projekt);
      await page.getByRole("button", { name: "Zamknij" }).click();

      await page.goto(`/kalendarz?widok=tydzien&data=${WTOREK}`);
      await expect(
        page.getByRole("button", { name: /↻ Netflix/ }),
      ).toBeVisible();
      await zrzut(page, "kalendarz-tydzien-odnowienie", projekt);

      await page.goto(`/kalendarz?widok=miesiac&data=2027-01-16`);
      await expect(page.getByTestId("kropka-odnowienia")).toBeVisible();
      await zrzut(page, "kalendarz-miesiac-odnowienie", projekt);
      return;
    }

    await page.goto(`/kalendarz?widok=tydzien&data=${WTOREK}`);
    const wpis = page.getByRole("button", { name: "Netflix · 43,00 zł" });
    await expect(wpis).toBeVisible();
    await wpis.click();
    await expect(
      page.getByRole("dialog", { name: "Odnowienie Netflix" }),
    ).toContainText("Tylko podgląd");
    await zrzut(page, "kalendarz-dymek-odnowienia", projekt);

    await page.goto(`/kalendarz?widok=miesiac&data=${WTOREK}`);
    await expect(
      page
        .getByTestId("komorka-2027-01-16")
        .getByRole("button", { name: "Odnowienie Netflix" }),
    ).toBeVisible();
    await zrzut(page, "kalendarz-miesiac-odnowienie", projekt);
  });

  test("zrzuty /nawyki i /nawyki/[id] (makiety Habits, HabitDetail, HabitDialog, SleepDialog, CMHabits, CMSleep, CMHabitNew, CMHabitDetail)", async ({
    page,
  }, info) => {
    const projekt = info.project.name;
    const userId = await zalozKontoNawykow(page, projekt);
    // Dwa nawyki z historią odhaczeń z ostatnich dni i 10 nocy snu; daty względem dziś, bo ekran zawsze pokazuje „dziś”
    const dzis = dzisWarszawa();
    const woda = await zasiejNawyk(userId, { name: "Woda 2 l", odDni: 40 });
    const czytanie = await zasiejNawyk(userId, {
      name: "Czytanie",
      odDni: 40,
      type: "weekdays",
      weekdays: [1, 2, 3, 4, 5],
    });
    const odhaczenia = [];
    for (let i = 1; i <= 20; i++) {
      if (i % 4 !== 0)
        odhaczenia.push({
          habit_id: woda,
          user_id: userId,
          date: przesunDate(dzis, -i),
        });
      if (i % 3 !== 0)
        odhaczenia.push({
          habit_id: czytanie,
          user_id: userId,
          date: przesunDate(dzis, -i),
        });
    }
    const { error } = await adminClient()
      .from("habit_checks")
      .insert(odhaczenia);
    if (error)
      throw new Error(`Nie udało się zasiać odhaczeń: ${error.message}`);
    for (let i = 0; i < 10; i++)
      await zasiejSen(
        userId,
        i,
        i % 3 === 0 ? "00:10" : "23:15",
        i % 2 === 0 ? "07:05" : "06:40",
      );

    await page.goto("/nawyki");
    if (projekt === "web") {
      const web = page.getByTestId("web-nawyki");
      await expect(web.getByRole("link", { name: "Woda 2 l" })).toBeVisible();
      await zrzut(page, "nawyki", projekt);

      await web
        .getByRole("button", { name: "Nowy nawyk", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Nowy nawyk" }),
      ).toBeVisible();
      await zrzut(page, "nawyki-okno-nawyku", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await web.getByRole("button", { name: "+ Wpis snu" }).click();
      await expect(
        page.getByRole("dialog", { name: "Wpis snu" }),
      ).toBeVisible();
      await zrzut(page, "nawyki-okno-snu", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await page.goto(`/nawyki/${woda}`);
      await expect(
        page
          .getByTestId("web-nawyk")
          .getByRole("heading", { name: "Woda 2 l", level: 1 }),
      ).toBeVisible();
      await zrzut(page, "nawyk-szczegoly", projekt);
    } else {
      const m = page.getByTestId("m-nawyki");
      await expect(m.getByRole("checkbox", { name: "Woda 2 l" })).toBeVisible();
      await zrzut(page, "nawyki", projekt);

      await m.getByRole("button", { name: "Nowy nawyk", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Nowy nawyk" }),
      ).toBeVisible();
      await zrzut(page, "nawyki-arkusz-nawyku", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await m.getByRole("radio", { name: "Sen" }).click();
      await expect(
        m.getByRole("button", { name: "Dodaj wpis snu" }),
      ).toBeVisible();
      await zrzut(page, "nawyki-sen", projekt);
      await m.getByRole("button", { name: "Dodaj wpis snu" }).click();
      await expect(
        page.getByRole("dialog", { name: "Wpis snu" }),
      ).toBeVisible();
      await zrzut(page, "nawyki-arkusz-snu", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();

      await page.goto(`/nawyki/${woda}`);
      await expect(
        page
          .getByTestId("m-nawyk")
          .getByRole("heading", { name: "Woda 2 l", level: 1 }),
      ).toBeVisible();
      await zrzut(page, "nawyk-szczegoly", projekt);
    }
  });

  test("zrzuty /sport i podstron (makiety Sport, RunDialog, GymLog, WorkoutTemplates, TemplateEditor, ExerciseDetail, CMSport, CMRunNew, CMGym, CMWorkoutTemplates, CMExerciseDetail)", async ({
    page,
  }, info) => {
    const projekt = info.project.name;
    const userId = await zalozKontoNawykow(page, projekt);
    // Szablon na pojutrze (plan w kalendarzu), biegi z ostatnich tygodni i dwa treningi siłowe z seriami
    const dzis = dzisWarszawa();
    const { id: szablonId, cwiczenia } = await zasiejSzablon(userId, {
      name: "Push",
      weekdays: [dzienTygodnia(przesunDate(dzis, 2))],
      startTime: "18:30",
      cwiczenia: [
        { name: "Wyciskanie leżąc", sets: 3, reps: "8–10" },
        { name: "Wyciskanie nad głowę", sets: 3, reps: "10" },
      ],
    });
    for (const [dniTemu, km, sekundy, kind] of [
      [1, 8, 2880, "easy"],
      [4, 6, 1860, "tempo"],
      [8, 12, 4500, "long"],
      [12, 8, 2850, "easy"],
      [19, 10, 3420, "easy"],
      [26, 5, 1500, "intervals"],
    ] as const) {
      await zasiejBieg(userId, { dniTemu, km, sekundy, kind });
    }
    const lezac = cwiczenia["Wyciskanie leżąc"];
    const nadGlowe = cwiczenia["Wyciskanie nad głowę"];
    await zasiejTrening(userId, {
      dniTemu: 7,
      title: "Push",
      serie: [
        [60, 60, 57.5].map((kg) => ({ exerciseId: lezac, kg, reps: 8 })),
        [35, 35, 35].map((kg) => ({ exerciseId: nadGlowe, kg, reps: 10 })),
      ],
    });
    const trening = await zasiejTrening(userId, {
      dniTemu: 2,
      title: "Push",
      serie: [
        [62.5, 62.5, 60].map((kg) => ({ exerciseId: lezac, kg, reps: 8 })),
        [35, 37.5, 37.5].map((kg) => ({ exerciseId: nadGlowe, kg, reps: 9 })),
      ],
    });

    await page.goto("/sport");
    if (projekt === "web") {
      const web = page.getByTestId("web-sport");
      await expect(
        web.getByRole("heading", { name: "Sport", level: 1 }),
      ).toBeVisible();
      await zrzut(page, "sport", projekt);

      await web.getByRole("button", { name: "Dodaj aktywność" }).click();
      await page.getByRole("button", { name: "Bieg", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Nowy bieg" }),
      ).toBeVisible();
      await zrzut(page, "sport-okno-biegu", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();
    } else {
      const m = page.getByTestId("m-sport");
      await expect(m.getByRole("heading", { name: "Ostatnie" })).toBeVisible();
      await zrzut(page, "sport", projekt);

      await m.getByRole("button", { name: "Bieg", exact: true }).click();
      await expect(
        page.getByRole("dialog", { name: "Nowy bieg" }),
      ).toBeVisible();
      await zrzut(page, "sport-arkusz-biegu", projekt);
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page.getByRole("dialog")).toBeHidden();
    }

    // Trening siłowy (GymLog / MGym)
    await page.goto(`/sport/trening/${trening}`);
    await expect(
      page
        .getByTestId(projekt === "web" ? "web-gym" : "m-gym")
        .getByRole("heading", { name: "Push", level: 1 }),
    ).toBeVisible();
    await zrzut(page, "sport-trening", projekt);

    // Szablony: lista i edytor (jedno drzewo, nagłówek telefonu osobno); szczegóły ćwiczenia (osobne układy web i telefon, widoczny jeden)
    await page.goto("/sport/szablony");
    await expect(
      page.getByRole("heading", { name: "Szablony treningów", level: 1 }),
    ).toBeVisible();
    await zrzut(page, "sport-szablony", projekt);

    await page.goto(`/sport/szablony/${szablonId}`);
    await expect(
      page.getByRole("heading", { name: "Edytuj szablon", level: 1 }),
    ).toBeVisible();
    await zrzut(page, "sport-szablon-edytor", projekt);

    await page.goto(`/sport/cwiczenia/${lezac}`);
    await expect(
      page.getByRole("heading", { name: "Wyciskanie leżąc", level: 1 }),
    ).toBeVisible();
    await zrzut(page, "sport-cwiczenie", projekt);

    // Kalendarz główny z podglądem treningów (tydzień z treningiem sprzed 2 dni)
    await page.goto(`/kalendarz?widok=tydzien&data=${przesunDate(dzis, -2)}`);
    await expect(
      page.getByRole("link", { name: /Push/ }).first(),
    ).toBeVisible();
    await zrzut(page, "kalendarz-sport", projekt);
  });

  test("zrzuty /hasla (makiety S2VaultSetup, S2Passwords, S2Vault; telefon: CMVaultSetup, CMPasswords, CMVault, CMVaultReset)", async ({
    page,
  }, info) => {
    // PBKDF2 przy ustawieniu sejfu
    test.setTimeout(90_000);
    const projekt = info.project.name;
    await zalozKontoStron(page, projekt);

    // Ustawianie hasła głównego (S2VaultSetup / CMVaultSetup)
    await page.goto("/hasla");
    const ustawianie = page.getByRole("form", {
      name: "Ustaw hasło główne sejfu",
    });
    await expect(ustawianie).toBeVisible();
    await zrzut(page, "hasla-ustawianie", projekt);
    const glowne = `Glowne-${Date.now()}-Kl3ucz!Dluuugie`;
    await ustawianie.getByLabel("Hasło główne", { exact: true }).fill(glowne);
    await ustawianie.getByLabel("Powtórz", { exact: true }).fill(glowne);
    await ustawianie
      .getByRole("checkbox", {
        name: "Rozumiem, że zapomnianego hasła głównego nie da się odzyskać.",
      })
      .click();
    await ustawianie.getByRole("button", { name: "Utwórz sejf" }).click();

    if (projekt === "web") {
      await expect(
        page.getByText("Odblokowany · blokada po 5 min", { exact: true }),
      ).toBeVisible({
        timeout: 20_000,
      });

      // Wiersz z hasłem (S2Passwords: odblokowany) z „Nowe hasło” w nagłówku
      await page.getByRole("button", { name: "Nowe hasło", exact: true }).click();
      const wiersz = page.locator("tbody tr:has(input)");
      await expect(wiersz).toHaveCount(1);
      const serwis = wiersz.getByRole("textbox", {
        name: "Serwis",
        exact: true,
      });
      await serwis.fill("GitHub");
      await serwis.press("Enter");
      const login = wiersz.getByRole("textbox", {
        name: "Login",
        exact: true,
      });
      await login.fill("mejson");
      await login.press("Enter");
      await wiersz.getByRole("button", { name: "Hasło: puste" }).click();
      const haslo = wiersz.getByRole("textbox", {
        name: "Hasło",
        exact: true,
      });
      await haslo.fill("Przykladowe-Haslo-1!");
      await haslo.press("Enter");
      await expect(
        wiersz.getByRole("button", { name: "Hasło: zaszyfrowane" }),
      ).toBeVisible();
      await page.waitForLoadState("networkidle");
      await zrzut(page, "hasla-odblokowane", projekt);

      // Zablokowany sejf (S2Vault): tabela pod rozmyciem, okno „Odblokuj sejf” na środku, bez tytułu „Hasła”
      await page.getByRole("button", { name: "Zablokuj teraz" }).click();
      await expect(
        page.getByRole("heading", { name: "Odblokuj sejf" }),
      ).toBeVisible();
      await zrzut(page, "hasla-zablokowane", projekt);

      // Reset sejfu (S2VaultReset) z okna odblokowania
      await page
        .getByRole("button", { name: "Nie pamiętam hasła — zresetuj sejf" })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Zresetować sejf?" }),
      ).toBeVisible();
      await zrzut(page, "hasla-reset", projekt);
      return;
    }

    // Telefon: lista (CMPasswords) z jednym hasłem dodanym przez „Nowe hasło” (arkusz wiersza)
    await expect(
      page.getByText(/^odblokowany · auto-blokada za /),
    ).toBeVisible({
      timeout: 20_000,
    });
    await page.getByRole("button", { name: "Nowe hasło" }).click();
    const arkusz = page.getByRole("dialog", { name: "Nowy wiersz" });
    await expect(arkusz).toBeVisible();
    await arkusz.getByLabel("Serwis", { exact: true }).fill("GitHub");
    await arkusz.getByLabel("Login", { exact: true }).fill("mejson");
    await arkusz
      .getByRole("textbox", { name: "Hasło", exact: true })
      .fill("Przykladowe-Haslo-1!");
    await arkusz.getByRole("button", { name: "Zapisz" }).click();
    await expect(arkusz).toHaveCount(0);
    const wierszTelefonu = page.getByRole("button", { name: /^GitHub/ });
    await expect(wierszTelefonu).toBeVisible();
    await page.waitForLoadState("networkidle");
    await zrzut(page, "hasla-lista", projekt);

    // Rozwinięty wiersz (hasło pod maską, oczko, kopiowanie, „Edytuj”)
    await wierszTelefonu.click();
    await expect(wierszTelefonu).toHaveAttribute("aria-expanded", "true");
    await zrzut(page, "hasla-rozwiniete", projekt);

    // Zablokowany sejf (CMVault) i reset (CMVaultReset)
    await page.getByRole("button", { name: "Zablokuj sejf" }).click();
    await expect(
      page.getByRole("heading", { name: "Sejf jest zablokowany" }),
    ).toBeVisible();
    await zrzut(page, "hasla-zablokowane", projekt);
    await page
      .getByRole("button", { name: "Nie pamiętam hasła — zresetuj sejf" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Zresetować sejf?" }),
    ).toBeVisible();
    await zrzut(page, "hasla-reset", projekt);
  });

  test("zrzuty /strony (makiety S2NewPage, S2EmptyPage, S2Books, S2ColumnMenu, S2FilterPopover, S2TableMenu, S2PageMenu, S2SidebarCollapsed, S2CardMenu, S2CardDialog, MPages, MEditor; telefon: CMPages, CMNewPage, CMEditor, CMPageMenu, CMFilterSheet, CMCardSheet, CMRowEdit)", async ({
    page,
  }, info) => {
    const projekt = info.project.name;
    const userId = await zalozKontoStron(page, projekt);

    // Wybór szablonu (NewPage)
    await page.goto("/strony/nowa");
    await expect(
      page.getByRole("heading", { name: "Nowa strona", level: 2 }),
    ).toBeVisible();
    await zrzut(page, "strony-nowa", projekt);

    // Strona z szablonu Books (Books, ColumnMenu, FilterPopover)
    await utworzBooks(page);
    await zrzut(page, "strony-books", projekt);
    if (projekt !== "web") {
      // Telefon: arkusz „Filtr i sortowanie” (CMFilterSheet) i menu strony (CMPageMenu)
      await page.getByRole("button", { name: "Filtr i sortowanie" }).click();
      await expect(
        page.getByRole("dialog", { name: "Filtr i sortowanie" }),
      ).toBeVisible();
      await zrzut(page, "strony-filtr-arkusz", projekt);
      await page.getByRole("button", { name: "Gotowe" }).click();
    }
    if (projekt === "web") {
      await page
        .getByRole("columnheader")
        .getByRole("button", { name: "Status", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Kolumna Status" }),
      ).toBeVisible();
      await zrzut(page, "strony-menu-kolumny", projekt);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "Filtruj", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "Filtr" })).toBeVisible();
      await zrzut(page, "strony-filtr", projekt);
      await page.keyboard.press("Escape");
      // Menu „⋯” tabeli (S2TableMenu)
      await page.getByRole("button", { name: "Menu tabeli" }).click();
      await expect(
        page.getByRole("dialog", { name: "Ustawienia tabeli" }),
      ).toBeVisible();
      await zrzut(page, "strony-menu-tabeli", projekt);
      await page.keyboard.press("Escape");
      // Menu strony „⋯” w pasku bocznym (S2PageMenu)
      await page
        .getByRole("button", { name: "Menu strony Książki", exact: true })
        .click();
      await expect(
        page.getByRole("menu", { name: "Strona Książki" }),
      ).toBeVisible();
      await zrzut(page, "strony-menu-strony", projekt);
      await page.keyboard.press("Escape");
      // Schowany pasek boczny (S2SidebarCollapsed); potem z powrotem, żeby dalsze zrzuty miały pasek
      await page.keyboard.press("Control+\\");
      await expect(
        page.getByRole("navigation", { name: "Główna nawigacja (zwinięta)" }),
      ).toBeVisible();
      await zrzut(page, "strony-books-schowany-pasek", projekt);
      await page.keyboard.press("Control+\\");
      await expect(
        page.getByRole("navigation", { name: "Główna nawigacja", exact: true }),
      ).toBeVisible();

      // Okienko opcji komórki Status (S2Books, tsel) w nowym wierszu
      // „Nowy wiersz” zakłada wiersz na serwerze: wiersz pojawia się dopiero po odpowiedzi
      await page.getByRole("button", { name: "Nowy wiersz", exact: true }).last().click();
      await expect(page.locator("tbody tr:has(input)")).toHaveCount(1);
      await page
        .locator("tbody tr")
        .getByRole("button", { name: /^Status: / })
        .click();
      await expect(
        page.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      ).toBeVisible();
      await zrzut(page, "strony-okienko-opcji", projekt);
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      ).toHaveCount(0);

      // Menu karty (S2CardMenu) na pierwszej karcie
      const karta = page.getByTestId("karta").first();
      await karta.hover();
      await karta.getByRole("button", { name: "Menu karty" }).click();
      await expect(
        page.getByRole("menu", { name: "Menu karty" }),
      ).toBeVisible();
      await zrzut(page, "strony-menu-karty", projekt);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("menu", { name: "Menu karty" })).toHaveCount(
        0,
      );

      // Okno nowej karty (S2CardDialog)
      await page
        .getByRole("button", { name: "Dodaj kartę", exact: true })
        .click();
      await expect(
        page.getByRole("dialog", { name: "Nowa karta" }),
      ).toBeVisible();
      await zrzut(page, "strony-okno-karty", projekt);
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "Nowa karta" }),
      ).toHaveCount(0);
    }

    // Edytor z tabelą (EmptyPage / MEditor). Na webie „Nowa strona” prowadzi do wyboru szablonu,
    // więc pustą stronę edytora zakładamy przez API; telefon ma przycisk „Nowa strona” na liście
    if (projekt === "web") {
      const idStrony = await zasiejPustaStrone(userId);
      await page.goto(`/strony/${idStrony}`);
    } else {
      await page.goto("/strony");
      await page.getByRole("link", { name: "Nowa strona" }).first().click();
      await expect(page).toHaveURL(/\/strony\/nowa$/);
      await page.getByRole("button", { name: "Utwórz", exact: true }).click();
    }
    await expect(page).toHaveURL(/\/strony\/[0-9a-f-]{36}$/);
    // Pusta strona przed pierwszym blokiem (S2EmptyPage): szybki start na webie, „Wstaw tabelę” na telefonie
    if (projekt === "web")
      await expect(page.getByText("albo zacznij od:")).toBeVisible();
    else
      await expect(
        page.getByRole("button", { name: "Wstaw tabelę" }),
      ).toBeVisible();
    await zrzut(page, "strony-pusta", projekt);
    if (projekt === "web") {
      await page.getByLabel("Nazwa strony").fill("Plan tygodnia");
      await page.getByLabel("Nazwa strony").blur();
      await page.getByRole("combobox", { name: "Nowy blok" }).fill("/tab");
      await page.getByRole("combobox", { name: "Nowy blok" }).press("Enter");
      await expect(page.getByRole("group", { name: "Zapisane widoki" })).toBeVisible();
    } else {
      await page.getByRole("button", { name: "Wstaw tabelę" }).click();
      await expect(page.getByRole("group", { name: "Zapisane widoki" })).toBeVisible();
    }
    // Kolumny pojawiają się po odpowiedzi serwera (do tego czasu blok ma tymczasowe id)
    // 3 pola + nagłówek z przyciskiem „+” (Dodaj kolumnę); na webie także zaznaczanie i „#” (S2Table),
    // na telefonie te kolumny są ukryte
    await expect(page.getByRole("columnheader")).toHaveCount(projekt === "web" ? 6 : 4, {
      timeout: 20_000,
    });
    await zrzut(page, "strony-edytor", projekt);

    // Lista stron na telefonie (MPages); na webie to samo trasa pokazuje stronę z sidebarem
    await page.goto("/strony");
    if (projekt === "mobile")
      await expect(
        page.getByRole("heading", { name: "Strony", level: 1 }),
      ).toBeVisible();
    await zrzut(page, "strony-lista", projekt);

    // Karta Kosz w Ustawieniach → Ogólne
    await page.goto("/ustawienia/ogolne#kosz");
    await expect(page.getByRole("heading", { name: "Kosz" })).toBeVisible();
    await zrzut(page, "ustawienia-kosz", projekt);
  });

  // Strony z szablonów z danymi: Książki (S2Books) i Projekty (S2Projects, także Tablica)
  test("zrzuty /strony Książki i Projekty z wierszami (makiety S2Books, S2Projects)", async ({
    page,
  }, info) => {
    const projekt = info.project.name;
    test.skip(projekt !== "web", "układ webowy (telefon ma zrzut listy w teście /strony)");
    const userId = await zalozKontoStron(page, projekt);

    await utworzBooks(page);
    const idKsiazek = page.url().split("/").at(-1)!;
    await zasiejWiersze(userId, idKsiazek, [
      { Tytuł: "Atomic Habits", Autor: "James Clear", Status: "Czytam", Ocena: 0 },
      { Tytuł: "Psychologia pieniędzy", Autor: "Morgan Housel", Status: "Przeczytane", Ocena: 5, Przeczytana: "2026-11-02" },
      { Tytuł: "Deep Work", Autor: "Cal Newport", Status: "Przeczytane", Ocena: 4, Przeczytana: "2026-10-12" },
      { Tytuł: "Clean Code", Autor: "Robert C. Martin", Status: "Chcę przeczytać", Ocena: 0 },
    ]);
    await page.reload();
    await expect(page.locator("tbody tr:has(input)")).toHaveCount(4);
    await zrzut(page, "strony-ksiazki-dane", projekt);

    await utworzProjekty(page);
    const idProjektow = page.url().split("/").at(-1)!;
    await zasiejWiersze(userId, idProjektow, [
      { Nazwa: "rhytm", Status: "W toku", Obszar: "Własne", Termin: "2026-12-15", Repo: "github.com/mejson/rhytm" },
      { Nazwa: "Projekt z baz danych", Status: "Do zrobienia", Obszar: "Studia", Termin: "2026-12-05" },
      { Nazwa: "Strona Fanaberii", Status: "Zrobione", Obszar: "Klient", Termin: "2026-11-07" },
    ]);
    await page.reload();
    // Grupa „Zrobione” jest zwinięta (szablon), więc widać dwa wiersze
    await expect(page.locator("tbody tr:has(input)")).toHaveCount(2);
    await zrzut(page, "strony-projekty", projekt);
    await page.getByRole("button", { name: "Tablica", exact: true }).click();
    await expect(
      page.getByRole("article", { name: "Projekt z baz danych" }),
    ).toBeVisible();
    await zrzut(page, "strony-projekty-tablica", projekt);
  });

  // Web: tabela i okno „Nowe pole”; telefon: ekran CMSubs i arkusz wiersza (CMRowEdit)
  test("zrzuty /strony Subscriptions (makiety S2Main, S2AddField; telefon: CMSubs, CMRowEdit)", async ({
    page,
  }, info) => {
    const projekt = info.project.name;
    const userId = await zalozKontoStron(page, projekt);
    await utworzSubscriptions(page);

    // Kilka wierszy zasiewamy przez API administratora (wartości po id pól), bo tabela wstawia je po jednym
    const idStrony = page.url().split("/").at(-1)!;
    const admin = adminClient();
    const { data: blok } = await admin
      .from("page_blocks")
      .select("id")
      .eq("page_id", idStrony)
      .eq("type", "table")
      .single();
    const { data: pola } = await admin
      .from("page_fields")
      .select("id, name, config")
      .eq("block_id", blok!.id);
    const pole = (nazwa: string) => pola!.find((f) => f.name === nazwa)!;
    const opcja = (nazwa: string, etykieta: string) =>
      (pole(nazwa).config.options as { id: string; label: string }[]).find(
        (o) => o.label === etykieta,
      )!.id;
    const wiersz = (
      nazwa: string,
      kwota: { amount: number; cycle: "month" | "year" },
      data: string,
      kategoria: string,
      aktywna: boolean,
      position: number,
    ) => ({
      // API administratora nie ma auth.uid(), więc user_id podajemy wprost (kolumna NOT NULL)
      user_id: userId,
      block_id: blok!.id,
      position,
      values: {
        [pole("Nazwa").id]: nazwa,
        [pole("Kwota cykliczna").id]: kwota,
        [pole("Data odnowienia").id]: data,
        [pole("Kategoria").id]: opcja("Kategoria", kategoria),
        [pole("Aktywna").id]: aktywna,
      },
    });
    const dzis = new Date();
    const za = (dni: number) =>
      new Date(dzis.getTime() + dni * 86_400_000).toISOString().slice(0, 10);
    const { error } = await admin
      .from("page_rows")
      .insert([
        wiersz(
          "Netflix",
          { amount: 43, cycle: "month" },
          za(6),
          "Rozrywka",
          true,
          0,
        ),
        wiersz(
          "Strava",
          { amount: 249.99, cycle: "year" },
          za(40),
          "Sport",
          true,
          1,
        ),
        wiersz(
          "Disney+",
          { amount: 37.99, cycle: "month" },
          za(9),
          "Rozrywka",
          false,
          2,
        ),
      ]);
    if (error)
      throw new Error(`Nie udało się zasiać wierszy: ${error.message}`);
    await page.reload();
    if (projekt === "mobile") {
      // CMSubs: trzy wiersze listy (jeden anulowany), sumy i pasek „Najbliżej”
      await expect(page.getByText("3 z 3 subskrypcji").filter({ visible: true })).toBeVisible();
      await zrzut(page, "strony-subscriptions", projekt);
      // CMRowEdit: arkusz wiersza Netflix (kwota z cyklem, kalendarz odnowienia, kategoria, „Aktywna”)
      await page.getByRole("button", { name: /Netflix/ }).filter({ visible: true }).click();
      await expect(page.getByRole("dialog", { name: "Netflix" })).toBeVisible();
      await zrzut(page, "strony-subscriptions-wiersz", projekt);
      return;
    }
    await expect(page.locator("tbody tr:has(input)")).toHaveCount(3);
    await expect(page.getByTestId("karta")).toHaveCount(3);
    await zrzut(page, "strony-subscriptions", projekt);

    // Okno „Nowe pole” z wybraną Kwotą cykliczną (S2AddField)
    await page.getByRole("button", { name: "Dodaj kolumnę" }).click();
    const okno = page.getByRole("dialog", { name: "Nowe pole" });
    await okno.getByRole("button", { name: /Kwota cykliczna/ }).click();
    await expect(okno.getByText("inteligentne", { exact: true })).toBeVisible();
    await zrzut(page, "strony-nowe-pole-kwota", projekt);
  });
  test("zrzuty /szukaj: pusty, z wynikami, bez wyników (makieta CMSearch)", async ({
    page,
  }, info) => {
    const projekt = info.project.name;
    const userId = await zalozKontoStron(page, projekt);
    const dzis = dzisWarszawa();
    // Dane jak w makiecie: bloki, nawyk i strona Books z wierszami
    await zasiejBlok(userId, { title: "rhytm — kod", date: dzis, startMin: 10 * 60 + 30, durationMin: 120 });
    await zasiejBlok(userId, { title: "Bazy danych — projekt", date: dzis, startMin: 19 * 60 });
    await zasiejNawyk(userId, { name: "Czytanie 20 min" });
    await utworzBooks(page);

    await page.goto("/szukaj");
    const pole = page.getByRole("searchbox", { name: "Szukaj" });
    await expect(pole).toBeVisible();
    await expect(page.getByText("Szybkie akcje")).toBeVisible();
    await zrzut(page, "szukaj-puste", projekt);

    await pole.fill("ba");
    await expect(page.getByRole("link", { name: /Bazy danych — projekt/ })).toBeVisible();
    await zrzut(page, "szukaj-wyniki", projekt);

    await pole.fill("xyz");
    await expect(page.getByText("Nic nie znaleziono dla „xyz”")).toBeVisible();
    await zrzut(page, "szukaj-brak", projekt);
  });
});
