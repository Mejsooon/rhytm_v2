import { describe, expect, it } from "vitest";

import type { Database } from "@/types/database";
import { loadDraft } from "./load-draft";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

const pusty: ProfileRow = {
  avatar_path: null,
  first_steps: {},
  first_steps_hidden: false,
  sleep_bedtime: "23:00:00",
  vault_lock_min: 5,
  vault_clear_clipboard: true,
  vault_ask_on_reveal: false,
  calendar_block_min: 60,
  calendar_from_hour: 7,
  calendar_show_renewals: true,
  calendar_show_sport: true,
  calendar_to_hour: 23,
  calendar_view: "week",
  calendar_week_numbers: true,
  clock: null,
  created_at: null,
  currency: null,
  deletion_requested_at: null,
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
    expect(loadDraft(pusty, null)).toEqual({
      name: "",
      avatarPath: null,
      timezone: "Europe/Warsaw",
      weekStart: "mon",
      clock: "24",
      uses: [],
      weeklyWorkouts: 3,
      weeklyKm: 25,
      sleepGoalMin: 480,
      blocks: [],
      source: null,
      notify: { perm: false, before: true, renew: true, habits: false },
    });
  });

  it("zapisane wartości; klucze i źródła ze starego kreatora odpadają", () => {
    const blok = { title: "A", start: "08:00", end: "09:00", category: "Dom" as const, saved: true };
    const draft = loadDraft(
      {
        ...pusty,
        display_name: "Ala",
        roles: ["student", "run", "sport"],
        weekly_km_goal: 40,
        referral_source: "reddit",
        week_start: "sun",
        clock: "12",
      },
      { push_enabled: true, before_block_min: null, renewals_enabled: false, habits_enabled: true } as never,
      [blok],
    );
    expect(draft).toMatchObject({
      name: "Ala",
      uses: ["run"],
      weeklyKm: 40,
      source: null,
      weekStart: "sun",
      clock: "12",
      blocks: [blok],
      notify: { perm: true, before: false, renew: false, habits: true },
    });
  });
});
