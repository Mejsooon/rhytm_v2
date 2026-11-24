import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, from, revalidatePath, naglowki } = vi.hoisted(() => ({
  rpc: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
  naglowki: { ua: "" as string | null },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, from }),
}));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers(naglowki.ua === null ? {} : { "user-agent": naglowki.ua }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  removePushDevice,
  savePushDevice,
  setDeviceEnabled,
} from "./push-actions";

const UA_CHROME_WINDOWS =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const URZADZENIE = {
  endpoint: "https://fcm.googleapis.com/fcm/send/abc",
  p256dh: "klucz",
  auth: "sekret",
};

describe("savePushDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    naglowki.ua = UA_CHROME_WINDOWS;
    rpc.mockResolvedValue({ data: "id-1", error: null });
  });

  it("zapisuje przez save_push_subscription z etykietą z nagłówka user-agent", async () => {
    expect(await savePushDevice(URZADZENIE)).toEqual({ ok: true, id: "id-1" });
    expect(rpc).toHaveBeenCalledWith("save_push_subscription", {
      p_endpoint: URZADZENIE.endpoint,
      p_p256dh: "klucz",
      p_auth: "sekret",
      p_label: "Chrome · Windows",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/ustawienia/powiadomienia");
  });

  it("bez nagłówka user-agent → etykieta ogólna", async () => {
    naglowki.ua = null;
    await savePushDevice(URZADZENIE);
    expect(rpc).toHaveBeenCalledWith(
      "save_push_subscription",
      expect.objectContaining({ p_label: "Przeglądarka · nieznany system" }),
    );
  });

  it.each([
    ["pusty endpoint", { ...URZADZENIE, endpoint: "" }],
    ["za długi klucz", { ...URZADZENIE, p256dh: "x".repeat(1001) }],
    ["brak auth", { endpoint: URZADZENIE.endpoint, p256dh: "k" }],
  ])("walidacja: %s → komunikat, bez RPC", async (_, wejscie) => {
    expect(
      await savePushDevice(wejscie as typeof URZADZENIE),
    ).toEqual({ ok: false, message: "Nie udało się zapisać urządzenia." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("błąd RPC (np. obcy serwer push albo stara baza) → komunikat", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "invalid subscription" },
    });
    expect(await savePushDevice(URZADZENIE)).toEqual({
      ok: false,
      message: "Nie udało się zapisać urządzenia.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("removePushDevice", () => {
  const eq = vi.fn();
  const del = vi.fn(() => ({ eq }));

  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ delete: del });
    eq.mockResolvedValue({ error: null });
  });

  it("usuwa wiersz o danym endpoincie", async () => {
    expect(await removePushDevice(URZADZENIE.endpoint)).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("push_subscriptions");
    expect(eq).toHaveBeenCalledWith("endpoint", URZADZENIE.endpoint);
    expect(revalidatePath).toHaveBeenCalledWith("/ustawienia/powiadomienia");
  });

  it("pusty endpoint → ok: false bez zapytania", async () => {
    expect(await removePushDevice("")).toEqual({ ok: false });
    expect(from).not.toHaveBeenCalled();
  });

  it("błąd bazy → ok: false", async () => {
    eq.mockResolvedValue({ error: { message: "brak tabeli" } });
    expect(await removePushDevice(URZADZENIE.endpoint)).toEqual({ ok: false });
  });
});

describe("setDeviceEnabled", () => {
  const ID = "00000000-0000-4000-8000-000000000001";
  const select = vi.fn();
  const eq = vi.fn(() => ({ select }));
  const update = vi.fn(() => ({ eq }));

  beforeEach(() => {
    vi.clearAllMocks();
    from.mockReturnValue({ update });
    select.mockResolvedValue({ data: [{ id: ID }], error: null });
  });

  it("aktualizuje tylko kolumnę enabled", async () => {
    expect(await setDeviceEnabled(ID, false)).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("push_subscriptions");
    expect(update).toHaveBeenCalledWith({ enabled: false });
    expect(eq).toHaveBeenCalledWith("id", ID);
    expect(revalidatePath).toHaveBeenCalledWith("/ustawienia/powiadomienia");
  });

  it("złe id → komunikat bez zapytania", async () => {
    expect(await setDeviceEnabled("nie-uuid", true)).toEqual({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("błąd bazy → komunikat", async () => {
    select.mockResolvedValue({ data: null, error: { message: "x" } });
    expect(await setDeviceEnabled(ID, true)).toEqual({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
  });

  it("brak wiersza (usunięte urządzenie) → komunikat", async () => {
    select.mockResolvedValue({ data: [], error: null });
    expect(await setDeviceEnabled(ID, true)).toEqual({
      ok: false,
      message: "To urządzenie zostało już usunięte.",
    });
  });
});
