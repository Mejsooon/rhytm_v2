import { mkdirSync } from "node:fs";

import { expect, test, type Page } from "@playwright/test";

import {
  zalozKontoKalendarza,
  zasiejBlok,
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
    makieta: "Login / MLogin",
  },
  {
    ekran: "rejestracja",
    sciezka: "/rejestracja",
    tekst: "Załóż konto",
    makieta: "Register / MRegister",
  },
  {
    ekran: "reset-hasla",
    sciezka: "/reset-hasla",
    tekst: /Nie pamiętasz hasła\?|Reset hasła/,
    makieta: "Forgot / MForgot",
  },
  {
    ekran: "link-wygasl",
    sciezka: "/link-wygasl",
    tekst: "Link wygasł",
    makieta: "EmailConfirmed (stan „Link wygasł”)",
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

test("zrzut 404 dla gościa (makieta NotFound)", async ({ page }, info) => {
  // /dev/* przechodzi przez proxy bez logowania, więc zwykła 404 pokazuje się gościowi bez przekierowania
  const odpowiedz = await page.goto("/dev/nie-ma-takiej-strony");
  expect(odpowiedz?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { name: "Tej strony nie ma" }),
  ).toBeVisible();
  await zrzut(page, "404", info.project.name);
});

test("zrzut /potwierdzono (makieta EmailConfirmed)", async ({ page }, info) => {
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

  test("zrzut /dzis, pusty (makieta EmptyToday)", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);
    await expect(page.getByText("Plan dnia jest pusty")).toBeVisible();
    await zrzut(page, "dzis", info.project.name);
  });

  test("zrzuty /dzis, pełne (makiety Today, MToday, MQuickAdd)", async ({
    page,
  }, info) => {
    const projekt = info.project.name;
    const { userId, kategorie } = await zalozKontoKalendarza(page, projekt);
    const dzis = dzisWarszawa();
    // Wszystkie cztery pierwsze kroki: bloki dnia (jeden z zadaniami), nawyki, bieg i siłownia, sen z kilku nocy
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
    // Samodzielne zadania: na dziś, zaległe i bez daty
    const { error: bladZadan } = await adminClient()
      .from("tasks")
      .insert([
        { user_id: userId, title: "Oddać książkę", due_date: dzis },
        {
          user_id: userId,
          title: "Zapłacić za internet",
          due_date: przesunDate(dzis, -2),
        },
        { user_id: userId, title: "Kupić kalendarz", due_date: null },
      ]);
    if (bladZadan)
      throw new Error(`Nie udało się zasiać zadań: ${bladZadan.message}`);

    await page.goto("/dzis");
    if (projekt === "web") {
      const web = page.getByTestId("web-dzis");
      await expect(
        web.getByRole("heading", { name: "Plan dnia" }),
      ).toBeVisible();
      await zrzut(page, "dzis-pelne", projekt);

      // Dymek bloku na planie dnia (ten sam co w kalendarzu)
      await web
        .getByTestId("os-dnia")
        .locator(`[data-occurrence-key^="${matematyka}"]`)
        .click();
      await expect(
        page.getByRole("dialog", { name: "Szczegóły bloku" }),
      ).toContainText("1 z 3");
      await zrzut(page, "dzis-dymek-bloku", projekt);
    } else {
      const m = page.getByTestId("m-dzis");
      await expect(m.getByRole("checkbox", { name: "Woda 2 l" })).toBeVisible();
      await zrzut(page, "dzis-pelne", projekt);

      await m.getByRole("button", { name: "Szybko dodaj" }).click();
      await expect(
        page.getByRole("dialog", { name: "Szybko dodaj" }),
      ).toBeVisible();
      await zrzut(page, "dzis-szybko-dodaj", projekt);
    }
  });

  test("zrzuty /onboarding/1–7 (makiety Onboarding… / MOnboarding)", async ({
    page,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createUserAtOnboardingEnd(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/onboarding\/7$/);
    // Makiety: Onboarding (1), OnboardingRole (2), OnboardingGoals (3), OnboardingSource (4), OnboardingPages (5), OnboardingNotify (6), OnboardingDone (7)
    for (const krok of [1, 2, 3, 4, 5, 6, 7]) {
      await page.goto(`/onboarding/${krok}`);
      await expect(
        page.getByRole("progressbar", { name: "Postęp onboardingu" }),
      ).toHaveAttribute("aria-valuenow", String(krok));
      await zrzut(page, `onboarding-${krok}`, info.project.name);
    }
  });

  test("zrzut /ustawienia/ogolne (makieta Settings)", async ({
    page,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);
    await page.goto("/ustawienia/ogolne");
    await expect(
      page.getByRole("heading", { name: "Profil", exact: true }),
    ).toBeVisible();
    await zrzut(page, "ustawienia-ogolne", info.project.name);
  });

  test("zrzut 404 po zalogowaniu (makieta NotFound)", async ({
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

  test("zrzuty /kalendarz i /ustawienia/kategorie (makiety Calendar…, MCalendar…, BlockDialog, ScopeDialog, CategoryDialog, Settings)", async ({
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

      await page
        .getByRole("button", { name: /^Kategorie, widoczne \d+ z \d+$/ })
        .click();
      await page.getByRole("menuitem", { name: "+ Kategoria" }).click();
      await expect(
        page.getByRole("dialog", { name: "Nowa kategoria" }),
      ).toBeVisible();
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

      await page
        .getByRole("button", { name: "Dodaj blok", exact: true })
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

    await page.goto("/ustawienia/kategorie");
    await expect(
      page
        .locator("section")
        .getByRole("heading", { name: "Kategorie kalendarza" }),
    ).toBeVisible();
    await zrzut(page, "ustawienia-kategorie", projekt);
  });

  test("zrzuty /nawyki i /nawyki/[id] (makiety Habits, HabitDetail, HabitDialog, SleepDialog, MHabits, MSleep, MHabitNew, MHabitDetail)", async ({
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

  test("zrzuty /sport i podstron (makiety Sport, RunDialog, GymLog, WorkoutTemplates, TemplateEditor, ExerciseDetail, MSport, MRunNew, MGym)", async ({
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

      await web.getByRole("button", { name: "Nowy bieg", exact: true }).click();
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

    // Szablony: lista i edytor; szczegóły ćwiczenia (jedno drzewo dla obu układów)
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
});
