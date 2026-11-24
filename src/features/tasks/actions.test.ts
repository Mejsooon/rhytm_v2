import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";

const { getUser, from, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  addTask,
  deleteTask,
  renameTask,
  toggleTask,
} from "./actions";

const BLAD = "Nie udało się zapisać. Spróbuj ponownie.";

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
    tasks: fakeTable({
      data: [{ id: "f1000000-0000-4000-8000-000000000001" }],
      single: {
        id: "f1000000-0000-4000-8000-000000000001",
        title: "A",
        block_id: "b1000000-0000-4000-8000-000000000001",
        occurrence_date: "2026-11-10",
      },
    }),
    blocks: fakeTable({ single: blok }),
    block_exceptions: fakeTable({ data: [] }),
  };
  from.mockImplementation((nazwa: string) => tables[nazwa]);
});

describe("akcje zadań", () => {
  it("bez sesji → redirect na /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(
      toggleTask({ id: "f1000000-0000-4000-8000-000000000001", done: true }),
    ).rejects.toThrow("REDIRECT:/logowanie");
  });

  it("toggleTask(done: true) ustawia done_at, false zeruje", async () => {
    await toggleTask({
      id: "f1000000-0000-4000-8000-000000000001",
      done: true,
    });
    expect(tables.tasks.update).toHaveBeenLastCalledWith({
      done: true,
      done_at: expect.any(String),
    });
    await toggleTask({
      id: "f1000000-0000-4000-8000-000000000001",
      done: false,
    });
    expect(tables.tasks.update).toHaveBeenLastCalledWith({
      done: false,
      done_at: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/kalendarz");
  });

  it("addTask przypina do wystąpienia (occurrence_date = oryginalna data)", async () => {
    const w = await addTask({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-10",
      title: " Kupić mleko ",
    });
    expect(w.ok).toBe(true);
    expect(tables.tasks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        title: "Kupić mleko",
        block_id: "b1000000-0000-4000-8000-000000000001",
        occurrence_date: "2026-11-10",
        due_date: "2026-11-10",
      }),
    );
  });

  it("addTask z pustym tytułem → ok: false, bez insert", async () => {
    const w = await addTask({
      blockId: "b1000000-0000-4000-8000-000000000001",
      date: "2026-11-10",
      title: "  ",
    });
    expect(w.ok).toBe(false);
    expect(tables.tasks.insert).not.toHaveBeenCalled();
  });

  it("renameTask przycina tytuł, odrzuca pusty", async () => {
    await renameTask({
      id: "f1000000-0000-4000-8000-000000000001",
      title: " Nowy ",
    });
    expect(tables.tasks.update).toHaveBeenCalledWith({ title: "Nowy" });
    tables.tasks.update.mockClear();
    expect(
      (
        await renameTask({
          id: "f1000000-0000-4000-8000-000000000001",
          title: "",
        })
      ).ok,
    ).toBe(false);
    expect(tables.tasks.update).not.toHaveBeenCalled();
  });

  it("deleteTask usuwa po id", async () => {
    expect(
      await deleteTask({ id: "f1000000-0000-4000-8000-000000000001" }),
    ).toEqual({ ok: true });
    expect(tables.tasks.delete).toHaveBeenCalled();
    expect(tables.tasks.eq).toHaveBeenCalledWith(
      "id",
      "f1000000-0000-4000-8000-000000000001",
    );
  });

  it("brak dopasowanego wiersza (RLS / zły id) → ok: false", async () => {
    tables.tasks = fakeTable({ data: [], single: null });
    expect(
      (
        await toggleTask({
          id: "f1000000-0000-4000-8000-000000000001",
          done: true,
        })
      ).ok,
    ).toBe(false);
    expect(
      (
        await renameTask({
          id: "f1000000-0000-4000-8000-000000000001",
          title: "Nowy",
        })
      ).ok,
    ).toBe(false);
    expect(
      (await deleteTask({ id: "f1000000-0000-4000-8000-000000000001" })).ok,
    ).toBe(false);
  });

  it("zły identyfikator → ok: false, bez zapisu", async () => {
    expect((await toggleTask({ id: "t1", done: true })).ok).toBe(false);
    expect(tables.tasks.update).not.toHaveBeenCalled();
  });

  it("błąd bazy → komunikat", async () => {
    tables.tasks = fakeTable({ error: { message: "boom" } });
    expect(
      await toggleTask({
        id: "f1000000-0000-4000-8000-000000000001",
        done: true,
      }),
    ).toEqual({ ok: false, message: BLAD });
  });
});
