import { NextResponse, type NextRequest } from "next/server";

import { resolveRoute } from "@/lib/auth/route-guard";
import { updateSession } from "@/lib/supabase/proxy-session";

// Proxy (Next 16, dawniej middleware): odświeża sesję Supabase i stosuje przekierowania.
export async function proxy(request: NextRequest) {
  // Bez konfiguracji Supabase (np. lokalny build) nie ma czego odświeżać — przepuszczamy.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return NextResponse.next();
  }

  const { response, user, supabase } = await updateSession(request);

  // Status onboardingu i prośbę o usunięcie konta czytamy jednym zapytaniem, tylko dla zalogowanego.
  // Błąd zapytania = stan nieznany (null): wtedy nie przekierowujemy według onboardingu.
  let isOnboarded: boolean | null = false;
  let deletionRequestedAt: string | null = null;
  if (user) {
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarded_at, deletion_requested_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error?.code === "42703") {
      // Stara baza bez kolumny deletion_requested_at: sam onboarding, konto nie jest usuwane
      const { data: stary, error: bladStarego } = await supabase
        .from("profiles")
        .select("onboarded_at")
        .eq("user_id", user.id)
        .maybeSingle();
      isOnboarded = bladStarego ? null : stary?.onboarded_at != null;
    } else {
      isOnboarded = error ? null : data?.onboarded_at != null;
      deletionRequestedAt = error ? null : (data?.deletion_requested_at ?? null);
    }
  }

  const decyzja = resolveRoute({
    pathname: request.nextUrl.pathname,
    isLoggedIn: user != null,
    isOnboarded,
    deletionRequestedAt,
  });

  if (!decyzja) {
    return response;
  }

  // Przekierowanie musi nieść ciasteczka sesji ustawione przez updateSession i ich nagłówki no-cache
  const redirect = NextResponse.redirect(
    new URL(decyzja.redirect, request.url),
  );
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  for (const naglowek of ["Cache-Control", "Expires", "Pragma"]) {
    const wartosc = response.headers.get(naglowek);
    if (wartosc) redirect.headers.set(naglowek, wartosc);
  }
  return redirect;
}

export const config = {
  matcher: [
    // Pomija statyki, optymalizację obrazów, favicon, ikony, manifest i service worker
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|sw.js).*)",
  ],
};
