"use client";

import * as React from "react";

import { createVault, getVault, resetVault, rewrapVault as rewrapVaultAction, saveVaultSettings } from "./actions";
import { DOMYSLNE_USTAWIENIA, type VaultSettings } from "./settings";
import { masterPasswordStrength, MASTER_MIN_STRENGTH } from "./strength";
import { VaultConfirmDialog } from "./vault-confirm-dialog";
import {
  createVaultMaterial,
  decryptSecret,
  encryptSecret,
  rewrapVault,
  unwrapDataKey,
  webCryptoAvailable,
  type SecretValue,
  type VaultMaterial,
} from "./crypto";

type Wynik = { ok: true } | { ok: false; message: string };

export type VaultState = {
  status: "ladowanie" | "brak" | "zablokowany" | "odblokowany" | "nieobslugiwany";
  generation: number | null;
  createdAt: string | null;
  remainingMs: number;
  setup(password: string): Promise<Wynik>;
  unlock(password: string): Promise<Wynik>;
  lock(): void;
  encrypt(text: string): Promise<SecretValue>;
  decrypt(v: SecretValue): Promise<string | null>;
  changePassword(oldPw: string, newPw: string): Promise<Wynik>;
  reset(): Promise<{ ok: true; cleared: number } | { ok: false; message: string }>;
  onStaleGeneration(): void;
  settings: VaultSettings;
  saveSettings(patch: Partial<VaultSettings>): Promise<Wynik>;
  // Przy włączonym „Pytaj o hasło przy podglądzie” otwiera okno; false = anulowano albo sejf się zablokował
  confirmReveal(): Promise<boolean>;
};

const AKTYWNOSC = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"] as const;
const ZLE_HASLO = "Nieprawidłowe hasło główne.";
const NIE_ZAPISANO = "Nie zapisano. Sejf musi być odblokowany.";
const BLAD_SEJFU = "Nie udało się połączyć z sejfem. Spróbuj ponownie.";
const ZABLOKOWANO = "Sejf został zablokowany. Spróbuj ponownie.";
const ZA_SLABE = "Hasło główne jest za słabe. Wymagane co najmniej „Mocne”.";

const VaultContext = React.createContext<VaultState | null>(null);

export function useVault(): VaultState {
  const ctx = React.useContext(VaultContext);
  if (!ctx) throw new Error("useVault wymaga VaultProvider");
  return ctx;
}

