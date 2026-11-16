import { NextResponse, type NextRequest } from "next/server";

import { resolveRoute } from "@/lib/auth/route-guard";
import { updateSession } from "@/lib/supabase/proxy-session";

// Proxy (Next 16, dawniej middleware): odświeża sesję Supabase i stosuje przekierowania.
export async function proxy(request: NextRequest) {
  // Bez konfiguracji Supabase (np. lokalny build) nie ma czego odświeżać — przepuszczamy.
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    return NextResponse.next();
  }

  const { response, user, supabase } = await updateSession(request);

  // Status onboardingu czytamy jednym zapytaniem, tylko dla zalogowanego
  let isOnboarded = false;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("user_id", user.id)
      .maybeSingle();
    isOnboarded = data?.onboarded_at != null;
  }

  const decyzja = resolveRoute({
    pathname: request.nextUrl.pathname,
    isLoggedIn: user != null,
    isOnboarded,
  });

  if (!decyzja) {
    return response;
  }

  // Przekierowanie musi nieść ciasteczka sesji ustawione przez updateSession
  const redirect = NextResponse.redirect(new URL(decyzja.redirect, request.url));
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    // Pomija statyki, optymalizację obrazów, favicon, ikony i manifest
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest).*)",
  ],
};
