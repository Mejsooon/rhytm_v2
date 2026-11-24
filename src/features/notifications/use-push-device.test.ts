import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { savePushDevice, removePushDevice } = vi.hoisted(() => ({
  savePushDevice: vi.fn(),
  removePushDevice: vi.fn(),
}));
vi.mock("./push-actions", () => ({ savePushDevice, removePushDevice }));

import { usePushDevice } from "./use-push-device";

// Klucz publiczny VAPID w base64url (bez wypełnienia „=”); bajty 0..64
const BAJTY = Array.from({ length: 65 }, (_, i) => i);
const KLUCZ = btoa(String.fromCharCode(...BAJTY))
  .replace(/\+/g, "-")
  .replace(/\//g, "_")
  .replace(/=+$/, "");

const UA_LINUX =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const UA_IPHONE =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

function subskrypcja(endpoint: string) {
  return {
    endpoint,
    toJSON: () => ({ endpoint, keys: { p256dh: "klucz-p", auth: "klucz-a" } }),
    unsubscribe: vi.fn().mockResolvedValue(true),
  };
}

let istniejaca: ReturnType<typeof subskrypcja> | null;
let nowa: ReturnType<typeof subskrypcja>;
const subscribe = vi.fn();
const getSubscription = vi.fn();
const register = vi.fn();
const getRegistration = vi.fn();
const requestPermission = vi.fn();
let uprawnienie: NotificationPermission;
let standalone: boolean;

function ustawPrzegladarke(opcje: { bezPush?: boolean; ua?: string } = {}) {
  vi.spyOn(navigator, "userAgent", "get").mockReturnValue(
    opcje.ua ?? UA_LINUX,
  );
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: standalone,
  })) as unknown as typeof window.matchMedia;
  if (opcje.bezPush) return;

  const rejestracja = { pushManager: { getSubscription, subscribe } };
  getSubscription.mockImplementation(async () => istniejaca);
  subscribe.mockImplementation(async () => nowa);
  register.mockResolvedValue(rejestracja);
  getRegistration.mockResolvedValue(rejestracja);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: { register, getRegistration, ready: Promise.resolve(rejestracja) },
  });
  Object.defineProperty(window, "PushManager", {
    configurable: true,
    value: class {},
  });
  Object.defineProperty(window, "Notification", {
    configurable: true,
    value: {
      get permission() {
        return uprawnienie;
      },
      requestPermission,
    },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", KLUCZ);
  istniejaca = null;
  nowa = subskrypcja("https://fcm.googleapis.com/fcm/send/nowa");
  uprawnienie = "default";
  standalone = false;
  requestPermission.mockResolvedValue("granted");
  savePushDevice.mockResolvedValue({ ok: true, id: "id-1" });
  removePushDevice.mockResolvedValue({ ok: true });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  // Bez API push między testami (część testów sprawdza jego brak)
  Reflect.deleteProperty(navigator, "serviceWorker");
  Reflect.deleteProperty(window, "PushManager");
  Reflect.deleteProperty(window, "Notification");
});

describe("usePushDevice — stan początkowy", () => {
  it("brak klucza VAPID → nieskonfigurowany", async () => {
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "");
    ustawPrzegladarke();
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("nieskonfigurowany"));
    expect(getRegistration).not.toHaveBeenCalled();
  });

  it("brak serviceWorker/PushManager → nieobslugiwany", async () => {
    ustawPrzegladarke({ bezPush: true });
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("nieobslugiwany"));
  });

  it("iPhone poza ekranem głównym → ios-instalacja", async () => {
    ustawPrzegladarke({ ua: UA_IPHONE });
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("ios-instalacja"));
  });

  it("iPhone w Safari bez PushManager → ios-instalacja (nie „nieobsługiwana”)", async () => {
    ustawPrzegladarke({ ua: UA_IPHONE, bezPush: true });
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("ios-instalacja"));
  });

  it("iPhone z ekranu głównego (standalone) → zwykłe wykrywanie", async () => {
    standalone = true;
    ustawPrzegladarke({ ua: UA_IPHONE });
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wylaczony"));
  });

  it("zgoda odrzucona → zablokowany", async () => {
    uprawnienie = "denied";
    ustawPrzegladarke();
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("zablokowany"));
  });

  it("bez subskrypcji → wylaczony, bez zapisu", async () => {
    ustawPrzegladarke();
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wylaczony"));
    expect(getRegistration).toHaveBeenCalledWith("/");
    expect(savePushDevice).not.toHaveBeenCalled();
    expect(result.current.endpoint).toBeNull();
  });

  it("istniejąca subskrypcja → wlaczony i odświeżenie zapisu", async () => {
    uprawnienie = "granted";
    istniejaca = subskrypcja("https://fcm.googleapis.com/fcm/send/stara");
    ustawPrzegladarke();
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wlaczony"));
    expect(result.current.endpoint).toBe(
      "https://fcm.googleapis.com/fcm/send/stara",
    );
    expect(savePushDevice).toHaveBeenCalledWith({
      endpoint: "https://fcm.googleapis.com/fcm/send/stara",
      p256dh: "klucz-p",
      auth: "klucz-a",
    });
    expect(result.current.blad).toBeNull();
  });

  it("istniejąca subskrypcja, nieudane odświeżenie → wlaczony z błędem", async () => {
    uprawnienie = "granted";
    istniejaca = subskrypcja("https://fcm.googleapis.com/fcm/send/stara");
    savePushDevice.mockResolvedValue({
      ok: false,
      message: "Nie udało się zapisać urządzenia.",
    });
    ustawPrzegladarke();
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wlaczony"));
    expect(result.current.blad).toBe("Nie udało się zapisać urządzenia.");
  });

  it("błąd service workera przy starcie → wylaczony", async () => {
    ustawPrzegladarke();
    getRegistration.mockRejectedValue(new Error("SecurityError"));
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wylaczony"));
  });
});

