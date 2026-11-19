// Atrapa zapytania Supabase do testów akcji: każda metoda zwraca ten sam obiekt,
// a `await` na nim daje gotowy wynik { data, error }.
import { vi } from "vitest";

// `single` to wynik dla .single()/.maybeSingle() (gdy brak — bierzemy `data`).
export function fakeTable(
  result: {
    data?: unknown;
    error?: unknown;
    single?: unknown;
    pages?: unknown[][];
  } = {},
) {
  const wynik = { data: null, error: null, ...result };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- atrapa na potrzeby testów
  const zapytanie: any = {};
  for (const metoda of [
    "select",
    "insert",
    "update",
    "upsert",
    "delete",
    "eq",
    "neq",
    "is",
    "not",
    "in",
    "gte",
    "lte",
    "lt",
    "or",
    "order",
    "limit",
  ]) {
    zapytanie[metoda] = vi.fn(() => zapytanie);
  }
  // range(from, to): przy `pages` kolejne wywołania dostają kolejne strony wyniku (paginacja)
  let strona = -1;
  zapytanie.range = vi.fn(() => {
    strona++;
    return zapytanie;
  });
  // single/maybeSingle zwracają jeden wiersz zamiast listy
  let pojedynczy = false;
  for (const metoda of ["single", "maybeSingle"]) {
    zapytanie[metoda] = vi.fn(() => {
      pojedynczy = true;
      return zapytanie;
    });
  }
  zapytanie.then = (
    ok: (v: unknown) => unknown,
    blad?: (e: unknown) => unknown,
  ) => {
    const gotowy =
      pojedynczy && result.single !== undefined
        ? { ...wynik, data: result.single }
        : wynik;
    pojedynczy = false;
    if (result.pages && strona >= 0) {
      return Promise.resolve({
        ...wynik,
        data: result.pages[strona] ?? [],
      }).then(ok, blad);
    }
    return Promise.resolve(gotowy).then(ok, blad);
  };
  return zapytanie;
}
