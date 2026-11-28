import { expect, test, type Locator, type Page } from "@playwright/test";

import { adminClient, createConfirmedUser, logInViaForm, randomPassword, uniqueEmail } from "./helpers/konto";

// Next trzyma poprzednie kroki w DOM (ukryte), więc lokalizatory po label/tekście zawężamy do widocznych
const widoczny = (l: Locator) => l.locator("visible=true");
const dalej = (page: Page) => page.getByRole("button", { name: "Dalej", exact: true });
const guzik = (page: Page, nazwa: string) => widoczny(page.getByRole("button", { name: nazwa, exact: true }));

async function zalozKonto(page: Page, projekt: string) {
  const email = uniqueEmail(projekt);
  const haslo = randomPassword();
  await createConfirmedUser(email, haslo, false);
  await logInViaForm(page, email, haslo);
  await expect(page).toHaveURL(/\/onboarding\/1$/);
  return email;
}

test.describe("onboarding", () => {
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("4 kroki: wznawianie, bloki na dziś, strony i przejście na Dziś", async ({ page }, info) => {
    const email = await zalozKonto(page, info.project.name);

    // Krok 1: „Dalej” nieaktywne bez imienia; ustawienia wykryte pod „Zmień”
    const imie = widoczny(page.getByLabel("Imię lub pseudonim"));
    await imie.fill("");
    await expect(dalej(page)).toBeDisabled();
    await imie.fill("Mejson");
    await guzik(page, "Zmień").click();
    await page.getByRole("radio", { name: "Niedziela" }).click();
    await dalej(page).click();

    // Krok 2: wybory i cel biegania
    await expect(page).toHaveURL(/\/onboarding\/2$/);
    for (const nazwa of ["Studia", "Bieganie", "Subskrypcje"]) await guzik(page, nazwa).click();
    await widoczny(page.locator('input[aria-label="Bieganie"]')).fill("30");
    await dalej(page).click();

    // Wznawianie i brak przeskakiwania kroków
    await expect(page).toHaveURL(/\/onboarding\/3$/);
    await page.goto("/onboarding/4");
    await expect(page).toHaveURL(/\/onboarding\/3$/);
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/onboarding\/3$/);

    // Krok 3: podpowiedź i własny blok
    await widoczny(page.getByRole("button", { name: /^Zajęcia · / })).click();
    await widoczny(page.getByLabel("Własny blok")).fill("Angielski");
    await guzik(page, "Dodaj").click();
    await dalej(page).click();

    // Krok 4; powrót do 3 pokazuje bloki jako zapisane
    await expect(page).toHaveURL(/\/onboarding\/4$/);
    await page.goto("/onboarding/3");
    await expect(widoczny(page.getByText("w kalendarzu"))).toHaveCount(2);
    await dalej(page).click();
    await expect(page).toHaveURL(/\/onboarding\/4$/);
    await guzik(page, "Uczelnia").click();
    await guzik(page, "Zacznij korzystać").click();

    await expect(page).toHaveURL(/\/dzis$/);
    await expect(widoczny(page.getByText("Angielski")).first()).toBeVisible();

    // W bazie: dokładnie dwa bloki, kategorie z wyborów i cel w km
    const admin = adminClient();
    const { data: konta } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const userId = konta.users.find((u) => u.email === email)!.id;
    const { data: bloki } = await admin.from("blocks").select("title").eq("user_id", userId);
    expect(bloki?.map((b) => b.title).sort()).toEqual(["Angielski", "Zajęcia"]);
    const { data: kategorie } = await admin.from("categories").select("name").eq("user_id", userId);
    expect(kategorie?.map((k) => k.name).sort()).toEqual(["Sport", "Studia"]);
    const { data: profil } = await admin
      .from("profiles")
      .select("km_goal_on, workouts_goal_on, weekly_km_goal, week_start")
      .eq("user_id", userId)
      .single();
    expect(profil).toMatchObject({ km_goal_on: true, workouts_goal_on: false, weekly_km_goal: 30, week_start: "sun" });

    // Po ukończeniu kreator nie jest już dostępny
    await page.goto("/onboarding/2");
    await expect(page).toHaveURL(/\/dzis$/);
  });
});
