import { safeTimezone } from "@/lib/time/timezones";
import type { Database } from "@/types/database";
import {
  LOCKED_GOALS,
  type GoalKey,
  type OnboardingDraft,
  type PageKey,
  type RoleKey,
  type SourceKey,
} from "./model";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type NotificationSettingsRow =
  Database["public"]["Tables"]["notification_settings"]["Row"];

// Składa szkic kreatora z zapisanego profilu; puste pola dostają wartości domyślne z makiety.
// detectedTz = strefa wykryta w przeglądarce (używana tylko, gdy profil nie ma jeszcze strefy).
export function loadDraft(
  profile: ProfileRow,
  notify: NotificationSettingsRow | null,
  detectedTz?: string,
): OnboardingDraft {
  return {
    name: profile.display_name ?? "",
    avatarPath: profile.avatar_path,
    timezone: safeTimezone(profile.timezone ?? detectedTz ?? ""),
    weekStart: profile.week_start === "sun" ? "sun" : "mon",
    clock: profile.clock === "12" ? "12" : "24",
    roles: (profile.roles ?? []) as RoleKey[],
    studyField: profile.study_field ?? "",
    // Cele bazowe zawsze na początku, potem zapisane dodatkowe
    goals: [
      ...LOCKED_GOALS,
      ...((profile.goals ?? []) as GoalKey[]).filter(
        (g) => !LOCKED_GOALS.includes(g),
      ),
    ],
    // Przed zapisem kroku 3 baza ma domyślne 'km', ale nowy użytkownik zaczyna od treningów (3 / tydz.)
    goalType:
      profile.onboarding_step > 3 && profile.weekly_goal_type === "km"
        ? "km"
        : "workouts",
    weeklyWorkouts: profile.weekly_workouts_goal ?? 3,
    weeklyKm: profile.weekly_km_goal ?? 25,
    sleepGoalMin: profile.sleep_goal_min ?? 480,
    source: (profile.referral_source as SourceKey | null) ?? null,
    sourceOther: profile.referral_other ?? "",
    // null = użytkownik nie ruszał stron; [] = świadomie wybrał zero stron
    pages:
      profile.pending_pages === null
        ? null
        : (profile.pending_pages as PageKey[]),
    notify: notify
      ? {
          perm: notify.push_enabled,
          before: notify.before_block_min !== null,
          renew: notify.renewals_enabled,
          weekly: notify.weekly_summary,
          habits: notify.habits_enabled,
        }
      : { perm: false, before: true, renew: true, weekly: true, habits: false },
  };
}
