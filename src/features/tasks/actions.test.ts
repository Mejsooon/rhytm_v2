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
  createStandaloneTask,
  deleteTask,
  pinTaskToOccurrence,
  renameTask,
  toggleTask,
  unpinTask,
} from "./actions";

const BLAD = "Nie udało się zapisać. Spróbuj ponownie.";

const blok = {
  id: "b1",
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
    tasks: fakeTable({ data: { id: "t1", title: "A", block_id: "b1", occurrence_date: "2026-11-10" } }),
    blocks: fakeTable({ data: blok }),
    block_exceptions: fakeTable({ data: [] }),
  };
  from.mockImplementation((nazwa: string) => tables[nazwa]);
});

describe("akcje zadań", () => {
  it("bez sesji → redirect na /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(toggleTask({ id: "t1", done: true })).rejects.toThrow("REDIRECT:/logowanie");
  });

  it("toggleTask(done: true) ustawia done_at, false zeruje", async () => {
    await toggleTask({ id: "t1", done: true });
    expect(tables.tasks.update).toHaveBeenLastCalledWith({
      done: true,
      done_at: expect.any(String),
    });
    await toggleTask({ id: "t1", done: false });
    expect(tables.tasks.update).toHaveBeenLastCalledWith({ done: false, done_at: null });
    expect(revalidatePath).toHaveBeenCalledWith("/kalendarz");
  });

  it("addTask przypina do wystąpienia (occurrence_date = oryginalna data)", async () => {
    const w = await addTask({ blockId: "b1", date: "2026-11-10", title: " Kupić mleko " });
    expect(w.ok).toBe(true);
    expect(tables.tasks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        title: "Kupić mleko",
        block_id: "b1",
        occurrence_date: "2026-11-10",
        due_date: "2026-11-10",
      }),
    );
  });

  it("addTask z pustym tytułem → ok: false, bez insert", async () => {
    const w = await addTask({ blockId: "b1", date: "2026-11-10", title: "  " });
    expect(w.ok).toBe(false);
    expect(tables.tasks.insert).not.toHaveBeenCalled();
  });

  it("renameTask przycina tytuł, odrzuca pusty", async () => {
    await renameTask({ id: "t1", title: " Nowy " });
    expect(tables.tasks.update).toHaveBeenCalledWith({ title: "Nowy" });
    tables.tasks.update.mockClear();
    expect((await renameTask({ id: "t1", title: "" })).ok).toBe(false);
    expect(tables.tasks.update).not.toHaveBeenCalled();
  });

  it("deleteTask usuwa po id", async () => {
    expect(await deleteTask({ id: "t1" })).toEqual({ ok: true });
    expect(tables.tasks.delete).toHaveBeenCalled();
    expect(tables.tasks.eq).toHaveBeenCalledWith("id", "t1");
  });

  it("createStandaloneTask zapisuje termin albo null", async () => {
    await createStandaloneTask({ title: "Zakupy", dueDate: "2026-11-20" });
    expect(tables.tasks.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", title: "Zakupy", due_date: "2026-11-20", block_id: null }),
    );
    await createStandaloneTask({ title: "Zakupy", dueDate: null });
    expect(tables.tasks.insert).toHaveBeenLastCalledWith(expect.objectContaining({ due_date: null }));
  });

  it("pinTaskToOccurrence zapisuje block_id, occurrence_date i due_date", async () => {
    const w = await pinTaskToOccurrence({ taskId: "t1", blockId: "b1", date: "2026-11-10" });
    expect(w.ok).toBe(true);
    expect(tables.tasks.update).toHaveBeenCalledWith({
      block_id: "b1",
      occurrence_date: "2026-11-10",
      due_date: "2026-11-10",
    });
  });

  it("pinTaskToOccurrence do nieistniejącego bloku → ok: false", async () => {
    tables.blocks = fakeTable({ data: null });
    expect((await pinTaskToOccurrence({ taskId: "t1", blockId: "x", date: "2026-11-10" })).ok).toBe(false);
  });

  it("unpinTask zeruje block_id i occurrence_date, termin zostaje", async () => {
    await unpinTask({ taskId: "t1" });
    expect(tables.tasks.update).toHaveBeenCalledWith({ block_id: null, occurrence_date: null });
  });

  it("błąd bazy → komunikat", async () => {
    tables.tasks = fakeTable({ error: { message: "boom" } });
    expect(await toggleTask({ id: "t1", done: true })).toEqual({ ok: false, message: BLAD });
  });
});
