import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database";
import { loadDraft } from "./load-draft";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const pusty: ProfileRow = {
  avatar_path: null,
  clock: null,
  created_at: null,
  currency: null,
  display_name: null,
  goals: null,
  height_cm: null,
  onboarded_at: null,
  onboarding_step: 1,
  pending_pages: null,
  referral_other: null,
  referral_source: null,
  roles: null,
  sleep_goal_min: null,
  study_field: null,
  timezone: null,
  user_id: "u1",
  week_start: null,
  workouts_goal_on: true,
  km_goal_on: true,
  weekly_km_goal: null,
  weekly_workouts_goal: null,
  weight_kg: null,
};

describe("loadDraft", () => {
  it("profil z nullami → domyślne z makiety", () => {
    const draft = loadDraft(pusty, null);
    expect(draft).toEqual({
      name: "",
      avatarPath: null,
      timezone: "Europe/Warsaw",
      weekStart: "mon",
      clock: "24",
      roles: [],
      studyField: "",
      goals: ["plan", "sport", "habits"],
      workoutsOn: true,
      kmOn: true,
      weeklyWorkouts: 3,
      weeklyKm: 25,
      sleepGoalMin: 480,
      source: null,
      sourceOther: "",
      pages: null,
      notify: {
        perm: false,
        before: true,
        renew: true,
        weekly: true,
        habits: false,
      },
    });
  });

  it("przełączniki celów i obie liczby z profilu", () => {
    const km = loadDraft(
      {
        ...pusty,
        workouts_goal_on: false,
        km_goal_on: true,
        weekly_km_goal: 40,
        weekly_workouts_goal: 5,
      },
      null,
    );
    expect(km).toMatchObject({
      workoutsOn: false,
      kmOn: true,
      weeklyKm: 40,
      weeklyWorkouts: 5,
    });
    const oba = loadDraft({ ...pusty, weekly_workouts_goal: 4 }, null);
    expect(oba).toMatchObject({
      workoutsOn: true,
      kmOn: true,
      weeklyWorkouts: 4,
      weeklyKm: 25,
    });
  });

  it("brak strefy w profilu → wykryta strefa", () => {
    expect(loadDraft(pusty, null, "Asia/Kolkata").timezone).toBe(
      "Asia/Kolkata",
    );
  });

  it("strefa z profilu ma pierwszeństwo przed wykrytą", () => {
    expect(
      loadDraft({ ...pusty, timezone: "Europe/Berlin" }, null, "Asia/Kolkata")
        .timezone,
    ).toBe("Europe/Berlin");
  });

  it("pending_pages: [] zostaje [] (nie null)", () => {
    expect(loadDraft({ ...pusty, pending_pages: [] }, null).pages).toEqual([]);
  });

  it("zapisane wartości profilu i ustawień powiadomień", () => {
    const draft = loadDraft(
      {
        ...pusty,
        display_name: "Ala",
        roles: ["student"],
        goals: ["books", "plan"],
        weekly_km_goal: 40,
        sleep_goal_min: 450,
        referral_source: "other",
        referral_other: "blog",
        week_start: "sun",
        clock: "12",
        pending_pages: ["Books"],
      },
      {
        user_id: "u1",
        push_enabled: true,
        before_block_min: null,
        renewals_enabled: false,
        weekly_summary: true,
        habits_enabled: true,
      } as never,
    );
    expect(draft).toMatchObject({
      name: "Ala",
      roles: ["student"],
      // Cele bazowe zawsze z przodu, bez duplikatów
      goals: ["plan", "sport", "habits", "books"],
      weeklyKm: 40,
      sleepGoalMin: 450,
      source: "other",
      sourceOther: "blog",
      weekStart: "sun",
      clock: "12",
      pages: ["Books"],
      notify: {
        perm: true,
        before: false,
        renew: false,
        weekly: true,
        habits: true,
      },
    });
  });
});