export function VaultProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = React.useState<VaultState["status"]>("ladowanie");
  const [generation, setGeneration] = React.useState<number | null>(null);
  const [createdAt, setCreatedAt] = React.useState<string | null>(null);
  const [remainingMs, setRemainingMs] = React.useState(0);
  const [settings, setSettings] = React.useState<VaultSettings>(DOMYSLNE_USTAWIENIA);
  // Czas blokady w ref, bo czytają go callbacki i nasłuch aktywności
  const blokadaMsRef = React.useRef(DOMYSLNE_USTAWIENIA.lockMin * 60_000);
  // Trwające pytanie o hasło przy podglądzie (null = okno zamknięte)
  const [pytanie, setPytanie] = React.useState<((ok: boolean) => void) | null>(null);
  const pytanieRef = React.useRef<((ok: boolean) => void) | null>(null);
  const odpowiedz = React.useCallback((ok: boolean) => {
    pytanieRef.current?.(ok);
    pytanieRef.current = null;
    setPytanie(null);
  }, []);

  // Klucz danych (nieeksportowalny CryptoKey) tylko w pamięci, nigdy w stanie Reacta ani w magazynie przeglądarki
  const keyRef = React.useRef<CryptoKey | null>(null);
  const generationRef = React.useRef<number | null>(null);
  // Materiał z serwera (owinięty klucz) wraz z updated_at do optymistycznej zmiany hasła
  const materialRef = React.useRef<(VaultMaterial & { updated_at: string }) | null>(null);
  const deadlineRef = React.useRef(0);
  // Epoka rośnie przy każdej blokadzie/resecie/odmontowaniu: wolne operacje async z starą epoką nie mogą ustawić klucza
  const epokaRef = React.useRef(0);
  // Czy pierwsze getVault się udało (przy błędzie sieci status zostaje „ladowanie”)
  const zaladowanoRef = React.useRef(false);

  // Blokada: czyści referencję do klucza i zatrzymuje odliczanie
  const lock = React.useCallback(() => {
    epokaRef.current += 1;
    keyRef.current = null;
    deadlineRef.current = 0;
    setRemainingMs(0);
    setStatus((s) => (s === "odblokowany" ? "zablokowany" : s));
    odpowiedz(false);
  }, [odpowiedz]);

  // Pobiera sejf z serwera i uzgadnia z nim materiał, generację i status.
  // Odrzuca odpowiedź, jeśli w międzyczasie zmieniła się epoka; zmiana generacji lub brak sejfu czyści klucz.
  const odswiez = React.useCallback(async (): Promise<boolean> => {
    const epoka = epokaRef.current;
    let res: Awaited<ReturnType<typeof getVault>>;
    try {
      res = await getVault();
    } catch {
      return false;
    }
    if (epoka !== epokaRef.current || !res.ok) return false;
    zaladowanoRef.current = true;
    if (res.settings) {
      setSettings(res.settings);
      blokadaMsRef.current = res.settings.lockMin * 60_000;
    }

    if (keyRef.current && (!res.vault || res.vault.generation !== generationRef.current)) {
      epokaRef.current += 1;
      keyRef.current = null;
      deadlineRef.current = 0;
      setRemainingMs(0);
    }
    if (!res.vault) {
      materialRef.current = null;
      generationRef.current = null;
      setGeneration(null);
      setCreatedAt(null);
      setStatus("brak");
      return true;
    }
    materialRef.current = {
      kdf: res.vault.kdf,
      wrapped_key: res.vault.wrapped_key,
      wrap_iv: res.vault.wrap_iv,
      updated_at: res.vault.updated_at,
    };
    generationRef.current = res.vault.generation;
    setGeneration(res.vault.generation);
    setCreatedAt(res.vault.created_at);
    setStatus(keyRef.current ? "odblokowany" : "zablokowany");
    return true;
  }, []);

  // Start: bez WebCrypto sejf jest nieobsługiwany, inaczej wczytujemy materiał
  React.useEffect(() => {
    // Status ustawiamy po mikrozadaniu, nie synchronicznie w ciele efektu
    void Promise.resolve().then(() => {
      if (!webCryptoAvailable()) setStatus("nieobslugiwany");
      else return odswiez();
    });
    return () => {
      // Odmontowanie providera też zwalnia klucz i unieważnia trwające operacje
      epokaRef.current += 1;
      keyRef.current = null;
    };
  }, [odswiez]);

  // Odliczanie i aktywność działają tylko przy odblokowanym sejfie
  React.useEffect(() => {
    if (status !== "odblokowany") return;
    const sprawdz = () => {
      const zostalo = deadlineRef.current - Date.now();
      if (zostalo <= 0) lock();
      else setRemainingMs(zostalo);
    };
    const naAktywnosc = (e: Event) => {
      // Tylko prawdziwa aktywność użytkownika: zdarzenia wysłane skryptem nie przedłużają odblokowania
      if (!e.isTrusted) return;
      deadlineRef.current = Date.now() + blokadaMsRef.current;
    };
    // Po powrocie na kartę sprawdzamy czas od razu (w tle timery bywają wstrzymane)
    const naWidocznosc = () => {
      if (document.visibilityState === "visible") sprawdz();
    };
    const id = setInterval(sprawdz, 1000);
    // scroll przewijanych kontenerów nie bąbelkuje, więc nasłuchujemy w fazie przechwytywania
    for (const nazwa of AKTYWNOSC)
      window.addEventListener(nazwa, naAktywnosc, nazwa === "scroll" ? { passive: true, capture: true } : { passive: true });
    document.addEventListener("visibilitychange", naWidocznosc);
    return () => {
      clearInterval(id);
      for (const nazwa of AKTYWNOSC) window.removeEventListener(nazwa, naAktywnosc, nazwa === "scroll" ? { capture: true } : undefined);
      document.removeEventListener("visibilitychange", naWidocznosc);
    };
  }, [status, lock]);

  const setup = React.useCallback(
    async (password: string): Promise<Wynik> => {
      if (masterPasswordStrength(password) < MASTER_MIN_STRENGTH) return { ok: false, message: ZA_SLABE };
      if (!webCryptoAvailable()) return { ok: false, message: BLAD_SEJFU };
      const epoka = epokaRef.current;
      try {
        if (!zaladowanoRef.current) {
          const zaladowano = await odswiez();
          if (epoka !== epokaRef.current) return { ok: false, message: ZABLOKOWANO };
          if (!zaladowano) return { ok: false, message: BLAD_SEJFU };
        }
        const { material, key } = await createVaultMaterial(password);
        if (epoka !== epokaRef.current) return { ok: false, message: ZABLOKOWANO };
        const res = await createVault(material);
        if (epoka !== epokaRef.current) return { ok: false, message: ZABLOKOWANO };
        if (!res.ok) return { ok: false, message: res.message };
        keyRef.current = key;
        generationRef.current = res.generation;
        setGeneration(res.generation);
        deadlineRef.current = Date.now() + blokadaMsRef.current;
        setRemainingMs(blokadaMsRef.current);
        setStatus("odblokowany");
        // Doczytujemy created_at i updated_at (do późniejszej zmiany hasła); błąd nie cofa założonego sejfu
        await odswiez();
        return { ok: true };
      } catch {
        return { ok: false, message: BLAD_SEJFU };
      }
    },
    [odswiez],
  );

  const unlock = React.useCallback(
    async (password: string): Promise<Wynik> => {
      const epoka = epokaRef.current;
      try {
        if (!zaladowanoRef.current || !materialRef.current) {
          const zaladowano = await odswiez();
          if (epoka !== epokaRef.current) return { ok: false, message: ZABLOKOWANO };
          if (!zaladowano) return { ok: false, message: BLAD_SEJFU };
        }
        const material = materialRef.current;
        if (!material) return { ok: false, message: BLAD_SEJFU };

        let key = await unwrapDataKey(password, material);
        if (epoka !== epokaRef.current) return { ok: false, message: ZABLOKOWANO };
        if (!key) {
          // Hasło mogło się zmienić w innej karcie: jeśli serwer ma nowszy materiał, próbujemy jeszcze raz
          if (await odswiez()) {
            const swiezy = materialRef.current;
            if (swiezy && swiezy.updated_at !== material.updated_at) key = await unwrapDataKey(password, swiezy);
          }
          if (epoka !== epokaRef.current) return { ok: false, message: ZABLOKOWANO };
        }
        if (!key) return { ok: false, message: ZLE_HASLO };

        keyRef.current = key;
        deadlineRef.current = Date.now() + blokadaMsRef.current;
        setRemainingMs(blokadaMsRef.current);
        setStatus("odblokowany");
        return { ok: true };
      } catch {
        return { ok: false, message: BLAD_SEJFU };
      }
    },
    [odswiez],
  );

  const encrypt = React.useCallback(async (text: string): Promise<SecretValue> => {
    const key = keyRef.current;
    const g = generationRef.current;
    if (!key || g === null) throw new Error(NIE_ZAPISANO);
    return encryptSecret(key, text, g);
  }, []);

  const decrypt = React.useCallback(async (v: SecretValue): Promise<string | null> => {
    const key = keyRef.current;
    if (!key) return null;
    return decryptSecret(key, v);
  }, []);

  const changePassword = React.useCallback(
    async (oldPw: string, newPw: string): Promise<Wynik> => {
      if (masterPasswordStrength(newPw) < MASTER_MIN_STRENGTH) return { ok: false, message: ZA_SLABE };
      const epoka = epokaRef.current;
      try {
        if (!zaladowanoRef.current || !materialRef.current) {
          const zaladowano = await odswiez();
          if (epoka !== epokaRef.current) return { ok: false, message: ZABLOKOWANO };
          if (!zaladowano) return { ok: false, message: BLAD_SEJFU };
        }
        const material = materialRef.current;
        if (!material) return { ok: false, message: BLAD_SEJFU };

        let nowy = await rewrapVault(oldPw, newPw, material);
        if (epoka !== epokaRef.current) return { ok: false, message: ZABLOKOWANO };
        let oczekiwany = material.updated_at;
        if (!nowy) {
          // Jak przy odblokowaniu: serwer mógł mieć nowszy materiał (zmiana w innej karcie)
          if (await odswiez()) {
            const swiezy = materialRef.current;
            if (swiezy && swiezy.updated_at !== material.updated_at) {
              nowy = await rewrapVault(oldPw, newPw, swiezy);
              oczekiwany = swiezy.updated_at;
            }
          }
          if (epoka !== epokaRef.current) return { ok: false, message: ZABLOKOWANO };
        }
        if (!nowy) return { ok: false, message: ZLE_HASLO };

        const res = await rewrapVaultAction(nowy, oczekiwany);
        if (!res.ok) return { ok: false, message: epoka !== epokaRef.current ? ZABLOKOWANO : res.message };
        // Serwer już zapisał nowe hasło — materiał zapisujemy także po blokadzie w trakcie,
        // inaczej ponowna próba z tymi samymi hasłami zwróciłaby „Nieprawidłowe hasło główne.”.
        // Klucz danych się nie zmienia, więc niczego tu nie odblokowujemy.
        materialRef.current = { ...nowy, updated_at: res.updated_at };
        return { ok: true };
      } catch {
        return { ok: false, message: BLAD_SEJFU };
      }
    },
    [odswiez],
  );

  const reset = React.useCallback(async () => {
    try {
      const res = await resetVault();
      if (!res.ok) return { ok: false as const, message: res.message };
      // Po resecie stary klucz jest bezużyteczny: czyścimy go i wracamy do stanu „brak sejfu”
      epokaRef.current += 1;
      keyRef.current = null;
      deadlineRef.current = 0;
      materialRef.current = null;
      generationRef.current = null;
      setGeneration(null);
      setCreatedAt(null);
      setRemainingMs(0);
      setStatus("brak");
      return { ok: true as const, cleared: res.cleared };
    } catch {
      return { ok: false as const, message: BLAD_SEJFU };
    }
  }, []);

  // Zapis Sekretu odrzucony z powodu innej generacji: blokujemy i doczytujemy aktualny sejf
  const onStaleGeneration = React.useCallback(() => {
    // lock() podbija epokę, więc trwające unlock/setup/changePassword nie ustawią klucza
    lock();
    void odswiez();
  }, [lock, odswiez]);

  const saveSettings = React.useCallback(
    async (patch: Partial<VaultSettings>): Promise<Wynik> => {
      const przed = settings;
      const po = { ...przed, ...patch };
      const ustaw = (s: VaultSettings) => {
        setSettings(s);
        blokadaMsRef.current = s.lockMin * 60_000;
        // Nowy czas liczy się od teraz
        if (keyRef.current) deadlineRef.current = Date.now() + blokadaMsRef.current;
      };
      ustaw(po);
      const res = await saveVaultSettings(patch).catch(() => null);
      if (res?.ok) return { ok: true };
      ustaw(przed);
      // Przy kilku zmianach naraz prawdą jest serwer
      void odswiez();
      return { ok: false, message: res?.message ?? BLAD_SEJFU };
    },
    [settings, odswiez],
  );

  const confirmReveal = React.useCallback((): Promise<boolean> => {
    if (!keyRef.current) return Promise.resolve(false);
    if (!settings.askOnReveal) return Promise.resolve(true);
    odpowiedz(false);
    return new Promise((resolve) => {
      pytanieRef.current = resolve;
      setPytanie(() => resolve);
    });
  }, [settings.askOnReveal, odpowiedz]);

  const sprawdzHaslo = React.useCallback(async (password: string) => {
    const material = materialRef.current;
    return !!material && (await unwrapDataKey(password, material)) !== null;
  }, []);

  const value = React.useMemo<VaultState>(
    () => ({
      status,
      generation,
      createdAt,
      remainingMs,
      setup,
      unlock,
      lock,
      encrypt,
      decrypt,
      changePassword,
      reset,
      onStaleGeneration,
      settings,
      saveSettings,
      confirmReveal,
    }),
    [status, generation, createdAt, remainingMs, setup, unlock, lock, encrypt, decrypt, changePassword, reset, onStaleGeneration, settings, saveSettings, confirmReveal],
  );

  return (
    <VaultContext.Provider value={value}>
      {children}
      {pytanie && <VaultConfirmDialog verify={sprawdzHaslo} onDone={odpowiedz} />}
    </VaultContext.Provider>
  );
}