describe("usePushDevice — wlacz()", () => {
  it("rejestruje /sw.js, subskrybuje z kluczem Uint8Array i zapisuje urządzenie", async () => {
    ustawPrzegladarke();
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wylaczony"));

    await act(() => result.current.wlacz());

    expect(requestPermission).toHaveBeenCalled();
    expect(register).toHaveBeenCalledWith("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    const opcje = subscribe.mock.calls[0][0];
    expect(opcje.userVisibleOnly).toBe(true);
    expect(opcje.applicationServerKey).toBeInstanceOf(Uint8Array);
    expect(Array.from(opcje.applicationServerKey)).toEqual(BAJTY);
    expect(savePushDevice).toHaveBeenCalledWith({
      endpoint: "https://fcm.googleapis.com/fcm/send/nowa",
      p256dh: "klucz-p",
      auth: "klucz-a",
    });
    expect(result.current.stan).toBe("wlaczony");
    expect(result.current.endpoint).toBe(
      "https://fcm.googleapis.com/fcm/send/nowa",
    );
    expect(result.current.zajety).toBe(false);
  });

  it("błąd zapisu → unsubscribe() i komunikat", async () => {
    ustawPrzegladarke();
    savePushDevice.mockResolvedValue({
      ok: false,
      message: "Nie udało się zapisać urządzenia.",
    });
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wylaczony"));

    await act(() => result.current.wlacz());

    expect(nowa.unsubscribe).toHaveBeenCalled();
    expect(result.current.blad).toBe("Nie udało się zapisać urządzenia.");
    expect(result.current.stan).toBe("wylaczony");
  });

  it("odmowa zgody → zablokowany bez rejestracji", async () => {
    ustawPrzegladarke();
    requestPermission.mockResolvedValue("denied");
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wylaczony"));

    await act(() => result.current.wlacz());

    expect(result.current.stan).toBe("zablokowany");
    expect(register).not.toHaveBeenCalled();
  });

  it("InvalidStateError (subskrypcja ze starym kluczem VAPID) → unsubscribe() starej i druga próba", async () => {
    ustawPrzegladarke();
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wylaczony"));
    const stara = subskrypcja("https://fcm.googleapis.com/fcm/send/stary-klucz");
    istniejaca = stara;
    subscribe
      .mockRejectedValueOnce(new DOMException("inny klucz", "InvalidStateError"))
      .mockImplementationOnce(async () => nowa);

    await act(() => result.current.wlacz());

    expect(stara.unsubscribe).toHaveBeenCalled();
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(savePushDevice).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://fcm.googleapis.com/fcm/send/nowa" }),
    );
    expect(result.current.stan).toBe("wlaczony");
    expect(result.current.blad).toBeNull();
  });

  it("InvalidStateError dwa razy → tylko jedna ponowna próba i komunikat", async () => {
    ustawPrzegladarke();
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wylaczony"));
    subscribe.mockRejectedValue(new DOMException("inny klucz", "InvalidStateError"));

    await act(() => result.current.wlacz());

    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(result.current.blad).toBe("Nie udało się włączyć powiadomień.");
    expect(result.current.stan).toBe("wylaczony");
  });

  it("wyjątek przeglądarki → „Nie udało się włączyć powiadomień.”", async () => {
    ustawPrzegladarke();
    subscribe.mockRejectedValue(new Error("AbortError"));
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wylaczony"));

    await act(() => result.current.wlacz());

    expect(result.current.blad).toBe("Nie udało się włączyć powiadomień.");
    expect(result.current.stan).toBe("wylaczony");
  });
});

describe("usePushDevice — wylacz()", () => {
  it("usuwa urządzenie na serwerze i robi unsubscribe()", async () => {
    uprawnienie = "granted";
    istniejaca = subskrypcja("https://fcm.googleapis.com/fcm/send/stara");
    ustawPrzegladarke();
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wlaczony"));

    await act(() => result.current.wylacz());

    expect(removePushDevice).toHaveBeenCalledWith(
      "https://fcm.googleapis.com/fcm/send/stara",
    );
    expect(istniejaca.unsubscribe).toHaveBeenCalled();
    expect(result.current.stan).toBe("wylaczony");
    expect(result.current.endpoint).toBeNull();
  });

  it("nieudane unsubscribe() po usunięciu na serwerze → wylaczony bez błędu", async () => {
    uprawnienie = "granted";
    istniejaca = subskrypcja("https://fcm.googleapis.com/fcm/send/stara");
    istniejaca.unsubscribe.mockRejectedValue(new Error("brak"));
    ustawPrzegladarke();
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wlaczony"));

    await act(() => result.current.wylacz());

    expect(removePushDevice).toHaveBeenCalled();
    expect(result.current.stan).toBe("wylaczony");
    expect(result.current.blad).toBeNull();
  });

  it("błąd usuwania → komunikat, subskrypcja zostaje", async () => {
    uprawnienie = "granted";
    istniejaca = subskrypcja("https://fcm.googleapis.com/fcm/send/stara");
    removePushDevice.mockResolvedValue({ ok: false });
    ustawPrzegladarke();
    const { result } = renderHook(() => usePushDevice());
    await waitFor(() => expect(result.current.stan).toBe("wlaczony"));

    await act(() => result.current.wylacz());

    expect(istniejaca.unsubscribe).not.toHaveBeenCalled();
    expect(result.current.blad).toBe("Nie udało się wyłączyć powiadomień.");
    expect(result.current.stan).toBe("wlaczony");
  });
});
