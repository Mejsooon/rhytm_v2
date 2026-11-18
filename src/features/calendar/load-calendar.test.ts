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
        blok("do-pazdziernika", "2026-10-06T08:00:00", {
          freq: "daily",
          until: "2026-10-31",
        }),
      ],
      LISTOPAD.from,
      LISTOPAD.to,
    );
    expect(wynik.map((b) => b.id)).toEqual(["bez-until"]);
  });

  it("seria z until równym początkowi zakresu zostaje", () => {
    const wynik = pickBlocksForRange(
      [
        blok("s", "2026-10-06T08:00:00", {
          freq: "daily",
          until: "2026-11-01",
        }),
      ],
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
    expect(minutesNow("Europe/Warsaw", new Date("2026-11-17T11:30:00Z"))).toBe(
      750,
    );
  });
});

// Atrapa klienta: każda tabela zwraca swoje wiersze, bez względu na filtry
function klient(tabele: Record<string, ReturnType<typeof fakeTable>>) {
  // Tabele bez danych w teście (np. sport) zwracają pustą listę
  return {
    from: (nazwa: string) => tabele[nazwa] ?? fakeTable({ data: [] }),
  } as never;
}

describe("loadCalendar", () => {
  const profil = {
    timezone: "Europe/Warsaw",
    weekStart: "mon" as const,
    clock: "24" as const,
  };

  it("zwraca wybrane bloki, wyjątki, zadania, kategorie i profil", async () => {
    const wynik = await loadCalendar(
      klient({
        blocks: fakeTable({
          data: [
            blok("bez-until", "2026-10-06T08:00:00", { freq: "daily" }),
            blok("do-pazdziernika", "2026-10-06T08:00:00", {
              freq: "daily",
              until: "2026-10-31",
            }),
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
    bloki.then = (
      ok: (v: unknown) => unknown,
      blad?: (e: unknown) => unknown,
    ) => {
      wywolania += 1;
      if (wywolania === 2) {
        return Promise.resolve({ data: [przeniesiony], error: null }).then(
          ok,
          blad,
        );
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

  it("rzuca błąd, gdy któreś zapytanie się nie powiodło", async () => {
    await expect(
      loadCalendar(
        klient({
          blocks: fakeTable({ data: null, error: { message: "boom" } }),
          block_exceptions: fakeTable({ data: [] }),
          tasks: fakeTable({ data: [] }),
          categories: fakeTable({ data: [] }),
        }),
        "u1",
        LISTOPAD,
        profil,
      ),
    ).rejects.toThrow("boom");
  });
  it("bloki jednorazowe pyta tylko od początku zakresu (serie bez dolnej granicy)", async () => {
    const bloki = fakeTable({ data: [] });
    await loadCalendar(
      klient({
        blocks: bloki,
        block_exceptions: fakeTable({ data: [] }),
        tasks: fakeTable({ data: [] }),
        categories: fakeTable({ data: [] }),
      }),
      "u1",
      LISTOPAD,
      profil,
    );
    expect(bloki.or).toHaveBeenCalledWith(
      "recurrence.not.is.null,start_local.gte.2026-11-01T00:00:00",
    );
  });

  it("dociąga zadania wystąpienia przeniesionego do zakresu spoza niego (stare dane)", async () => {
    const seria = blok("seria", "2026-10-06T08:00:00", { freq: "weekly" });
    // Wtorek 27.10 przeniesiony na pn 2.11; zadanie ma stary termin (27.10)
    const wyjatek = {
      block_id: "seria",
      user_id: "u1",
      occurrence_date: "2026-10-27",
      kind: "modified",
      new_start_local: "2026-11-02T09:00:00",
      new_duration_min: null,
      new_title: null,
    };
    const zadanieWZakresie = {
      id: "t1",
      block_id: "seria",
      occurrence_date: "2026-11-03",
      position: 1,
    };
    const zadaniePrzeniesione = {
      id: "t2",
      block_id: "seria",
      occurrence_date: "2026-10-27",
      position: 0,
    };
    const zadanieInnegoDnia = {
      id: "t3",
      block_id: "seria",
      occurrence_date: "2026-10-20",
      position: 0,
    };
    const zadania = fakeTable({ data: [zadanieWZakresie] });
    let wywolania = 0;
    const oryginalnyThen = zadania.then;
    zadania.then = (
      ok: (v: unknown) => unknown,
      blad?: (e: unknown) => unknown,
    ) => {
      wywolania += 1;
      if (wywolania === 2) {
        return Promise.resolve({
          data: [zadaniePrzeniesione, zadanieInnegoDnia, zadanieWZakresie],
          error: null,
        }).then(ok, blad);
      }
      return oryginalnyThen(ok, blad);
    };
    const wynik = await loadCalendar(
      klient({
        blocks: fakeTable({ data: [seria] }),
        block_exceptions: fakeTable({ data: [wyjatek] }),
        tasks: zadania,
        categories: fakeTable({ data: [] }),
      }),
      "u1",
      LISTOPAD,
      profil,
    );
    expect(zadania.in).toHaveBeenCalledWith("block_id", ["seria"]);
    expect(zadania.in).toHaveBeenCalledWith("occurrence_date", ["2026-10-27"]);
    expect(wynik.tasks.map((t) => t.id)).toEqual(["t2", "t1"]);
  });

  describe("sport (podgląd w kalendarzu głównym)", () => {
    const sesja = (o: Record<string, unknown>) => ({
      id: "s1",
      user_id: "u1",
      type: "run",
      title: "Spokojny",
      start_local: "2026-11-10T07:00:00",
      end_local: null,
      completed: true,
      show_in_calendar: true,
      template_id: null,
      template_date: null,
      note: null,
      difficulty: null,
      created_at: null,
      ...o,
    });
    const szablon = {
      id: "t1",
      user_id: "u1",
      name: "Push",
      weekdays: [4], // czwartki
      start_time: "18:30:00",
      last_used_at: null,
      created_at: null,
    };

    it("sesje z zakresu (z danymi biegu) i wystąpienia szablonów od dziś; bez ukrytych w kalendarzu", async () => {
      const sesje = fakeTable({
        data: [
          sesja({}),
          sesja({ id: "s2", show_in_calendar: false }),
          // Sesja z szablonu na czwartek 19.11 zastępuje jego wystąpienie
          sesja({
            id: "s3",
            type: "gym",
            title: "Push",
            start_local: "2026-11-19T18:30:00",
            completed: false,
            template_id: "t1",
            template_date: "2026-11-19",
          }),
        ],
      });
      const biegi = fakeTable({
        data: [
          {
            session_id: "s1",
            user_id: "u1",
            kind: "easy",
            distance_km: 10,
            duration_s: 3480,
            difficulty: null,
            kcal: null,
            weight_kg_snapshot: null,
          },
        ],
      });
      const wynik = await loadCalendar(
        klient({
          sport_sessions: sesje,
          runs: biegi,
          workout_templates: fakeTable({ data: [szablon] }),
          template_skips: fakeTable({
            data: [{ template_id: "t1", date: "2026-11-26", user_id: "u1" }],
          }),
        }),
        "u1",
        LISTOPAD,
        profil,
        "2026-11-18",
      );
      // 12.11 jest przed dziś, 19.11 ma sesję, 26.11 jest pominięty
      expect(wynik.sport.map((i) => i.key)).toEqual(["s:s1", "s:s3"]);
      expect(wynik.sport[0]).toMatchObject({
        planned: false,
        distanceKm: 10,
        durationMin: 58,
      });
      expect(wynik.sport[1]).toMatchObject({ planned: true, kind: "gym" });
      expect(sesje.or).toHaveBeenCalledWith(
        "and(start_local.gte.2026-11-01T00:00:00,start_local.lt.2026-12-01T00:00:00),and(template_date.gte.2026-11-01,template_date.lte.2026-11-30)",
      );
      expect(biegi.in).toHaveBeenCalledWith("session_id", ["s1"]);
    });

    it("wystąpienie szablonu w przyszłym czwartku jest planem z godziną szablonu", async () => {
      const wynik = await loadCalendar(
        klient({
          workout_templates: fakeTable({ data: [szablon] }),
        }),
        "u1",
        { from: "2026-11-16", to: "2026-11-22" },
        profil,
        "2026-11-18",
      );
      expect(wynik.sport).toEqual([
        expect.objectContaining({
          key: "t:t1:2026-11-19",
          date: "2026-11-19",
          startMin: 18 * 60 + 30,
          planned: true,
        }),
      ]);
    });

    it("sesja przeniesiona z zakresu (start poza nim) tylko blokuje wystąpienie", async () => {
      const wynik = await loadCalendar(
        klient({
          sport_sessions: fakeTable({
            data: [
              sesja({
                id: "s4",
                type: "gym",
                start_local: "2026-11-24T10:00:00",
                template_id: "t1",
                template_date: "2026-11-19",
              }),
            ],
          }),
          workout_templates: fakeTable({ data: [szablon] }),
        }),
        "u1",
        { from: "2026-11-16", to: "2026-11-22" },
        profil,
        "2026-11-18",
      );
      expect(wynik.sport).toEqual([]);
    });
  });
});
