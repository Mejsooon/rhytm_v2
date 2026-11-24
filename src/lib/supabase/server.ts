import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import type { Database } from "@/types/database";

// Klient Supabase po stronie serwera (Server Components, Server Actions, Route Handlers).
export async function createClient() {
  const cookieStore = await cookies();
  // Logowanie idzie z serwera Next, więc bez tego GoTrue zapisałby w auth.sessions user-agent serwera (node),
  // a lista sesji w Ustawieniach pokazywałaby wszystkie sesje jako „Przeglądarka · nieznany system”.
  const userAgent = (await headers()).get("user-agent");

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: userAgent ? { headers: { "User-Agent": userAgent } } : undefined,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Wywołanie z Server Component — cookies są tylko do odczytu.
            // Odświeżaniem sesji zajmuje się proxy, więc można zignorować.
          }
        },
      },
    },
  );
}
