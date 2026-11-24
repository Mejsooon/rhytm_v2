import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";

const { getUser, from, rpc, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import { changeOccurrence, createBlock } from "./actions";
import { expandOccurrences } from "./occurrences";

const BLAD = "Nie udało się zapisać. Spróbuj ponownie.";

const wejscie = {
  title: "Nauka",
  categoryId: null,
  date: "2026-11-17", // wtorek
  startMin: 480,
  durationMin: 60,
  recurrence: null,
  note: "",
  remind: true,
};

// Cykliczny blok dzienny od 1 listopada
const blok = {
  id: "b1000000-0000-4000-8000-000000000001",
  user_id: "u1",
  title: "Nauka",
  category_id: null,
  note: null,
  start_local: "2026-11-01T08:00:00",
  duration_min: 60,
  timezone: "Europe/Warsaw",
  recurrence: { freq: "daily" },
  remind: true,
  created_at: null,
  updated_at: null,
};

let tables: Record<string, ReturnType<typeof fakeTable>>;

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  tables = {
    profiles: fakeTable({ single: { timezone: "Europe/Warsaw" } }),
    categories: fakeTable({
      data: [],
      single: { id: "c1000000-0000-4000-8000-000000000001", is_system: false },
    }),
    blocks: fakeTable({
      data: [{ id: "b1000000-0000-4000-8000-000000000001" }],
      single: { id: "b1000000-0000-4000-8000-000000000001" },
    }),
    tasks: fakeTable(),
    block_exceptions: fakeTable({ data: [] }),
  };
  from.mockImplementation((nazwa: string) => tables[nazwa]);
  rpc.mockResolvedValue({ data: "nowy", error: null });
});

describe("createBlock", () => {
  it("bez sesji przekierowuje na /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(createBlock(wejscie)).rejects.toThrow("REDIRECT:/logowanie");
  });

  it("until przed datą startu → ok: false, bez insert", async () => {
    const w = await createBlock({
      ...wejscie,
      recurrence: { freq: "daily", until: "2026-11-16" },
    });
    expect(w).toEqual({
      ok: false,
      message: "Koniec powtarzania nie może być przed początkiem.",
    });
    expect(tables.blocks.insert).not.toHaveBeenCalled();
  });

  it("pusty tytuł i za krótki czas → ok: false, bez insert", async () => {
    expect((await createBlock({ ...wejscie, title: "  " })).ok).toBe(false);
    expect((await createBlock({ ...wejscie, durationMin: 10 })).ok).toBe(false);
    expect(tables.blocks.insert).not.toHaveBeenCalled();
  });

  it("kategoria systemowa → ok: false, bez insert", async () => {
    tables.categories = fakeTable({
      single: { id: "c1000000-0000-4000-8000-000000000001", is_system: true },
    });
    const w = await createBlock({
      ...wejscie,
      categoryId: "c1000000-0000-4000-8000-000000000001",
    });
    expect(w.ok).toBe(false);
    expect(tables.blocks.insert).not.toHaveBeenCalled();
  });

  it("poprawny blok → insert ze strefą z profilu, revalidate", async () => {
    tables.profiles = fakeTable({ single: { timezone: "Europe/Berlin" } });
    const w = await createBlock(wejscie);
    expect(w).toEqual({ ok: true, id: "b1000000-0000-4000-8000-000000000001" });
    expect(tables.blocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        title: "Nauka",
        start_local: "2026-11-17T08:00:00",
        duration_min: 60,
        timezone: "Europe/Berlin",
        recurrence: null,
        note: null,
        remind: true,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/kalendarz");
  });

  it("błąd zapisu → komunikat", async () => {
    tables.blocks = fakeTable({ error: { message: "boom" } });
    expect(await createBlock(wejscie)).toEqual({ ok: false, message: BLAD });
  });

  it("weekdays zaczęte w sobotę startuje w najbliższy poniedziałek", async () => {
    await createBlock({
      ...wejscie,
      date: "2026-11-21", // sobota
      recurrence: { freq: "weekdays" },
      tasks: ["A"],
    });
    expect(tables.blocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ start_local: "2026-11-23T08:00:00" }),
    );
    // zadanie ląduje w pierwszym prawdziwym wystąpieniu
    expect(tables.tasks.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        occurrence_date: "2026-11-23",
        due_date: "2026-11-23",
      }),
    ]);
  });

  it("tasks: ['A','B'] wstawia 2 zadania z occurrence_date = date", async () => {
    await createBlock({ ...wejscie, tasks: ["A", "B"] });
    expect(tables.tasks.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        user_id: "u1",
        title: "A",
        block_id: "b1000000-0000-4000-8000-000000000001",
        occurrence_date: "2026-11-17",
      }),
      expect.objectContaining({
        user_id: "u1",
        title: "B",
        block_id: "b1000000-0000-4000-8000-000000000001",
        occurrence_date: "2026-11-17",
      }),
    ]);
  });
});

