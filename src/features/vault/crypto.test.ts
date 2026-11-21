// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  createVaultMaterial,
  decryptSecret,
  encryptSecret,
  isSecretValue,
  rewrapVault,
  unwrapDataKey,
  webCryptoAvailable,
} from "./crypto";

// PBKDF2 z 600 000 iteracji trwa chwilę, więc dajemy zapas czasu
const TIMEOUT = 30_000;

// Dane testowe (nie są prawdziwymi hasłami)
const HASLO = "testowe-haslo-glowne-1";
const INNE_HASLO = "zupelnie-inne-haslo-2";

function b64Len(s: string): number {
  return atob(s).length;
}

describe("crypto sejfu", () => {
  it("webCryptoAvailable zwraca true w środowisku z crypto.subtle", () => {
    expect(webCryptoAvailable()).toBe(true);
  });

  it(
    "tworzy materiał z kdf PBKDF2-SHA-256, 600000 iteracji, sól 16 B, iv 12 B",
    async () => {
      const { material } = await createVaultMaterial(HASLO);
      expect(material.kdf.alg).toBe("PBKDF2-SHA-256");
      expect(material.kdf.iterations).toBe(600000);
      expect(b64Len(material.kdf.salt)).toBe(16);
      expect(b64Len(material.wrap_iv)).toBe(12);
      expect(b64Len(material.wrapped_key)).toBeGreaterThan(32);
    },
    TIMEOUT,
  );

  it(
    "poprawne hasło odwija klucz, złe zwraca null",
    async () => {
      const { material, key } = await createVaultMaterial(HASLO);
      const wartosc = await encryptSecret(key, "tajne", 1);
      const odwiniety = await unwrapDataKey(HASLO, material);
      expect(odwiniety).not.toBeNull();
      expect(await decryptSecret(odwiniety!, wartosc)).toBe("tajne");
      expect(await unwrapDataKey(INNE_HASLO, material)).toBeNull();
    },
    TIMEOUT,
  );

  it(
    "szyfruje i odszyfrowuje polskie znaki i emoji; każdy zapis ma inny iv",
    async () => {
      const { key } = await createVaultMaterial(HASLO);
      const tekst = "Zażółć gęślą jaźń 🔐✨";
      const a = await encryptSecret(key, tekst, 3);
      const b = await encryptSecret(key, tekst, 3);
      expect(a.v).toBe(1);
      expect(a.g).toBe(3);
      expect(a.iv).not.toBe(b.iv);
      expect(a.ct).not.toBe(b.ct);
      expect(await decryptSecret(key, a)).toBe(tekst);
      expect(await decryptSecret(key, b)).toBe(tekst);
    },
    TIMEOUT,
  );

  it(
    "decryptSecret zwraca null dla zmienionego ct, obcego klucza i uszkodzonego base64",
    async () => {
      const { key } = await createVaultMaterial(HASLO);
      const { key: obcy } = await createVaultMaterial(INNE_HASLO);
      const wartosc = await encryptSecret(key, "tajne", 1);

      // zmieniamy pierwszy bajt szyfrogramu
      const bajty = Uint8Array.from(atob(wartosc.ct), (c) => c.charCodeAt(0));
      bajty[0] ^= 0xff;
      const zmieniony = { ...wartosc, ct: btoa(String.fromCharCode(...bajty)) };

      expect(await decryptSecret(key, zmieniony)).toBeNull();
      expect(await decryptSecret(obcy, wartosc)).toBeNull();
      expect(await decryptSecret(key, { ...wartosc, ct: "%%%nie-base64%%%" })).toBeNull();
      expect(await decryptSecret(key, { ...wartosc, iv: "!!!" })).toBeNull();
    },
    TIMEOUT,
  );

  it(
    "rewrapVault: nowe hasło odwija ten sam klucz (stare wartości się odszyfrowują), stare hasło już nie",
    async () => {
      const { material, key } = await createVaultMaterial(HASLO);
      const wartosc = await encryptSecret(key, "tajne", 1);

      const nowy = await rewrapVault(HASLO, INNE_HASLO, material);
      expect(nowy).not.toBeNull();
      expect(nowy!.kdf.salt).not.toBe(material.kdf.salt);
      expect(nowy!.kdf.iterations).toBe(600000);
      expect(b64Len(nowy!.kdf.salt)).toBe(16);
      expect(b64Len(nowy!.wrap_iv)).toBe(12);

      const klucz = await unwrapDataKey(INNE_HASLO, nowy!);
      expect(klucz).not.toBeNull();
      expect(await decryptSecret(klucz!, wartosc)).toBe("tajne");
      expect(await unwrapDataKey(HASLO, nowy!)).toBeNull();

      // zły stary hasło → null
      expect(await rewrapVault("zle-stare-haslo", INNE_HASLO, material)).toBeNull();
    },
    TIMEOUT,
  );

  it(
    "klucz danych jest nieeksportowalny (exportKey rzuca)",
    async () => {
      const { material, key } = await createVaultMaterial(HASLO);
      await expect(crypto.subtle.exportKey("raw", key)).rejects.toThrow();
      const odwiniety = await unwrapDataKey(HASLO, material);
      await expect(crypto.subtle.exportKey("raw", odwiniety!)).rejects.toThrow();
      expect(key.extractable).toBe(false);
    },
    TIMEOUT,
  );

  it("isSecretValue odrzuca string, brak g, iv innej długości", () => {
    const iv12 = btoa("a".repeat(12));
    const ct = btoa("b".repeat(20));
    expect(isSecretValue({ v: 1, g: 1, iv: iv12, ct })).toBe(true);
    expect(isSecretValue("tekst")).toBe(false);
    expect(isSecretValue(null)).toBe(false);
    expect(isSecretValue({ v: 1, iv: iv12, ct })).toBe(false);
    expect(isSecretValue({ v: 1, g: 0, iv: iv12, ct })).toBe(false);
    expect(isSecretValue({ v: 2, g: 1, iv: iv12, ct })).toBe(false);
    expect(isSecretValue({ v: 1, g: 1, iv: btoa("a".repeat(11)), ct })).toBe(false);
    expect(isSecretValue({ v: 1, g: 1, iv: iv12, ct: btoa("b".repeat(15)) })).toBe(false);
    expect(isSecretValue({ v: 1, g: 1, iv: iv12, ct: "%%%" })).toBe(false);
  });
});
