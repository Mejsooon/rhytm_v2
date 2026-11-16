import { describe, expect, it, vi } from "vitest";

import { sesjaZLinkuResetu } from "./recovery";

const TERAZ = Date.UTC(2026, 10, 16, 12, 0, 0);
const TERAZ_S = TERAZ / 1000;

// Udaje klienta Supabase: getClaims zwraca podane claims (albo błąd)
function klient(wynik: { claims?: Record<string, unknown>; error?: unknown }) {
  const getClaims = vi.fn(async () =>
    wynik.error ? { data: null, error: wynik.error } : { data: wynik.claims ? { claims: wynik.claims } : null, error: null },
  );
  return { auth: { getClaims } } as unknown as Parameters<typeof sesjaZLinkuResetu>[0];
}

describe("sesjaZLinkuResetu", () => {
  it("amr z recovery sprzed 5 minut → true", async () => {
    const supabase = klient({ claims: { sub: "u1", amr: [{ method: "recovery", timestamp: TERAZ_S - 300 }] } });
    expect(await sesjaZLinkuResetu(supabase, TERAZ)).toBe(true);
  });

  it("recovery nie musi być pierwszym wpisem amr", async () => {
    const supabase = klient({
      claims: {
        sub: "u1",
        amr: [
          { method: "password", timestamp: TERAZ_S - 10 },
          { method: "recovery", timestamp: TERAZ_S - 60 },
        ],
      },
    });
    expect(await sesjaZLinkuResetu(supabase, TERAZ)).toBe(true);
  });

  it("recovery starszy niż 15 minut → false", async () => {
    const supabase = klient({ claims: { sub: "u1", amr: [{ method: "recovery", timestamp: TERAZ_S - 15 * 60 - 1 }] } });
    expect(await sesjaZLinkuResetu(supabase, TERAZ)).toBe(false);
  });

  it("zwykłe logowanie hasłem (bez recovery) → false", async () => {
    const supabase = klient({ claims: { sub: "u1", amr: [{ method: "password", timestamp: TERAZ_S - 10 }] } });
    expect(await sesjaZLinkuResetu(supabase, TERAZ)).toBe(false);
  });

  it("amr w formacie tekstowym (bez znacznika czasu) → false", async () => {
    const supabase = klient({ claims: { sub: "u1", amr: ["recovery"] } });
    expect(await sesjaZLinkuResetu(supabase, TERAZ)).toBe(false);
  });

  it("brak sesji albo błąd weryfikacji JWT → false", async () => {
    expect(await sesjaZLinkuResetu(klient({}), TERAZ)).toBe(false);
    expect(await sesjaZLinkuResetu(klient({ error: { message: "invalid JWT" } }), TERAZ)).toBe(false);
  });

  it("znacznik czasu z przyszłości (rozjechany zegar ponad 1 min) → false", async () => {
    const supabase = klient({ claims: { sub: "u1", amr: [{ method: "recovery", timestamp: TERAZ_S + 120 }] } });
    expect(await sesjaZLinkuResetu(supabase, TERAZ)).toBe(false);
  });
});
