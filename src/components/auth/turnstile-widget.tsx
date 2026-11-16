"use client";

import { Turnstile } from "@marsidev/react-turnstile";

// Testowy klucz witryny Cloudflare (zawsze przechodzi) — fallback, gdy brak .env.local
const KLUCZ_TESTOWY = "1x00000000000000000000AA";

// Widżet Cloudflare Turnstile. Token trafia do akcji serwerowej przez ukryte pole
// cf-turnstile-response, które widżet sam dodaje do formularza.
export function TurnstileWidget({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Turnstile
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? KLUCZ_TESTOWY}
        options={{ size: "compact", theme: "light", language: "pl" }}
      />
    </div>
  );
}
