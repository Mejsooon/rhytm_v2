import { safeTimezone } from "@/lib/time/timezones";
import type { Database } from "@/types/database";
import {
  SOURCES,
  USE_KEYS,
  type DraftBlock,
  type OnboardingDraft,
  type SourceKey,
  type UseKey,
} from "./model";

type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];
type NotificationSettingsRow = Database["public"]["Tables"]["notification_settings"]["Row"];

// Składa szkic kreatora z zapisanego profilu; puste pola dostają wartości domyślne z makiety.
// `zapisane` = dzisiejsze bloki z kalendarza (krok 3 pokazuje je jako dodane).
export function loadDraft(
  profile: ProfileRow,
  notify: NotificationSettingsRow | null,
  zapisane: DraftBlock[] = [],
): OnboardingDraft {
  return {
    name: profile.display_name ?? "",
    avatarPath: profile.avatar_path,
    timezone: safeTimezone(profile.timezone ?? ""),
    weekStart: profile.week_start === "sun" ? "sun" : "mon",
    clock: profile.clock === "12" ? "12" : "24",
    // Klucze ze starego kreatora („student”, „sport”…) odpadają
    uses: (profile.roles ?? []).filter((r): r is UseKey => USE_KEYS.includes(r as UseKey)),
    weeklyWorkouts: profile.weekly_workouts_goal ?? 3,
    weeklyKm: profile.weekly_km_goal ?? 25,
    sleepGoalMin: profile.sleep_goal_min ?? 480,
    blocks: zapisane,
    source: SOURCES.some(([k]) => k === profile.referral_source) ? (profile.referral_source as SourceKey) : null,
    notify: notify
      ? {
          perm: notify.push_enabled,
          before: notify.before_block_min !== null,
          renew: notify.renewals_enabled,
          habits: notify.habits_enabled,
        }
      : { perm: false, before: true, renew: true, habits: false },
  };
}
