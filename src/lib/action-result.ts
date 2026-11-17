// Wspólny wynik akcji serwera: sukces (opcjonalnie z id nowego wiersza) albo komunikat błędu.
export type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; message: string };
