// Kryptografia sejfu zero-knowledge (WebCrypto). Hasło główne i klucz danych nigdy nie opuszczają przeglądarki.
// PBKDF2-SHA-256 (600 000 iteracji, sól 16 B) → klucz owijający AES-GCM-256 → owinięty klucz danych AES-GCM-256.
// Wartość Sekretu: AES-GCM z nowym IV 12 B przy każdym zapisie.

export type VaultKdf = { alg: "PBKDF2-SHA-256"; iterations: 600000; salt: string };
export type VaultMaterial = { kdf: VaultKdf; wrapped_key: string; wrap_iv: string };
export type SecretValue = { v: 1; g: number; iv: string; ct: string };

const ITERATIONS = 600000;
// Uwaga: base64 poniżej powstaje przez btoa(String.fromCharCode(...bajty)); spread ma limit argumentów
// silnika (rzędu 100 tys.), więc dla bardzo długich tekstów (setki KB) trzeba by kodować porcjami.
const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

// Sprawdza kształt wartości Sekretu: wersja, generacja ≥ 1, iv = 12 B, ct ≥ 16 B (sam tag GCM)
export function isSecretValue(x: unknown): x is SecretValue {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  if (o.v !== 1) return false;
  if (typeof o.g !== "number" || !Number.isInteger(o.g) || o.g < 1) return false;
  if (typeof o.iv !== "string" || typeof o.ct !== "string") return false;
  if (!BASE64_RE.test(o.iv) || !BASE64_RE.test(o.ct)) return false;
  if (atob(o.iv).length !== 12) return false;
  if (atob(o.ct).length < 16) return false;
  return true;
}

export function webCryptoAvailable(): boolean {
  return (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.subtle !== "undefined" &&
    typeof globalThis.crypto.getRandomValues === "function"
  );
}

// Tworzy nowy sejf: losowy klucz danych owinięty kluczem wyprowadzonym z hasła
export async function createVaultMaterial(
  password: string,
): Promise<{ material: VaultMaterial; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const wrapIv = crypto.getRandomValues(new Uint8Array(12));

  const passKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.normalize("NFC")), "PBKDF2", false, [
    "deriveKey",
  ]);
  const wrappingKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
    passKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );

  // Klucz danych jest extractable tylko na czas owinięcia
  const tempKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
  const wrapped = await crypto.subtle.wrapKey("raw", tempKey, wrappingKey, { name: "AES-GCM", iv: wrapIv });

  // Zwracany klucz danych jest nieeksportowalny (odwinięty od nowa z extractable:false)
  const key = await crypto.subtle.unwrapKey(
    "raw",
    wrapped,
    wrappingKey,
    { name: "AES-GCM", iv: wrapIv },
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );

  return {
    material: {
      kdf: { alg: "PBKDF2-SHA-256", iterations: ITERATIONS, salt: btoa(String.fromCharCode(...salt)) },
      wrapped_key: btoa(String.fromCharCode(...new Uint8Array(wrapped))),
      wrap_iv: btoa(String.fromCharCode(...wrapIv)),
    },
    key,
  };
}

// Odwija klucz danych hasłem; null przy złym haśle (tag GCM się nie zgadza) lub uszkodzonym materiale
export async function unwrapDataKey(password: string, material: VaultMaterial): Promise<CryptoKey | null> {
  try {
    // Materiał pochodzi z niezaufanego serwera: sprawdzamy parametry, zanim ruszymy WebCrypto
    if (material.kdf.alg !== "PBKDF2-SHA-256" || material.kdf.iterations !== ITERATIONS) return null;
    if (!BASE64_RE.test(material.kdf.salt) || atob(material.kdf.salt).length !== 16) return null;
    if (!BASE64_RE.test(material.wrap_iv) || atob(material.wrap_iv).length !== 12) return null;
    if (!BASE64_RE.test(material.wrapped_key)) return null;
    const salt = Uint8Array.from(atob(material.kdf.salt), (c) => c.charCodeAt(0));
    const wrapIv = Uint8Array.from(atob(material.wrap_iv), (c) => c.charCodeAt(0));
    const wrapped = Uint8Array.from(atob(material.wrapped_key), (c) => c.charCodeAt(0));

    const passKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password.normalize("NFC")), "PBKDF2", false, [
      "deriveKey",
    ]);
    const wrappingKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: ITERATIONS },
      passKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["wrapKey", "unwrapKey"],
    );

    return await crypto.subtle.unwrapKey(
      "raw",
      wrapped,
      wrappingKey,
      { name: "AES-GCM", iv: wrapIv },
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }
}

