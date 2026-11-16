// Dokąd trafia użytkownik tuż po zalogowaniu: ukończony onboarding → aplikacja, inaczej onboarding.
export function pathAfterLogin(
  profile: { onboarded_at: string | null } | null,
): "/dzis" | "/onboarding" {
  return profile?.onboarded_at ? "/dzis" : "/onboarding";
}
