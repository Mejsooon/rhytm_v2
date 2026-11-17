import { describe, expect, it } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";
import type { BlockRow } from "./occurrences";
import { loadCalendar, minutesNow, pickBlocksForRange } from "./load-calendar";

function blok(id: string, start: string, recurrence: unknown = null): BlockRow {
  return {
    id,
    user_id: "u1",
    title: id,
    start_local: start,
    duration_min: 60,
    category_id: null,
    note: null,
    recurrence: recurrence as BlockRow["recurrence"],
    remind: false,
    timezone: "Europe/Warsaw",
    created_at: null,
    updated_at: null,
  };
}

const LISTOPAD = { from: "2026-11-01", to: "2026-11-30" };

describe("pickBlocksForRange", () => {
  it("bierze serię bez until, a pomija serię zakończoną przed zakresem", () => {
    const wynik = pickBlocksForRange(
      [
        blok("bez-until", "2026-10-06T08:00:00", { freq: "daily" }),
        blok("do-pazdziernika", "2026-10-06T08:00:00", { freq: "daily", until: "2026-10-31" }),
      ],
      LISTOPAD.from,
      LISTOPAD.to,
    );
    expect(wynik.map((b) => b.id)).toEqual(["bez-until"]);
  });

  it("seria z until równym początkowi zakresu zostaje", () => {
    const wynik = pickBlocksForRange(
      [blok("s", "2026-10-06T08:00:00", { freq: "daily", until: "2026-11-01" })],
      LISTOPAD.from,
      LISTOPAD.to,
    );
    expect(wynik).toHaveLength(1);
  });

  it("pomija bloki zaczynające się po końcu zakresu", () => {
    const wynik = pickBlocksForRange(
      [
        blok("pozniej", "2026-12-01T08:00:00", { freq: "daily" }),
        blok("jednorazowy-pozniej", "2026-12-02T08:00:00"),
      ],
      LISTOPAD.from,
      LISTOPAD.to,
    );
    expect(wynik).toEqual([]);
  });

  it("jednorazowy blok bierze tylko, gdy jego dzień jest w zakresie", () => {
    const wynik = pickBlocksForRange(
      [
        blok("w-zakresie", "2026-11-10T08:00:00"),
        blok("przed", "2026-10-30T08:00:00"),
      ],
      LISTOPAD.from,
      LISTOPAD.to,
    );
    expect(wynik.map((b) => b.id)).toEqual(["w-zakresie"]);
  });
});

describe("minutesNow", () => {
  it("liczy minuty od północy w podanej strefie", () => {
    // 2026-11-17 11:30 UTC = 12:30 w Warszawie
    expect(minutesNow("Europe/Warsaw", new Date("2026-11-17T11:30:00Z"))).toBe(750);
  });
});

// Atrapa klienta: każda tabela zwraca swoje wiersze, bez względu na filtry
function klient(tabele: Record<string, ReturnType<typeof fakeTable>>) {
  return { from: (nazwa: string) => tabele[nazwa] } as never;
}

describe("loadCalendar", () => {
  const profil = { timezone: "Europe/Warsaw", weekStart: "mon" as const, clock: "24" as const };

  it("zwraca wybrane bloki, wyjątki, zadania, kategorie i profil", async () => {
    const wynik = await loadCalendar(
      klient({
        blocks: fakeTable({
          data: [
            blok("bez-until", "2026-10-06T08:00:00", { freq: "daily" }),
            blok("do-pazdziernika", "2026-10-06T08:00:00", { freq: "daily", until: "2026-10-31" }),
          ],
        }),
        block_exceptions: fakeTable({ data: [] }),
        tasks: fakeTable({ data: [{ id: "t1" }] }),
        categories: fakeTable({ data: [{ id: "c1" }] }),
      }),
      "u1",
      LISTOPAD,
      profil,
    );
    expect(wynik.blocks.map((b) => b.id)).toEqual(["bez-until"]);
    expect(wynik.tasks).toHaveLength(1);
    expect(wynik.categories).toHaveLength(1);
    expect(wynik.profile).toEqual(profil);
  });

  it("dociąga blok jednorazowy, którego wyjątek przenosi wystąpienie do zakresu", async () => {
    const przeniesiony = blok("przeniesiony", "2026-10-28T08:00:00");
    const wyjatek = {
      block_id: "przeniesiony",
      user_id: "u1",
      occurrence_date: "2026-10-28",
      kind: "modified",
      new_start_local: "2026-11-02T09:00:00",
      new_duration_min: null,
      new_title: null,
    };
    // Pierwsze zapytanie o bloki (zakres) nic nie daje, drugie (po id) zwraca blok
    const bloki = fakeTable({ data: [] });
    let wywolania = 0;
    const oryginalnyThen = bloki.then;
    bloki.then = (ok: (v: unknown) => unknown, blad?: (e: unknown) => unknown) => {
      wywolania += 1;
      if (wywolania === 2) {
        return Promise.resolve({ data: [przeniesiony], error: null }).then(ok, blad);
      }
      return oryginalnyThen(ok, blad);
    };
    const wynik = await loadCalendar(
      klient({
        blocks: bloki,
        block_exceptions: fakeTable({ data: [wyjatek] }),
        tasks: fakeTable({ data: [] }),
        categories: fakeTable({ data: [] }),
      }),
      "u1",
      LISTOPAD,
      profil,
    );
    expect(wynik.blocks.map((b) => b.id)).toEqual(["przeniesiony"]);
    expect(wynik.exceptions).toHaveLength(1);
  });
});
