import {
  adminClient,
  createConfirmedUser,
  logInViaForm,
  randomPassword,
  uniqueEmail,
} from "./konto";
import { expect, test, type Page } from "@playwright/test";

// Nawyki zawsze pracują na „dziś” (brak nawigacji po datach), a czasu serwera nie da się podmienić.
// Dlatego dane zasiewamy względem prawdziwego dziś w strefie profilu (konta testowe mają domyślne Europe/Warsaw)
// — tak samo jak aplikacja (todayIso z tą strefą).
const STREFA = "Europe/Warsaw";

export function dzisWarszawa(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STREFA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Data przesunięta o `dni` względem podanej („YYYY-MM-DD”), liczona w UTC, więc bez wpływu zmiany czasu
export function przesunDate(data: string, dni: number): string {
  const [r, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(r, m - 1, d + dni)).toISOString().slice(0, 10);
}

// Konto po onboardingu, zalogowane (profil z domyślnymi: Europe/Warsaw, tydzień od poniedziałku, zegar 24 h, cel snu 8 h)
export async function zalozKontoNawykow(
  page: Page,
  projekt: string,
): Promise<string> {
  // Serwer liczy „dziś” w strefie profilu, a test (Node) zasiewa dane względem własnego zegara; zegara serwera
  // nie da się podmienić. Tuż przed północą w Warszawie oba „dziś” mogłyby się rozjechać w trakcie testu,
  // więc przeczekujemy północ (i wydłużamy limit testu o ten czas).
  const czesci = new Intl.DateTimeFormat("en-GB", {
    timeZone: STREFA,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const sekundyOdPolnocy =
    Number(czesci.find((c) => c.type === "hour")!.value) * 3600 +
    Number(czesci.find((c) => c.type === "minute")!.value) * 60 +
    Number(czesci.find((c) => c.type === "second")!.value);
  const sekundyDoPolnocy = 86400 - sekundyOdPolnocy;
  if (sekundyDoPolnocy < 180) {
    test.info().setTimeout(test.info().timeout + (sekundyDoPolnocy + 5) * 1000);
    await new Promise((r) => setTimeout(r, (sekundyDoPolnocy + 5) * 1000));
  }

  const email = uniqueEmail(projekt);
  const haslo = randomPassword();
  const userId = await createConfirmedUser(email, haslo);
  await logInViaForm(page, email, haslo);
  await expect(page).toHaveURL(/\/dzis$/);
  return userId;
}

// Nawyk zasiany przez API administratora; harmonogram obowiązuje od `odDni` dni temu (domyślnie 10),
// żeby zmiana harmonogramu dzisiaj tworzyła nową wersję zamiast nadpisać pierwszą
export async function zasiejNawyk(
  userId: string,
  nawyk: {
    name: string;
    odDni?: number;
    type?: "daily" | "weekdays" | "times_per_week";
    weekdays?: number[];
    timesPerWeek?: number;
  },
): Promise<string> {
  const admin = adminClient();
  const { data, error } = await admin
    .from("habits")
    .insert({ user_id: userId, name: nawyk.name })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`Nie udało się zasiać nawyku: ${error?.message}`);
  const { error: bladWersji } = await admin.from("habit_schedules").insert({
    habit_id: data.id,
    user_id: userId,
    valid_from: przesunDate(dzisWarszawa(), -(nawyk.odDni ?? 10)),
    schedule_type: nawyk.type ?? "daily",
    weekdays: nawyk.weekdays ?? [],
    times_per_week:
      nawyk.type === "times_per_week" ? (nawyk.timesPerWeek ?? 3) : null,
  });
  if (bladWersji)
    throw new Error(`Nie udało się zasiać harmonogramu: ${bladWersji.message}`);
  return data.id;
}

// Wpis snu zasiany dla daty pobudki względem dziś (`dniTemu` = 0 to dzisiejsza noc)
export async function zasiejSen(
  userId: string,
  dniTemu: number,
  sleptAt: string,
  wokeAt: string,
) {
  const { error } = await adminClient()
    .from("sleep_logs")
    .insert({
      user_id: userId,
      date: przesunDate(dzisWarszawa(), -dniTemu),
      slept_at: sleptAt,
      woke_at: wokeAt,
    });
  if (error) throw new Error(`Nie udało się zasiać snu: ${error.message}`);
}

export async function policzNawyki(
  userId: string,
  nazwa?: string,
): Promise<number> {
  let zapytanie = adminClient()
    .from("habits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if (nazwa) zapytanie = zapytanie.eq("name", nazwa);
  const { count, error } = await zapytanie;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function wpisySnu(userId: string) {
  const { data, error } = await adminClient()
    .from("sleep_logs")
    .select("date, slept_at, woke_at")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return data ?? [];
}
