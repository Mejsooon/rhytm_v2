import { NextResponse, type NextRequest } from "next/server";

import { pathAfterLogin } from "@/lib/auth/next-path";
import { createClient } from "@/lib/supabase/server";

// Powrót z Google: wymiana kodu na sesję, potem przekierowanie wg profilu.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const blad = NextResponse.redirect(new URL("/logowanie?blad=oauth", origin));

  const code = searchParams.get("code");
  if (!code) return blad;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return blad;

  const { data: profil, error: bladProfilu } = await supabase
    .from("profiles")
    .select("onboarded_at, deletion_requested_at")
    .eq("user_id", data.user.id)
    .maybeSingle();
  // Stara baza bez kolumny deletion_requested_at (42703): sam onboarding
  let profilDoCelu: Parameters<typeof pathAfterLogin>[0] = profil;
  if (bladProfilu?.code === "42703") {
    const { data: stary } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("user_id", data.user.id)
      .maybeSingle();
    profilDoCelu = stary;
  }

  return NextResponse.redirect(
    new URL(pathAfterLogin(profilDoCelu), origin),
  );
}
