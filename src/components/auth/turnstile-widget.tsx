"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { useEffect, useRef } from "react";

// Testowy klucz witryny Cloudflare (zawsze przechodzi) — fallback, gdy brak .env.local
const KLUCZ_TESTOWY = "1x00000000000000000000AA";

// Widżet Cloudflare Turnstile. Token trafia do akcji serwerowej przez ukryte pole
// cf-turnstile-response, które widżet sam dodaje do formularza.
// Token jest jednorazowy: zmiana `resetKey` (np. nowy wynik akcji) generuje nowy token.
export function TurnstileWidget({
  resetKey,
  className,
}: {
  resetKey?: unknown;
  className?: string;
}) {
  const ref = useRef<TurnstileInstance>(null);
  const pierwszyRender = useRef(true);

  useEffect(() => {
    if (pierwszyRender.current) {
      pierwszyRender.current = false;
      return;
    }
    ref.current?.reset();
  }, [resetKey]);

  return (
    <div className={className}>
      <Turnstile
        ref={ref}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? KLUCZ_TESTOWY}
        options={{ appearance: "interaction-only", size: "flexible", theme: "light", language: "pl" }}
      />
    </div>
  );
}
