// Atrapa zapytania Supabase do testów akcji: każda metoda zwraca ten sam obiekt,
// a `await` na nim daje gotowy wynik { data, error }.
import { vi } from "vitest";

export function fakeTable(result: { data?: unknown; error?: unknown } = {}) {
  const wynik = { data: null, error: null, ...result };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- atrapa na potrzeby testów
  const zapytanie: any = {};
  for (const metoda of [
    "select", "insert", "update", "upsert", "delete",
    "eq", "in", "gte", "order", "limit", "single", "maybeSingle",
  ]) {
    zapytanie[metoda] = vi.fn(() => zapytanie);
  }
  zapytanie.then = (ok: (v: unknown) => unknown, blad?: (e: unknown) => unknown) =>
    Promise.resolve(wynik).then(ok, blad);
  return zapytanie;
}
