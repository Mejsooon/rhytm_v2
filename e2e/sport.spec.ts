import { expect, test } from "@playwright/test";

import { adminClient } from "./helpers/konto";
import { kliknijSlot, poZapisie, WTOREK } from "./helpers/kalendarz";
import { dzisWarszawa, przesunDate, zalozKontoNawykow } from "./helpers/nawyki";
import { dzienTygodnia, etykietaDnia, zasiejSzablon } from "./helpers/sport";

// Sport pracuje na „dziś” w strefie profilu (Europe/Warsaw): wystąpienia szablonów liczą się od dziś,
// a nowy bieg z przycisku ma dzisiejszą datę. Dane zasiewamy więc względem prawdziwego dziś.
// Konta testowe nie mają kategorii, więc podgląd w kalendarzu głównym jest widoczny (brak kategorii „Sport”).

test.describe("sport (web)", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
  });

  test("„Nowy bieg” 10 km w 58:00 → tempo 5:48 → bieg w kalendarzu Sportu i głównym, plan dnia na Dziś", async ({
    page,
  }, info) => {
    await zalozKontoNawykow(page, info.project.name);
    const dzis = dzisWarszawa();
    await page.goto("/sport");
    const web = page.getByTestId("web-sport");

    await web.getByRole("button", { name: "Nowy bieg", exact: true }).click();
    const okno = page.getByRole("dialog", { name: "Nowy bieg" });
    await okno.getByLabel("Dystans (km)").fill("10");
    await okno.getByLabel("Czas", { exact: true }).fill("58:00");
    await expect(okno.getByTestId("tempo")).toHaveText("5:48 /km");
    await okno.getByRole("button", { name: "Zapisz bieg" }).click();
    await expect(okno).toBeHidden();

    // Kalendarz Sportu: wykonany bieg w dzisiejszej komórce
    await expect(
      web.getByRole("button", {
        name: `Spokojny, ${etykietaDnia(dzis)}`,
        exact: true,
      }),
    ).toBeVisible();

    // Kalendarz główny: podgląd prowadzi do dymku biegu na /sport
    await page.goto(`/kalendarz?widok=tydzien&data=${dzis}`);
    const podglad = page.getByRole("link", { name: /Spokojny/ });
    await expect(podglad).toBeVisible();
    await expect(podglad).toHaveAttribute(
      "href",
      new RegExp(`^/sport\\?miesiac=${dzis.slice(0, 7)}&wybrany=s:`),
    );
    await podglad.click();
    await expect(page).toHaveURL(/\/sport\?miesiac=.*&wybrany=s:/);
    await expect(page.getByRole("dialog", { name: "Spokojny" })).toBeVisible();

    // Dziś: wykonany bieg na liście planu dnia z odznaką „zrobione”, link do /sport
    await page.goto("/dzis");
    const trening = page
      .getByTestId("web-dzis")
      .getByTestId("plan-dnia-lista")
      .getByRole("link", { name: /Spokojny/ });
    await expect(trening).toContainText("zrobione");
    await expect(trening).toHaveAttribute(
      "href",
      new RegExp(`^/sport\\?miesiac=${dzis.slice(0, 7)}&wybrany=s:`),
    );
  });

  test("szablon „Push” → plan w kalendarzu → Rozpocznij → ciężary puste → ✓ → Zakończ → drugi start z ciężarami z ostatniego razu", async ({
    page,
  }, info) => {
    const userId = await zalozKontoNawykow(page, info.project.name);
    const dzis = dzisWarszawa();
    // Drugi start musi być innym wystąpieniem (jedna sesja na szablon i dzień), więc szablon ma też jutro
    const jutro = przesunDate(dzis, 1);
    await zasiejSzablon(userId, {
      name: "Push",
      weekdays: [dzienTygodnia(dzis), dzienTygodnia(jutro)],
      startTime: "18:00",
      cwiczenia: [
        { name: "Wyciskanie", sets: 2, reps: "8–10" },
        { name: "Pompki", sets: 1, reps: "12" },
      ],
    });

    // Plan z szablonu w kalendarzu głównym (przerywana ramka)
    await page.goto(`/kalendarz?widok=tydzien&data=${dzis}`);
    await expect(
      page.getByRole("link", { name: /Push/ }).first(),
    ).toHaveAttribute("data-planned", "true");

    await page.goto("/sport");
    const web = page.getByTestId("web-sport");
    await web
      .getByRole("button", { name: `Push, ${etykietaDnia(dzis)}`, exact: true })
      .click();
    await page
      .getByRole("dialog", { name: "Push" })
      .getByRole("button", { name: "Rozpocznij" })
      .click();
    await expect(page).toHaveURL(/\/sport\/trening\/[0-9a-f-]+$/);
    const sesjaId = page.url().split("/").pop() ?? "";

    const trening = page.getByTestId("web-gym");
    // Bez historii: ciężary puste, powtórzenia z „8–10”
    const kg1 = trening.getByLabel("Wyciskanie, seria 1 — ciężar");
    const kg2 = trening.getByLabel("Wyciskanie, seria 2 — ciężar");
    await expect(kg1).toHaveValue("");
    await expect(kg2).toHaveValue("");
    await expect(
      trening.getByLabel("Wyciskanie, seria 1 — powtórzenia"),
    ).toHaveValue("8");

    await kg1.fill("60");
    await kg1.press("Enter");
    await trening
      .getByRole("checkbox", { name: "Wyciskanie, seria 1 zrobiona" })
      .click();
    await kg2.fill("62,5");
    await kg2.press("Enter");
    await trening
      .getByRole("checkbox", { name: "Wyciskanie, seria 2 zrobiona" })
      .click();
    await expect(trening.getByTestId("serie")).toHaveText("2 / 3");
    await expect(trening.getByTestId("objetosc")).toHaveText("980 kg");

    // Zapisy serii idą w tle — czekamy, aż są w bazie, zanim zakończymy trening
    await expect
      .poll(async () => {
        const { data } = await adminClient()
          .from("gym_sets")
          .select("weight_kg, done")
          .eq("session_id", sesjaId)
          .eq("done", true);
        return (data ?? []).map((s) => Number(s.weight_kg)).sort();
      })
      .toEqual([60, 62.5]);

    await trening.getByRole("button", { name: "Zakończ trening" }).click();
    await expect(page).toHaveURL(/\/sport\?miesiac=\d{4}-\d{2}$/);

    // Drugi start: jutrzejsze wystąpienie z kalendarza Sportu
    await page
      .getByTestId("web-sport")
      .getByRole("button", {
        name: `Push, ${etykietaDnia(jutro)}`,
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog", { name: "Push" })
      .getByRole("button", { name: "Rozpocznij" })
      .click();
    await expect(page).toHaveURL(/\/sport\/trening\/[0-9a-f-]+$/);
    expect(page.url().split("/").pop()).not.toBe(sesjaId);
    const drugi = page.getByTestId("web-gym");
    await expect(drugi.getByLabel("Wyciskanie, seria 1 — ciężar")).toHaveValue(
      "60",
    );
    await expect(drugi.getByLabel("Wyciskanie, seria 2 — ciężar")).toHaveValue(
      "62,5",
    );
  });

  test("„Usuń” wystąpienie szablonu → znika, także po odświeżeniu", async ({
    page,
  }, info) => {
    const userId = await zalozKontoNawykow(page, info.project.name);
    const dzis = dzisWarszawa();
    const { id: szablonId } = await zasiejSzablon(userId, {
      name: "Push",
      weekdays: [dzienTygodnia(dzis)],
      cwiczenia: [{ name: "Wyciskanie", sets: 3, reps: "8" }],
    });

    await page.goto("/sport");
    const web = page.getByTestId("web-sport");
    const plan = web.getByRole("button", {
      name: `Push, ${etykietaDnia(dzis)}`,
      exact: true,
    });
    await plan.click();
    await page
      .getByRole("dialog", { name: "Push" })
      .getByRole("button", { name: "Usuń" })
      .click();
    const potwierdzenie = page.getByRole("alertdialog", {
      name: "Usunąć trening?",
    });
    await potwierdzenie.getByRole("button", { name: "Usuń" }).click();
    await expect(potwierdzenie).toBeHidden();
    await expect(plan).toBeHidden();

    // Pominięcie jest zapisane, więc po odświeżeniu wystąpienie nie wraca
    await expect
      .poll(async () => {
        const { data } = await adminClient()
          .from("template_skips")
          .select("date")
          .eq("template_id", szablonId);
        return (data ?? []).map((s) => s.date);
      })
      .toEqual([dzis]);
    await page.reload();
    await expect(
      web.getByRole("heading", { name: "Sport", level: 1 }),
    ).toBeVisible();
    await expect(plan).toBeHidden();
  });

  test("„Nowy wpis” w kalendarzu → Bieg otwiera okno biegu, Siłownia pusty trening", async ({
    page,
  }, info) => {
    await zalozKontoNawykow(page, info.project.name);
    const tydzien = `/kalendarz?widok=tydzien&data=${WTOREK}`;
    await page.goto(tydzien);

    // Slot 10:00 we wtorek
    await kliknijSlot(page, WTOREK, 600);
    await page
      .getByRole("dialog", { name: "Nowy wpis" })
      .getByRole("link", { name: /Bieg/ })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/sport\\?nowy=bieg&data=${WTOREK}&godzina=10:00`),
    );
    const okno = page.getByRole("dialog", { name: "Nowy bieg" });
    await expect(
      okno.getByRole("button", { name: "Start", exact: true }),
    ).toContainText("10:00");
    await okno.getByRole("button", { name: "Anuluj" }).click();

    await page.goto(tydzien);
    await kliknijSlot(page, WTOREK, 600);
    await page
      .getByRole("dialog", { name: "Nowy wpis" })
      .getByRole("link", { name: /Siłownia/ })
      .click();
    await expect(page).toHaveURL(/\/sport\/trening\/[0-9a-f-]+$/);
    await expect(
      page
        .getByTestId("web-gym")
        .getByRole("heading", { name: "Trening siłowy", level: 1 }),
    ).toBeVisible();
  });
});

test.describe("sport (telefon)", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "mobile", "układ telefonu");
  });

  test("„Bieg” → −/+ → Zapisz → „Ostatnie”; „Trening” → duży checkbox → pasek postępu", async ({
    page,
  }, info) => {
    const userId = await zalozKontoNawykow(page, info.project.name);
    await zasiejSzablon(userId, {
      name: "Push",
      weekdays: [],
      cwiczenia: [{ name: "Wyciskanie", sets: 2, reps: "8" }],
    });

    await page.goto("/sport");
    const m = page.getByTestId("m-sport");
    await m.getByRole("button", { name: "Bieg", exact: true }).click();
    const arkusz = page.getByRole("dialog", { name: "Nowy bieg" });
    // Start z makiety: 10,0 km i 52:00
    const dystans = arkusz.getByLabel("Dystans (km)");
    await expect(dystans).toHaveValue("10,0");
    await arkusz.getByRole("button", { name: "Więcej" }).click();
    await arkusz.getByRole("button", { name: "Więcej" }).click();
    await arkusz.getByRole("button", { name: "Mniej" }).click();
    await expect(dystans).toHaveValue("10,5");
    await arkusz.getByRole("button", { name: "Dłużej" }).click();
    await expect(arkusz.getByLabel("Czas", { exact: true })).toHaveValue(
      "53:00",
    );
    const zapis = poZapisie(page);
    await arkusz.getByRole("button", { name: "Zapisz", exact: true }).click();
    await zapis;
    await expect(arkusz).toBeHidden();
    await expect(
      m
        .getByRole("region", { name: "Ostatnie" })
        .getByText("Spokojny · 10,5 km"),
    ).toBeVisible();

    await m.getByRole("button", { name: "Trening", exact: true }).click();
    await page.getByRole("button", { name: "Push", exact: true }).click();
    await expect(page).toHaveURL(/\/sport\/trening\/[0-9a-f-]+$/);
    const trening = page.getByTestId("m-gym");
    await expect(
      trening
        .getByRole("progressbar", { name: "Postęp serii" })
        .locator(":scope > div"),
    ).toHaveAttribute("style", /width: 0%/);
    await trening
      .getByRole("checkbox", { name: "Wyciskanie, seria 1", exact: true })
      .click();
    await expect(
      trening
        .getByRole("progressbar", { name: "Postęp serii" })
        .locator(":scope > div"),
    ).toHaveAttribute("style", /width: 50%/);
    await expect(trening.getByTestId("m-serie")).toHaveText(/^1\/2 serii/);
  });
});
