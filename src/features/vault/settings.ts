// Ustawienia sejfu z konta (Ustawienia → Sejf). Osobny plik, bo czyta je serwer (getVault) i przeglądarka.
import { z } from "zod";

export type VaultSettings = {
  lockMin: 1 | 5 | 15 | 60;
  clearClipboard: boolean;
  askOnReveal: boolean;
};

export const DOMYSLNE_USTAWIENIA: VaultSettings = { lockMin: 5, clearClipboard: true, askOnReveal: false };

export const vaultSettingsSchema = z
  .object({
    lockMin: z.union([z.literal(1), z.literal(5), z.literal(15), z.literal(60)]),
    clearClipboard: z.boolean(),
    askOnReveal: z.boolean(),
  })
  .partial()
  .strict();

// „5 min”, „1 h”
export const czasBlokady = (min: number) => (min === 60 ? "1 h" : `${min} min`);
