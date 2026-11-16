import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@/types/database";

// Odświeża sesję Supabase w proxy (Next 16) i zwraca odpowiedź z zaktualizowanymi cookies.
// Odpowiedź z tej funkcji trzeba zwrócić z proxy (albo skopiować z niej cookies).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Nie wstawiaj kodu między createServerClient a getUser() — sesja mogłaby się gubić.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user, supabase };
}