// Zmiana hasła głównego: ten sam klucz danych, nowa sól i nowy iv owinięcia; null przy złym starym haśle
export async function rewrapVault(
  oldPassword: string,
  newPassword: string,
  material: VaultMaterial,
): Promise<VaultMaterial | null> {
  let dataKey: CryptoKey;
  try {
    // Materiał pochodzi z niezaufanego serwera: sprawdzamy parametry, zanim ruszymy WebCrypto
    if (material.kdf.alg !== "PBKDF2-SHA-256" || material.kdf.iterations !== ITERATIONS) return null;
    if (!BASE64_RE.test(material.kdf.salt) || atob(material.kdf.salt).length !== 16) return null;
    if (!BASE64_RE.test(material.wrap_iv) || atob(material.wrap_iv).length !== 12) return null;
    if (!BASE64_RE.test(material.wrapped_key)) return null;
    const oldSalt = Uint8Array.from(atob(material.kdf.salt), (c) => c.charCodeAt(0));
    const oldIv = Uint8Array.from(atob(material.wrap_iv), (c) => c.charCodeAt(0));
    const wrapped = Uint8Array.from(atob(material.wrapped_key), (c) => c.charCodeAt(0));

    const oldPassKey = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(oldPassword.normalize("NFC")),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const oldWrappingKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", hash: "SHA-256", salt: oldSalt, iterations: ITERATIONS },
      oldPassKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["wrapKey", "unwrapKey"],
    );

    // extractable:true tylko lokalnie w tej funkcji, żeby móc owinąć ponownie
    dataKey = await crypto.subtle.unwrapKey(
      "raw",
      wrapped,
      oldWrappingKey,
      { name: "AES-GCM", iv: oldIv },
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"],
    );
  } catch {
    return null;
  }

  // Druga połowa (owijanie nowym hasłem) celowo NIE jest w try/catch: błąd WebCrypto ma tu rzucić,
  // bo null oznacza wyłącznie złe stare hasło albo zły materiał
  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  const newIv = crypto.getRandomValues(new Uint8Array(12));
  const newPassKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(newPassword.normalize("NFC")), "PBKDF2", false, [
    "deriveKey",
  ]);
  const newWrappingKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: newSalt, iterations: ITERATIONS },
    newPassKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["wrapKey", "unwrapKey"],
  );
  const newWrapped = await crypto.subtle.wrapKey("raw", dataKey, newWrappingKey, { name: "AES-GCM", iv: newIv });

  return {
    kdf: { alg: "PBKDF2-SHA-256", iterations: ITERATIONS, salt: btoa(String.fromCharCode(...newSalt)) },
    wrapped_key: btoa(String.fromCharCode(...new Uint8Array(newWrapped))),
    wrap_iv: btoa(String.fromCharCode(...newIv)),
  };
}

// Szyfruje tekst kluczem danych; nowy iv 12 B przy każdym wywołaniu; g = vaults.generation
export async function encryptSecret(key: CryptoKey, text: string, generation: number): Promise<SecretValue> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  // AAD wiąże szyfrogram z generacją: podmiana g w wartości psuje odszyfrowanie
  const aad = new TextEncoder().encode(`rhytm-secret:v1:g${generation}`);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: aad }, key, new TextEncoder().encode(text));
  return {
    v: 1,
    g: generation,
    iv: btoa(String.fromCharCode(...iv)),
    ct: btoa(String.fromCharCode(...new Uint8Array(ct))),
  };
}

// Odszyfrowuje wartość; null, gdy tag się nie zgadza, klucz jest obcy albo dane są uszkodzone
export async function decryptSecret(key: CryptoKey, value: SecretValue): Promise<string | null> {
  try {
    const iv = Uint8Array.from(atob(value.iv), (c) => c.charCodeAt(0));
    const ct = Uint8Array.from(atob(value.ct), (c) => c.charCodeAt(0));
    const aad = new TextEncoder().encode(`rhytm-secret:v${value.v}:g${value.g}`);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, additionalData: aad }, key, ct);
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}