describe("changeOccurrence", () => {
  beforeEach(() => {
    tables.blocks = fakeTable({ data: [{ id: blok.id }], single: blok });
  });

  it("bez sesji przekierowuje na /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(
      changeOccurrence({
        blockId: "b1000000-0000-4000-8000-000000000001",
        date: "2026-11-10",
        scope: "this",
        delete: true,
      }),
    ).rejects.toThrow("REDIRECT:/logowanie");
  });

  it("this + zmiana tytułu → upsert wyjątku", async () => {
    const w = await changeOccurrence({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-10",
      scope: "this",
      patch: { title: "Inny" },
    });
    expect(w.ok).toBe(true);
    expect(tables.block_exceptions.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        block_id: "b1000000-0000-4000-8000-000000000001",
        occurrence_date: "2026-11-10",
        kind: "modified",
        new_title: "Inny",
      }),
      expect.anything(),
    );
  });

  it("following w środku serii → rpc split_block_series", async () => {
    const w = await changeOccurrence({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-10",
      scope: "following",
      patch: { title: "Inny" },
    });
    expect(w.ok).toBe(true);
    expect(rpc).toHaveBeenCalledWith("split_block_series", {
      p_block_id: "b1000000-0000-4000-8000-000000000001",
      p_from: "2026-11-10",
      p_patch: { title: "Inny" },
      p_delete: false,
    });
  });

  it("this + delete → zadania usunięte, potem wyjątek cancelled", async () => {
    const w = await changeOccurrence({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-10",
      scope: "this",
      delete: true,
    });
    expect(w.ok).toBe(true);
    expect(tables.tasks.delete).toHaveBeenCalled();
    expect(tables.tasks.eq).toHaveBeenCalledWith(
      "occurrence_date",
      "2026-11-10",
    );
    expect(tables.tasks.update).not.toHaveBeenCalled();
    expect(tables.block_exceptions.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        block_id: "b1000000-0000-4000-8000-000000000001",
        occurrence_date: "2026-11-10",
        kind: "cancelled",
      }),
      expect.anything(),
    );
  });

  it("all + delete → zwykłe usunięcie bloku", async () => {
    await changeOccurrence({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-10",
      scope: "all",
      delete: true,
    });
    expect(tables.blocks.delete).toHaveBeenCalled();
  });

  it("all z nową powtarzalnością weekdays normalizuje datę startu", async () => {
    // blok zaczyna się w sobotę 2026-11-21
    tables.blocks = fakeTable({
      data: [{ id: blok.id }],
      single: { ...blok, start_local: "2026-11-21T08:00:00" },
    });
    await changeOccurrence({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-21",
      scope: "all",
      patch: { recurrence: { freq: "weekdays" } },
    });
    expect(tables.blocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        recurrence: { freq: "weekdays" },
        start_local: "2026-11-23T08:00:00",
      }),
    );
  });

  it("wynik przechodzący przez północ → ok: false, bez zapisu", async () => {
    const w = await changeOccurrence({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-10",
      scope: "this",
      patch: { startMin: 1400, durationMin: 60 },
    });
    expect(w.ok).toBe(false);
    expect(tables.block_exceptions.upsert).not.toHaveBeenCalled();
  });

  it("following z nowym weekdays od soboty → odrzucone, bez rpc", async () => {
    // 2026-11-14 to sobota
    const w = await changeOccurrence({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-14",
      scope: "following",
      patch: { recurrence: { freq: "weekdays" } },
    });
    expect(w).toEqual({
      ok: false,
      message: "Nowe powtarzanie musi obejmować ten dzień.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("all ze zmianą powtarzalności usuwa zadania spoza nowej serii", async () => {
    tables.tasks = fakeTable({
      data: [
        {
          id: "f1000000-0000-4000-8000-000000000001",
          occurrence_date: "2026-11-10",
        }, // wtorek
        {
          id: "f2000000-0000-4000-8000-000000000002",
          occurrence_date: "2026-11-14",
        }, // sobota
      ],
    });
    await changeOccurrence({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-10",
      scope: "all",
      patch: { recurrence: { freq: "weekdays" } },
    });
    expect(tables.tasks.delete).toHaveBeenCalled();
    expect(tables.tasks.update).not.toHaveBeenCalled();
    expect(tables.tasks.in).toHaveBeenCalledWith("id", [
      "f2000000-0000-4000-8000-000000000002",
    ]);
  });

  it("blok jednorazowy przesunięty na inny dzień → zadania idą z nim, delete niewołane", async () => {
    tables.blocks = fakeTable({
      data: [{ id: blok.id }],
      single: { ...blok, recurrence: null, start_local: "2026-11-10T08:00:00" },
    });
    tables.tasks = fakeTable({
      data: [
        {
          id: "f1000000-0000-4000-8000-000000000001",
          occurrence_date: "2026-11-10",
        },
      ],
    });
    const w = await changeOccurrence({
      blockId: blok.id,
      date: "2026-11-10",
      scope: "all",
      patch: { date: "2026-11-12" },
    });
    expect(w.ok).toBe(true);
    expect(tables.tasks.update).toHaveBeenCalledWith({
      occurrence_date: "2026-11-12",
      due_date: "2026-11-12",
    });
    expect(tables.tasks.eq).toHaveBeenCalledWith("block_id", blok.id);
    expect(tables.tasks.delete).not.toHaveBeenCalled();
  });

  it("zmiana bloku, której nikt nie widzi (0 wierszy) → ok: false", async () => {
    tables.blocks = fakeTable({ data: [], single: blok });
    const w = await changeOccurrence({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-10",
      scope: "all",
      patch: { title: "X" },
    });
    expect(w.ok).toBe(false);
  });

  it("niemożliwa data i zły id → ok: false", async () => {
    expect(
      (
        await changeOccurrence({
          blockId: "b1000000-0000-4000-8000-000000000001",
          date: "2026-13-45",
          scope: "this",
          delete: true,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await changeOccurrence({
          blockId: "b1",
          date: "2026-11-10",
          scope: "this",
          delete: true,
        })
      ).ok,
    ).toBe(false);
  });

  it("nieistniejący blok → ok: false", async () => {
    tables.blocks = fakeTable({ data: null, single: null });
    const w = await changeOccurrence({
      blockId: "e0000000-0000-4000-8000-000000000000",
      date: "2026-11-10",
      scope: "this",
      delete: true,
    });
    expect(w.ok).toBe(false);
  });

  it("błąd rpc → komunikat", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    const w = await changeOccurrence({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-10",
      scope: "following",
      delete: true,
    });
    expect(w).toEqual({ ok: false, message: BLAD });
  });
  it("all ze zmianą dnia w serii codziennej → błąd, bez zapisu", async () => {
    const w = await changeOccurrence({
      blockId: blok.id,
      date: "2026-11-10",
      scope: "all",
      patch: { date: "2026-11-11" },
    });
    expect(w).toEqual({
      ok: false,
      message:
        "Zmiana dnia działa dla tego wystąpienia albo dla całej serii tygodniowej.",
    });
    expect(tables.blocks.update).not.toHaveBeenCalled();
  });

  it("all ze zmianą dnia w serii własnej obraca dni tygodnia", async () => {
    // pn + śr od pn 2026-11-02; śr 11.11 → czw 12.11 (+1)
    tables.blocks = fakeTable({
      data: [{ id: blok.id }],
      single: {
        ...blok,
        start_local: "2026-11-02T08:00:00",
        recurrence: { freq: "custom", byWeekday: [1, 3] },
      },
    });
    const w = await changeOccurrence({
      blockId: blok.id,
      date: "2026-11-11",
      scope: "all",
      patch: { date: "2026-11-12" },
    });
    expect(w.ok).toBe(true);
    expect(tables.blocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        start_local: "2026-11-03T08:00:00",
        recurrence: { freq: "custom", byWeekday: [2, 4] },
      }),
    );
  });

  it("all ze zmianą dnia w serii tygodniowej przesuwa start, powtarzanie bez zmian", async () => {
    tables.blocks = fakeTable({
      data: [{ id: blok.id }],
      single: {
        ...blok,
        start_local: "2026-11-03T08:00:00",
        recurrence: { freq: "weekly" },
      },
    });
    await changeOccurrence({
      blockId: blok.id,
      date: "2026-11-10",
      scope: "all",
      patch: { date: "2026-11-12" },
    });
    const zmiany = tables.blocks.update.mock.calls[0][0];
    expect(zmiany.start_local).toBe("2026-11-05T08:00:00");
    expect(zmiany.recurrence).toBeUndefined();
  });

  it("przesunięcie serii kasuje wyjątki z dni spoza nowego wzorca", async () => {
    tables.blocks = fakeTable({
      data: [{ id: blok.id }],
      single: {
        ...blok,
        start_local: "2026-11-03T08:00:00",
        recurrence: { freq: "weekly" },
      },
    });
    // Wyjątki wtorkowe (stary dzień); po przesunięciu na czwartki żaden nie pasuje
    tables.block_exceptions = fakeTable({
      data: [
        { block_id: blok.id, occurrence_date: "2026-11-17", kind: "cancelled" },
        { block_id: blok.id, occurrence_date: "2026-11-24", kind: "modified" },
      ],
    });
    await changeOccurrence({
      blockId: blok.id,
      date: "2026-11-10",
      scope: "all",
      patch: { date: "2026-11-12" },
    });
    expect(tables.block_exceptions.delete).toHaveBeenCalled();
    expect(tables.block_exceptions.in).toHaveBeenCalledWith("occurrence_date", [
      "2026-11-17",
      "2026-11-24",
    ]);
  });

  it("this z innym dniem przenosi termin zadań wystąpienia na nowy dzień", async () => {
    const w = await changeOccurrence({
      blockId: blok.id,
      date: "2026-11-10",
      scope: "this",
      patch: { date: "2026-11-16" },
    });
    expect(w.ok).toBe(true);
    expect(tables.tasks.update).toHaveBeenCalledWith({
      due_date: "2026-11-16",
    });
    expect(tables.tasks.eq).toHaveBeenCalledWith("block_id", blok.id);
    expect(tables.tasks.eq).toHaveBeenCalledWith(
      "occurrence_date",
      "2026-11-10",
    );
  });

  it("following z until przed dniem podziału → błąd, bez rpc", async () => {
    const w = await changeOccurrence({
      blockId: blok.id,
      date: "2026-11-10",
      scope: "following",
      patch: { recurrence: { freq: "daily", until: "2026-11-09" } },
    });
    expect(w).toEqual({
      ok: false,
      message: "Koniec powtarzania nie może być przed początkiem.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("all z until przed startem serii → błąd, bez zapisu", async () => {
    const w = await changeOccurrence({
      blockId: blok.id,
      date: "2026-11-10",
      scope: "all",
      patch: { recurrence: { freq: "daily", until: "2026-10-31" } },
    });
    expect(w).toEqual({
      ok: false,
      message: "Koniec powtarzania nie może być przed początkiem.",
    });
    expect(tables.blocks.update).not.toHaveBeenCalled();
  });

  it("following ze zmianą dnia na środkowym wystąpieniu → błąd, bez rpc", async () => {
    const w = await changeOccurrence({
      blockId: blok.id,
      date: "2026-11-10",
      scope: "following",
      patch: { date: "2026-11-11" },
    });
    expect(w.ok).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });
  it("all zamieniające serię w blok jednorazowy kasuje wszystkie wyjątki (blok zostaje widoczny)", async () => {
    // Seria wtorkowa od 3.11; odwołane 24.11. Z 17.11: „Nie”, dzień 24.11, „Wszystkie”.
    const seria = {
      ...blok,
      start_local: "2026-11-03T08:00:00",
      recurrence: { freq: "weekly" },
    };
    tables.blocks = fakeTable({ data: [{ id: blok.id }], single: seria });
    const odwolanie = {
      block_id: blok.id,
      user_id: "u1",
      occurrence_date: "2026-11-24",
      kind: "cancelled",
      new_start_local: null,
      new_duration_min: null,
      new_title: null,
    };
    tables.block_exceptions = fakeTable({ data: [odwolanie] });
    const w = await changeOccurrence({
      blockId: blok.id,
      date: "2026-11-17",
      scope: "all",
      patch: { date: "2026-11-24", recurrence: null },
    });
    expect(w.ok).toBe(true);
    const zmiany = tables.blocks.update.mock.calls[0][0];
    expect(zmiany).toEqual(
      expect.objectContaining({
        recurrence: null,
        start_local: "2026-11-24T08:00:00",
      }),
    );
    // Wszystkie wyjątki bloku: delete po block_id, bez zawężania do dat
    expect(tables.block_exceptions.delete).toHaveBeenCalled();
    expect(tables.block_exceptions.eq).toHaveBeenCalledWith(
      "block_id",
      blok.id,
    );
    expect(tables.block_exceptions.in).not.toHaveBeenCalled();
    // Bez wyjątków blok jednorazowy jest widoczny 24.11 (ze starym odwołaniem byłby ukryty)
    const poZapisie = { ...seria, ...zmiany };
    expect(
      expandOccurrences([poZapisie], [], "2026-11-24", "2026-11-24"),
    ).toHaveLength(1);
    expect(
      expandOccurrences([poZapisie], [odwolanie], "2026-11-24", "2026-11-24"),
    ).toHaveLength(0);
  });
});
