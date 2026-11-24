import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendNotification, setVapidDetails, rpc, createClient } = vi.hoisted(
  () => {
    const rpc = vi.fn();
    return {
      sendNotification: vi.fn(),
      setVapidDetails: vi.fn(),
      rpc,
      createClient: vi.fn(() => ({ rpc })),
    };
  },
);

vi.mock("web-push", () => ({ sendNotification, setVapidDetails }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

import { POST } from "./route";

const nawykWoda = {
  endpoint: "https://fcm.googleapis.com/fcm/send/woda",
  p256dh: "p256-woda",
  auth: "auth-woda",
  kind: "habit",
  title: "rhytm",
  body: "Pora na: Woda",
  tag: "habit-1",
  url: "/nawyki/1",
};
const blokBieg = {
  endpoint: "https://fcm.googleapis.com/fcm/send/bieg",
  p256dh: "p256-bieg",
  auth: "auth-bieg",
  kind: "block",
  title: "Za 5 min: Bieg",
  body: "18:00–19:00",
  tag: "block-2-2026-12-02",
  url: "/kalendarz?widok=dzien&data=2026-12-02",
};

function makeRequest(
  body: unknown,
  token: string | null = "sekret",
  authorization: string | null = token === null ? null : `Bearer ${token}`,
) {
  return new Request("http://localhost/api/cron/powiadomienia", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorization === null ? {} : { authorization }),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  process.env.CRON_SECRET = "sekret";
  process.env.VAPID_SUBJECT = "mailto:test@example.com";
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = "pub";
  process.env.VAPID_PRIVATE_KEY = "priv";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "publiczny";
  sendNotification.mockResolvedValue({ statusCode: 201 });
  rpc.mockResolvedValue({ data: 1, error: null });
});

describe("POST /api/cron/powiadomienia", () => {
  it("zwraca 401 przy złym tokenie i nie wysyła", async () => {
    const res = await POST(makeRequest({ notifications: [nawykWoda] }, "zly"));
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "unauthorized" });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 401 przy złym tokenie tej samej długości", async () => {
    const res = await POST(makeRequest({ notifications: [nawykWoda] }, "sekreT"));
    expect(res.status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 401 przy samym sekrecie bez prefiksu Bearer", async () => {
    const res = await POST(
      makeRequest({ notifications: [nawykWoda] }, null, "sekret"),
    );
    expect(res.status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 401 przy innym prefiksie niż dokładnie 'Bearer '", async () => {
    const res = await POST(
      makeRequest({ notifications: [nawykWoda] }, null, "bearer sekret"),
    );
    expect(res.status).toBe(401);
    const res2 = await POST(
      makeRequest({ notifications: [nawykWoda] }, null, "Bearer  sekret"),
    );
    expect(res2.status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 401 bez nagłówka Authorization", async () => {
    const res = await POST(makeRequest({ notifications: [nawykWoda] }, null));
    expect(res.status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 401, gdy CRON_SECRET nie jest ustawiony (także przy pustym tokenie)", async () => {
    delete process.env.CRON_SECRET;
    const res = await POST(makeRequest({ notifications: [nawykWoda] }, ""));
    expect(res.status).toBe(401);
    const res2 = await POST(makeRequest({ notifications: [nawykWoda] }, "sekret"));
    expect(res2.status).toBe(401);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 500, gdy brakuje konfiguracji VAPID, i nie wysyła", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    const res = await POST(makeRequest({ notifications: [nawykWoda] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "vapid not configured" });
    expect(setVapidDetails).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("brak VAPID nie zdradza się bez poprawnego tokenu (najpierw 401)", async () => {
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
    const res = await POST(makeRequest({ notifications: [nawykWoda] }, "zly"));
    expect(res.status).toBe(401);
  });

  it("zwraca 400 przy złym body", async () => {
    const res = await POST(makeRequest({ notifications: "nie tablica" }));
    expect(res.status).toBe(400);
    const res2 = await POST(makeRequest("{nie json"));
    expect(res2.status).toBe(400);
    const res3 = await POST(
      makeRequest({ notifications: [{ ...nawykWoda, title: 5 }] }),
    );
    expect(res3.status).toBe(400);
    const res4 = await POST(makeRequest({ reminders: [nawykWoda] }));
    expect(res4.status).toBe(400);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("zwraca 400 przy przekroczonych limitach (endpoint bez https, za długie pola, za dużo wierszy)", async () => {
    for (const zly of [
      { ...nawykWoda, endpoint: "http://fcm.googleapis.com/x" },
      { ...nawykWoda, endpoint: "https://x/" + "a".repeat(1000) },
      { ...nawykWoda, p256dh: "" },
      { ...nawykWoda, title: "t".repeat(301) },
      { ...nawykWoda, body: "b".repeat(1001) },
      { ...nawykWoda, kind: "inne" },
    ]) {
      const res = await POST(makeRequest({ notifications: [zly] }));
      expect(res.status).toBe(400);
    }
    const res = await POST(
      makeRequest({ notifications: Array.from({ length: 1001 }, () => nawykWoda) }),
    );
    expect(res.status).toBe(400);
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("brak zmiennych Supabase → 500 przed wysyłką", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const res = await POST(makeRequest({ notifications: [nawykWoda] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "supabase not configured" });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("wysyła paczkami po 50 (następna paczka dopiero po zakończeniu poprzedniej)", async () => {
    let wToku = 0;
    let maksimum = 0;
    sendNotification.mockImplementation(async () => {
      wToku += 1;
      maksimum = Math.max(maksimum, wToku);
      await new Promise((r) => setTimeout(r, 1));
      wToku -= 1;
      return { statusCode: 201 };
    });
    const lista = Array.from({ length: 120 }, (_, i) => ({
      ...nawykWoda,
      endpoint: `https://fcm.googleapis.com/fcm/send/${i}`,
    }));

    const res = await POST(makeRequest({ notifications: lista }));

    expect(await res.json()).toEqual({ sent: 120, failed: 0, removed: 0 });
    expect(sendNotification).toHaveBeenCalledTimes(120);
    expect(maksimum).toBe(50);
  });

  it("wyjątek klienta Supabase przy usuwaniu → odpowiedź bez usunięć", async () => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("gone"), { statusCode: 410 }),
    );
    rpc.mockRejectedValue(new Error("fetch failed"));

    const res = await POST(makeRequest({ notifications: [nawykWoda] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 1, removed: 0 });
  });

  it("pusta lista → nic nie wysyła i zwraca zera", async () => {
    const res = await POST(makeRequest({ notifications: [] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 0, removed: 0 });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it("410 liczy się jako failed i removed, a rpc dostaje ten endpoint", async () => {
    sendNotification.mockImplementation(async (subscription) => {
      if (subscription.endpoint === blokBieg.endpoint) {
        throw Object.assign(new Error("gone"), { statusCode: 410 });
      }
      return { statusCode: 201 };
    });

    const res = await POST(makeRequest({ notifications: [nawykWoda, blokBieg] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 1, failed: 1, removed: 1 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("remove_push_subscriptions", {
      p_secret: "sekret",
      p_endpoints: [blokBieg.endpoint],
    });
  });

  it("klient Supabase powstaje z adresu i klucza publicznego, bez sesji", async () => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("not found"), { statusCode: 404 }),
    );

    await POST(makeRequest({ notifications: [nawykWoda] }));

    expect(createClient).toHaveBeenCalledWith(
      "http://localhost:54321",
      "publiczny",
      expect.objectContaining({
        auth: expect.objectContaining({ persistSession: false }),
      }),
    );
    expect(rpc).toHaveBeenCalledWith("remove_push_subscriptions", {
      p_secret: "sekret",
      p_endpoints: [nawykWoda.endpoint],
    });
  });

  it("ten sam wygasły endpoint dwa razy → jedno usunięcie", async () => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("gone"), { statusCode: 410 }),
    );

    await POST(
      makeRequest({ notifications: [nawykWoda, { ...nawykWoda, tag: "habit-9" }] }),
    );

    expect(rpc).toHaveBeenCalledWith("remove_push_subscriptions", {
      p_secret: "sekret",
      p_endpoints: [nawykWoda.endpoint],
    });
  });

  it("500 z usługi push liczy się jako failed, ale nie jest usuwane", async () => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("boom"), { statusCode: 500 }),
    );

    const res = await POST(makeRequest({ notifications: [nawykWoda] }));

    expect(await res.json()).toEqual({ sent: 0, failed: 1, removed: 0 });
    expect(rpc).not.toHaveBeenCalled();
    expect(createClient).not.toHaveBeenCalled();
  });

  it("błąd usuwania nie psuje odpowiedzi (removed = 0)", async () => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("gone"), { statusCode: 410 }),
    );
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "unauthorized" } });

    const res = await POST(makeRequest({ notifications: [nawykWoda] }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ sent: 0, failed: 1, removed: 0 });
  });

  it("logi zawierają tylko status i origin (bez kluczy i ścieżki endpointu)", async () => {
    sendNotification.mockRejectedValue(
      Object.assign(new Error("gone"), { statusCode: 410 }),
    );

    await POST(makeRequest({ notifications: [nawykWoda] }));

    const logi = vi.mocked(console.error).mock.calls.flat().join(" ");
    expect(logi).toContain("410");
    expect(logi).toContain("https://fcm.googleapis.com");
    expect(logi).not.toContain("/fcm/send/woda");
    expect(logi).not.toContain("p256-woda");
    expect(logi).not.toContain("auth-woda");
    expect(logi).not.toContain("sekret");
  });

  it("wysyła payload { title, body, tag, url } z TTL 3600 i timeoutem 10 s", async () => {
    const res = await POST(makeRequest({ notifications: [blokBieg] }));

    expect(await res.json()).toEqual({ sent: 1, failed: 0, removed: 0 });
    expect(setVapidDetails).toHaveBeenCalledWith(
      "mailto:test@example.com",
      "pub",
      "priv",
    );
    expect(sendNotification).toHaveBeenCalledTimes(1);
    const [subscription, payload, options] = sendNotification.mock.calls[0];
    expect(subscription).toEqual({
      endpoint: blokBieg.endpoint,
      keys: { p256dh: "p256-bieg", auth: "auth-bieg" },
    });
    expect(JSON.parse(payload)).toEqual({
      title: "Za 5 min: Bieg",
      body: "18:00–19:00",
      tag: "block-2-2026-12-02",
      url: "/kalendarz?widok=dzien&data=2026-12-02",
    });
    expect(options).toEqual({ TTL: 3600, timeout: 10000 });
    expect(rpc).not.toHaveBeenCalled();
  });
});
