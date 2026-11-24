import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendNotification, setVapidDetails, revalidatePath, baza } = vi.hoisted(
  () => ({
    sendNotification: vi.fn(),
    setVapidDetails: vi.fn(),
    revalidatePath: vi.fn(),
    baza: {
      user: { id: "u-1" } as { id: string } | null,
      odczyt: { data: [] as unknown[] | null, error: null as unknown },
      limit: { data: [{ user_id: "u-1" }] as unknown[] | null, error: null as unknown },
      upsertBlad: null as unknown,
      select: vi.fn(),
      eq: vi.fn(),
      del: vi.fn(),
      in: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      or: vi.fn(),
      nawyk: { data: [{ id: "x" }] as unknown[] | null, error: null as unknown },
      nawykUpdate: vi.fn(),
      nawykEq: vi.fn(),
    },
  }),
);

vi.mock("web-push", () => ({ sendNotification, setVapidDetails }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: baza.user } }) },
    from: (tabela: string) => {
      if (tabela === "notification_settings") {
        return {
          upsert: async (wiersz: unknown, opcje: unknown) => {
            baza.upsert(wiersz, opcje);
            return { error: baza.upsertBlad };
          },
          update: (zmiana: unknown) => {
            baza.update(zmiana);
            return {
              eq: (kolumna: string, wartosc: unknown) => {
                baza.eq(kolumna, wartosc);
                return {
                  or: (filtr: string) => {
                    baza.or(filtr);
                    return { select: async () => baza.limit };
                  },
                };
              },
            };
          },
        };
      }
      if (tabela === "habits") {
        return {
          update: (zmiana: unknown) => {
            baza.nawykUpdate(zmiana);
            return {
              eq: (kolumna: string, wartosc: unknown) => {
                baza.nawykEq(kolumna, wartosc);
                return { select: async () => baza.nawyk };
              },
            };
          },
        };
      }
      expect(tabela).toBe("push_subscriptions");
      return {
        select: (kolumny: string) => {
          baza.select(kolumny);
          return {
            eq: async (kolumna: string, wartosc: unknown) => {
              baza.eq(kolumna, wartosc);
              return baza.odczyt;
            },
          };
        },
        delete: () => {
          baza.del();
          return {
            in: async (kolumna: string, wartosci: string[]) => {
              baza.in(kolumna, wartosci);
              return { error: null };
            },
          };
        },
      };
    },
  }),
}));

import { saveNotificationSettings, sendTestPush, setHabitReminder } from "./actions";

const KOMPUTER = {
  endpoint: "https://fcm.googleapis.com/fcm/send/komputer",
  p256dh: "k1",
  auth: "a1",
};
const TELEFON = {
  endpoint: "https://web.push.apple.com/telefon",
  p256dh: "k2",
  auth: "a2",
};

