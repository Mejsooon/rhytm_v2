"use client";

import { useEffect, useState } from "react";

import { removePushDevice, savePushDevice } from "./push-actions";

// Stan powiadomień push na bieżącym urządzeniu (Ustawienia → Powiadomienia, „Push na tym urządzeniu”).
// Jedyne miejsce z logiką przeglądarki: service worker, PushManager, zgoda na powiadomienia.
export type PushStan =
  | "ladowanie"
  | "nieskonfigurowany"
  | "nieobslugiwany"
  | "ios-instalacja"
  | "zablokowany"
  | "wylaczony"
  | "wlaczony";

export function usePushDevice(): {
  stan: PushStan;
  endpoint: string | null;
  blad: string | null;
  zajety: boolean;
  wlacz: () => Promise<void>;
  wylacz: () => Promise<void>;
} {
  const [stan, setStan] = useState<PushStan>("ladowanie");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [zajety, setZajety] = useState(false);

  useEffect(() => {
    // Po odmontowaniu (albo podwójnym efekcie w trybie deweloperskim) wynik jest ignorowany
    let anulowano = false;

    async function wykryj() {
      // Kolejność sprawdzeń = kolejność komunikatów w UI: najpierw konfiguracja serwera, potem przeglądarka
      let wynik: PushStan;
      let biezacy: string | null = null;
      let komunikat: string | null = null;

      const ua = navigator.userAgent;
      // iPadOS 13+ przedstawia się jak Mac — rozpoznajemy go po ekranie dotykowym
      const ios =
        /iPhone|iPad|iPod/.test(ua) ||
        (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
      const standalone =
        window.matchMedia?.("(display-mode: standalone)").matches === true ||
        (navigator as Navigator & { standalone?: boolean }).standalone ===
          true;

      if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
        wynik = "nieskonfigurowany";
      } else if (
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        typeof Notification === "undefined"
      ) {
        // iPhone poza ekranem głównym nie ma PushManager — wtedy podpowiedź o instalacji zamiast „nieobsługiwana”
        wynik = ios && !standalone ? "ios-instalacja" : "nieobslugiwany";
      } else if (ios && !standalone) {
        wynik = "ios-instalacja";
      } else if (Notification.permission === "denied") {
        wynik = "zablokowany";
      } else {
        try {
          const rejestracja =
            await navigator.serviceWorker.getRegistration("/");
          const subskrypcja = await rejestracja?.pushManager.getSubscription();
          if (subskrypcja) {
            // Istniejąca subskrypcja: odświeżamy klucze i last_seen_at na serwerze
            const klucze = subskrypcja.toJSON().keys ?? {};
            const zapis = await savePushDevice({
              endpoint: subskrypcja.endpoint,
              p256dh: klucze.p256dh ?? "",
              auth: klucze.auth ?? "",
            });
            if (!zapis.ok) komunikat = zapis.message;
            wynik = "wlaczony";
            biezacy = subskrypcja.endpoint;
          } else {
            wynik = "wylaczony";
          }
        } catch {
          // np. przeglądarka blokuje service workery (tryb prywatny) — przełącznik zamiast wiecznego ładowania
          wynik = "wylaczony";
        }
      }

      if (anulowano) return;
      setStan(wynik);
      setEndpoint(biezacy);
      setBlad(komunikat);
    }

    wykryj();
    return () => {
      anulowano = true;
    };
  }, []);

  async function wlacz() {
    setZajety(true);
    setBlad(null);
    try {
      const zgoda = await Notification.requestPermission();
      if (zgoda !== "granted") {
        setStan(zgoda === "denied" ? "zablokowany" : "wylaczony");
        return;
      }

      const rejestracja = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
      await navigator.serviceWorker.ready;

      // Klucz VAPID z formatu base64url na bajty, jakich wymaga pushManager.subscribe
      const klucz = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
      const base64 = (klucz + "=".repeat((4 - (klucz.length % 4)) % 4))
        .replace(/-/g, "+")
        .replace(/_/g, "/");
      const surowy = window.atob(base64);
      const applicationServerKey = new Uint8Array(surowy.length);
      for (let i = 0; i < surowy.length; i++)
        applicationServerKey[i] = surowy.charCodeAt(i);

      const subskrypcja = await rejestracja.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      const klucze = subskrypcja.toJSON().keys ?? {};
      const zapis = await savePushDevice({
        endpoint: subskrypcja.endpoint,
        p256dh: klucze.p256dh ?? "",
        auth: klucze.auth ?? "",
      });
      if (!zapis.ok) {
        // Bez zapisu na serwerze subskrypcja byłaby martwa, więc ją cofamy
        await subskrypcja.unsubscribe().catch(() => false);
        setBlad(zapis.message);
        setStan("wylaczony");
        return;
      }
      setEndpoint(subskrypcja.endpoint);
      setStan("wlaczony");
    } catch {
      setBlad("Nie udało się włączyć powiadomień.");
    } finally {
      setZajety(false);
    }
  }

  async function wylacz() {
    setZajety(true);
    setBlad(null);
    try {
      const rejestracja = await navigator.serviceWorker.getRegistration("/");
      const subskrypcja = await rejestracja?.pushManager.getSubscription();
      const doUsuniecia = subskrypcja?.endpoint ?? endpoint;
      if (doUsuniecia) {
        const wynik = await removePushDevice(doUsuniecia);
        if (!wynik.ok) {
          setBlad("Nie udało się wyłączyć powiadomień.");
          return;
        }
      }
      if (subskrypcja) await subskrypcja.unsubscribe();
      setEndpoint(null);
      setStan("wylaczony");
    } catch {
      setBlad("Nie udało się wyłączyć powiadomień.");
    } finally {
      setZajety(false);
    }
  }

  return { stan, endpoint, blad, zajety, wlacz, wylacz };
}
