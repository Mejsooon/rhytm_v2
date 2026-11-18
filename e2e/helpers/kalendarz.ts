import {
  adminClient,
  createConfirmedUser,
  logInViaForm,
  randomPassword,
  uniqueEmail,
} from "./konto";
import { expect, type Page } from "@playwright/test";

// Stały tydzień testów: poniedziałek 11.01.2027, wtorek 12.01, kolejny wtorek 19.01.
// Daty są w przyszłości i niezależne od „dziś”, więc testy nie zależą od zegara.
export const PONIEDZIALEK = "2027-01-11";
export const WTOREK = "2027-01-12";
export const SRODA = "2027-01-13";
export const NASTEPNY_WTOREK = "2027-01-19";

// Kategorie jak po onboardingu (konta testowe omijają kreator, więc zakładamy je sami)
export const KATEGORIE = [
  { name: "Nauka", color: "#0070f3" },
  { name: "Sport", color: "#15803d" },
  { name: "Praca", color: "#7c3aed" },
];

// Konto po onboardingu, zalogowane, z trzema kategoriami; zwraca id użytkownika i id kategorii po nazwie
export async function zalozKontoKalendarza(page: Page, projekt: string) {
  const email = uniqueEmail(projekt);
  const haslo = randomPassword();
  const userId = await createConfirmedUser(email, haslo);
  const { data, error } = await adminClient()
    .from("categories")
    .insert(
      KATEGORIE.map((k, i) => ({
        user_id: userId,
        name: k.name,
        color: k.color,
        position: i + 1,
      })),
    )
    .select("id, name");
  if (error || !data)
    throw new Error(`Nie udało się zasiać kategorii: ${error?.message}`);
  const kategorie = Object.fromEntries(data.map((k) => [k.name, k.id]));

  await logInViaForm(page, email, haslo);
  await expect(page).toHaveURL(/\/dzis$/);
  return { userId, kategorie };
}

// Blok zasiany przez API administratora; `start` to „YYYY-MM-DD” i godzina w minutach od północy
export async function zasiejBlok(
  userId: string,
  blok: {
    title: string;
    date: string;
    startMin: number;
    durationMin?: number;
    categoryId?: string;
    recurrence?: {
      freq: "daily" | "weekdays" | "weekly" | "custom";
      byWeekday?: number[];
      until?: string;
    } | null;
    note?: string;
  },
): Promise<string> {
  const godzina = `${String(Math.floor(blok.startMin / 60)).padStart(2, "0")}:${String(blok.startMin % 60).padStart(2, "0")}:00`;
  const { data, error } = await adminClient()
    .from("blocks")
    .insert({
      user_id: userId,
      title: blok.title,
      category_id: blok.categoryId ?? null,
      note: blok.note ?? null,
      start_local: `${blok.date}T${godzina}`,
      duration_min: blok.durationMin ?? 60,
      timezone: "Europe/Warsaw",
      recurrence: blok.recurrence ?? null,
      remind: true,
    })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`Nie udało się zasiać bloku: ${error?.message}`);
  return data.id;
}

// Zadanie przypięte do wystąpienia bloku (data = oryginalna data wystąpienia)
export async function zasiejZadanie(
  userId: string,
  blockId: string,
  date: string,
  title: string,
  done = false,
) {
  const { error } = await adminClient()
    .from("tasks")
    .insert({
      user_id: userId,
      title,
      block_id: blockId,
      occurrence_date: date,
      due_date: date,
      done,
    });
  if (error) throw new Error(`Nie udało się zasiać zadania: ${error.message}`);
}

// Czeka na zakończenie zapisu (akcja serwera to POST na adres strony), żeby odświeżenie go nie ucięło
export function poZapisie(page: Page) {
  return page.waitForResponse((odp) => odp.request().method() === "POST");
}