describe("sendTestPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.VAPID_SUBJECT = "mailto:test@example.com";
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    baza.odczyt = { data: [KOMPUTER, TELEFON], error: null };
    baza.user = { id: "u-1" };
    baza.limit = { data: [{ user_id: "u-1" }], error: null };
    baza.upsertBlad = null;
    sendNotification.mockResolvedValue({ statusCode: 201 });
  });

  it("bez kluczy VAPID → łagodny komunikat, bez odczytu i wysyłki", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    expect(await sendTestPush()).toEqual({
      ok: false,
      message: "Push nie jest jeszcze skonfigurowany.",
    });
    expect(baza.select).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("brak włączonych urządzeń → komunikat", async () => {
    baza.odczyt = { data: [], error: null };
    expect(await sendTestPush()).toEqual({
      ok: false,
      message: "Włącz push i co najmniej jedno urządzenie, żeby wysłać test.",
    });
    expect(baza.eq).toHaveBeenCalledWith("enabled", true);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("błąd odczytu (np. stara baza) → komunikat", async () => {
    baza.odczyt = { data: null, error: { code: "42P01" } };
    const wynik = await sendTestPush();
    expect(wynik.ok).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("limit: test w ciągu 30 s → „Spróbuj ponownie za chwilę.” bez wysyłki", async () => {
    baza.limit = { data: [], error: null };
    expect(await sendTestPush()).toEqual({
      ok: false,
      message: "Spróbuj ponownie za chwilę.",
    });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("limit: znacznik ustawiany atomowo przed wysyłką (warunek na poprzedni test)", async () => {
    await sendTestPush();
    expect(baza.upsert).toHaveBeenCalledWith(
      { user_id: "u-1" },
      { onConflict: "user_id", ignoreDuplicates: true },
    );
    expect(baza.update).toHaveBeenCalledWith({
      last_test_push_at: expect.any(String),
    });
    expect(baza.eq).toHaveBeenCalledWith("user_id", "u-1");
    const filtr = baza.or.mock.calls[0][0] as string;
    expect(filtr).toMatch(/^last_test_push_at\.is\.null,last_test_push_at\.lt\./);
    // Granica = 30 s temu (±5 s)
    const granica = Date.parse(filtr.split(".lt.")[1]);
    expect(Math.abs(Date.now() - 30_000 - granica)).toBeLessThan(5_000);
    expect(baza.update.mock.invocationCallOrder[0]).toBeLessThan(
      sendNotification.mock.invocationCallOrder[0],
    );
  });

  it("brak urządzeń nie zużywa limitu", async () => {
    baza.odczyt = { data: [], error: null };
    await sendTestPush();
    expect(baza.update).not.toHaveBeenCalled();
  });

  it("błąd zapisu znacznika (np. stara baza) → komunikat bez wysyłki", async () => {
    baza.limit = { data: null, error: { code: "42703" } };
    const wynik = await sendTestPush();
    expect(wynik.ok).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("brak sesji → komunikat bez wysyłki", async () => {
    baza.user = null;
    const wynik = await sendTestPush();
    expect(wynik.ok).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("dwa urządzenia → sent: 2 i payload testowy", async () => {
    expect(await sendTestPush()).toEqual({ ok: true, sent: 2 });
    expect(baza.select).toHaveBeenCalledWith("endpoint, p256dh, auth");
    expect(setVapidDetails).toHaveBeenCalledWith(
      "mailto:test@example.com",
      "pub",
      "priv",
    );
    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [subskrypcja, payload, opcje] = sendNotification.mock.calls[0];
    expect(subskrypcja).toEqual({
      endpoint: KOMPUTER.endpoint,
      keys: { p256dh: "k1", auth: "a1" },
    });
    expect(JSON.parse(payload)).toEqual({
      title: "rhytm",
      body: "Powiadomienia działają ✓",
      tag: "test",
      url: "/ustawienia/powiadomienia",
    });
    expect(opcje).toEqual({ TTL: 3600, timeout: 10000 });
    expect(baza.del).not.toHaveBeenCalled();
  });

  it("410 z jednego urządzenia → usuwa własny wiersz, wysłane na drugie", async () => {
    sendNotification.mockImplementation(async (s: { endpoint: string }) => {
      if (s.endpoint === TELEFON.endpoint)
        throw Object.assign(new Error("gone"), { statusCode: 410 });
      return { statusCode: 201 };
    });
    expect(await sendTestPush()).toEqual({ ok: true, sent: 1 });
    expect(baza.in).toHaveBeenCalledWith("endpoint", [TELEFON.endpoint]);
    expect(revalidatePath).toHaveBeenCalledWith("/ustawienia/powiadomienia");
  });

  it("wszystkie urządzenia wygasły → komunikat i usunięcie", async () => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("not found"), { statusCode: 404 }),
    );
    expect(await sendTestPush()).toEqual({
      ok: false,
      message:
        "Urządzenia przestały przyjmować powiadomienia. Włącz push ponownie na tym urządzeniu.",
    });
    expect(baza.in).toHaveBeenCalledWith("endpoint", [
      KOMPUTER.endpoint,
      TELEFON.endpoint,
    ]);
  });

  it("błąd serwera push (500) → komunikat bez usuwania", async () => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("boom"), { statusCode: 500 }),
    );
    expect(await sendTestPush()).toEqual({
      ok: false,
      message: "Nie udało się wysłać testowego powiadomienia. Spróbuj ponownie.",
    });
    expect(baza.del).not.toHaveBeenCalled();
  });
});

describe("saveNotificationSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    baza.user = { id: "u-1" };
    baza.upsertBlad = null;
  });

  it("zapisuje pole upsertem po user_id", async () => {
    expect(await saveNotificationSettings({ renewals_enabled: false })).toEqual({
      ok: true,
    });
    expect(baza.upsert).toHaveBeenCalledWith(
      { user_id: "u-1", renewals_enabled: false },
      { onConflict: "user_id" },
    );
    expect(revalidatePath).toHaveBeenCalledWith("/ustawienia/powiadomienia");
  });

  it.each([5, null])("before_block_min = %s jest przyjmowane", async (v) => {
    expect(await saveNotificationSettings({ before_block_min: v as 5 | null })).toEqual({ ok: true });
    expect(baza.upsert).toHaveBeenCalledWith(
      { user_id: "u-1", before_block_min: v },
      { onConflict: "user_id" },
    );
  });

  it("before_block_min = 10 → odrzucone bez zapisu", async () => {
    const wynik = await saveNotificationSettings({
      before_block_min: 10 as unknown as 5,
    });
    expect(wynik).toEqual({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    expect(baza.upsert).not.toHaveBeenCalled();
  });

  it("cicha noc: godziny HH:MM co 5 minut", async () => {
    expect(
      await saveNotificationSettings({ quiet_from: "22:30", quiet_to: "06:05" }),
    ).toEqual({ ok: true });
    expect(baza.upsert).toHaveBeenCalledWith(
      { user_id: "u-1", quiet_from: "22:30", quiet_to: "06:05" },
      { onConflict: "user_id" },
    );
  });

  it.each(["22:31", "24:00", "7:00", "22:30:00", "ab:cd", ""])(
    "quiet_from „%s” → odrzucone",
    async (v) => {
      const wynik = await saveNotificationSettings({ quiet_from: v });
      expect(wynik.ok).toBe(false);
      expect(baza.upsert).not.toHaveBeenCalled();
    },
  );

  it("równe godziny cichej nocy → komunikat bez zapisu", async () => {
    expect(
      await saveNotificationSettings({ quiet_from: "07:00", quiet_to: "07:00" }),
    ).toEqual({
      ok: false,
      message: "Początek i koniec cichej nocy muszą się różnić.",
    });
    expect(baza.upsert).not.toHaveBeenCalled();
  });

  it("nieznane pole albo pusty patch → odrzucone", async () => {
    expect(
      (await saveNotificationSettings({ push_enabled: true } as never)).ok,
    ).toBe(false);
    expect((await saveNotificationSettings({})).ok).toBe(false);
    expect(baza.upsert).not.toHaveBeenCalled();
  });

  it("błąd bazy → komunikat", async () => {
    baza.upsertBlad = { code: "42501" };
    expect(await saveNotificationSettings({ habits_enabled: true })).toEqual({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
  });

  it("brak sesji → komunikat bez zapisu", async () => {
    baza.user = null;
    expect((await saveNotificationSettings({ habits_enabled: true })).ok).toBe(
      false,
    );
    expect(baza.upsert).not.toHaveBeenCalled();
  });
});

describe("setHabitReminder", () => {
  const ID = "7d3f2a4e-1b2c-4d5e-8f90-123456789abc";
  beforeEach(() => {
    vi.clearAllMocks();
    baza.nawyk = { data: [{ id: ID }], error: null };
  });

  it("godzina → update remind_at i odświeżenie Nawyków", async () => {
    expect(await setHabitReminder(ID, "20:30")).toEqual({ ok: true });
    expect(baza.nawykUpdate).toHaveBeenCalledWith({ remind_at: "20:30" });
    expect(baza.nawykEq).toHaveBeenCalledWith("id", ID);
    expect(revalidatePath).toHaveBeenCalledWith("/nawyki");
    expect(revalidatePath).toHaveBeenCalledWith("/ustawienia/powiadomienia");
  });

  it("null → wyłącza przypomnienie", async () => {
    expect(await setHabitReminder(ID, null)).toEqual({ ok: true });
    expect(baza.nawykUpdate).toHaveBeenCalledWith({ remind_at: null });
  });

  it.each([
    ["nie-uuid", "20:30"],
    [ID, "20:31"],
    [ID, "25:00"],
  ])("zły wpis (%s, %s) → odrzucony bez zapisu", async (id, godz) => {
    expect((await setHabitReminder(id, godz)).ok).toBe(false);
    expect(baza.nawykUpdate).not.toHaveBeenCalled();
  });

  it("brak wiersza (cudzy albo usunięty) → komunikat", async () => {
    baza.nawyk = { data: [], error: null };
    expect(await setHabitReminder(ID, "20:30")).toEqual({
      ok: false,
      message: "Nie znaleziono nawyku.",
    });
  });

  it("błąd bazy → komunikat", async () => {
    baza.nawyk = { data: null, error: { code: "x" } };
    expect(await setHabitReminder(ID, "20:30")).toEqual({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
  });
});
