// Dokąd trafia użytkownik tuż po zalogowaniu: konto oznaczone do usunięcia → ekran przywracania,
// ukończony onboarding → aplikacja, inaczej onboarding.
// Przekierowanie z Server Action Next renderuje cel w tym samym żądaniu, z pominięciem proxy,
// więc ekran przywracania trzeba wybrać już tutaj (samo proxy nie wystarczy).
export function pathAfterLogin(
  profile: {
    onboarded_at: string | null;
    deletion_requested_at?: string | null;
  } | null,
): "/dzis" | "/onboarding" | "/konto-usuniete" {
  if (profile?.deletion_requested_at) return "/konto-usuniete";
  return profile?.onboarded_at ? "/dzis" : "/onboarding";
}
