import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";

// Dozwolone typy linków z maili — tylko one trafiają do verifyOtp (żadnych dowolnych wartości z adresu)
const TYPY = ["signup", "email", "recovery", "email_change"] as const;
type TypLinku = (typeof TYPY)[number];

// Gdzie prowadzi udane potwierdzenie danego typu
const CEL: Record<TypLinku, string> = {
  signup: "/potwierdzono",
  email: "/potwierdzono",
  recovery: "/nowe-haslo",
  email_change: "/ustawienia",
};

// Link z maila (szablony w supabase/templates): wymiana token_hash na sesję.
export async function GET(request: NextRequest) {
  const { origin, searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const typ = TYPY.find((t) => t === searchParams.get("type"));

  // Błąd: ekran „Link wygasł”; ponowne wysłanie obsługuje tylko signup i recovery
  const blad = NextResponse.redirect(new URL(`/link-wygasl?type=${typ === "recovery" ? "recovery" : "signup"}`, origin));
  if (!tokenHash || !typ) return blad;

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ type: typ, token_hash: tokenHash });
  if (error) return blad;

  return NextResponse.redirect(new URL(CEL[typ], origin));
}
