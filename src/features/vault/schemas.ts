// Walidacja materiału sejfu po stronie serwera: tylko kształt (serwer niczego nie odszyfrowuje).
import { z } from "zod";

// Sól 16 B = 24 znaki base64 z "==", iv 12 B = 16 znaków, owinięty klucz AES-256 (32 B + tag 16 B) = 64 znaki
export const vaultMaterialSchema = z.object({
  kdf: z.object({
    alg: z.literal("PBKDF2-SHA-256"),
    iterations: z.literal(600000),
    salt: z.string().regex(/^[A-Za-z0-9+/]{22}==$/),
  }),
  wrapped_key: z.string().regex(/^[A-Za-z0-9+/]{64}$/),
  wrap_iv: z.string().regex(/^[A-Za-z0-9+/]{16}$/),
});

// Znacznik czasu z bazy (updated_at) odesłany z powrotem do optymistycznego porównania
export const updatedAtSchema = z.string().min(1).max(64);
