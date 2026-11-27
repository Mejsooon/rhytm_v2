import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeTable } from "@/test-utils/fake-supabase";
import { saveActivity } from "./activity-actions";

let tables: Record<string, ReturnType<typeof fakeTable>>;
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    from: (nazwa: string) => tables[nazwa],
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const wejscie = {
  kind: "tenis",
  color: "#65a30d",
  hasDistance: false,
  done: true,
  date: "2026-11-17",
  start: "16:00",
  durationS: 4500,
  distanceKm: 3,
  difficulty: 6,
  note: " ",
  showInCalendar: true,
};

describe("saveActivity", () => {
  beforeEach(() => {
    tables = {
      profiles: fakeTable({ single: { weight_kg: 72 } }),
      activity_kinds: fakeTable({ data: [] }),
      sport_sessions: fakeTable({ single: { id: "s1" } }),
      activities: fakeTable(),
    };
  });

  it("zapisuje sesję i dane: nazwa z rodzaju, kcal z wagi, bez dystansu dla rodzaju bez dystansu", async () => {
    expect(await saveActivity(wejscie)).toEqual({ ok: true });
    expect(tables.sport_sessions.insert).toHaveBeenCalledWith(
      expect.objectContaining({ type: "other", title: "Tenis", completed: true, note: null }),
    );
    expect(tables.activities.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ session_id: "s1", kind: "Tenis", kcal: 657, distance_km: null }),
      { onConflict: "session_id" },
    );
    expect(tables.activity_kinds.insert).not.toHaveBeenCalled();
  });

  it("gdy zapis danych padnie, nowa sesja znika", async () => {
    tables.activities = fakeTable({ error: { message: "x" } });
    expect((await saveActivity(wejscie)).ok).toBe(false);
    expect(tables.sport_sessions.delete).toHaveBeenCalled();
  });

  it("wykonana bez czasu jest odrzucana", async () => {
    expect(await saveActivity({ ...wejscie, durationS: null })).toEqual({ ok: false, message: "Podaj czas trwania." });
  });
});
