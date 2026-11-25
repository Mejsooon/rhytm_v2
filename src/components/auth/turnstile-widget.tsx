"use client";

import { Turnstile, type TurnstileInstance } from "@marsidev/react-turnstile";
import { CircleCheck } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { StatusBadge } from "@/components/controls/status-badge";

// Testowy klucz witryny Cloudflare (zawsze przechodzi) — fallback, gdy brak .env.local
const KLUCZ_TESTOWY = "1x00000000000000000000AA";

// Widżet Cloudflare Turnstile. Token trafia do akcji serwerowej przez ukryte pole
// cf-turnstile-response, które widżet sam dodaje do formularza.
// Token jest jednorazowy: zmiana `resetKey` (np. nowy wynik akcji) generuje nowy token.
// Na telefonie (<800 px) po uzyskaniu tokenu widać notkę „Weryfikacja zakończona” (CMLogin, CMRegister, CMForgot);
// na webie widżet zostaje niewidoczny, jak dotąd.
export function TurnstileWidget({
  resetKey,
  className,
  phoneStatus = false,
}: {
  resetKey?: unknown;
  className?: string;
  // Pokaż notkę „Weryfikacja zakończona” na telefonie (formularze z makiet CM)
  phoneStatus?: boolean;
}) {
  const ref = useRef<TurnstileInstance>(null);
  const pierwszyRender = useRef(true);
  const [zweryfikowano, setZweryfikowano] = useState(false);

  useEffect(() => {
    if (pierwszyRender.current) {
      pierwszyRender.current = false;
      return;
    }
    // Nowy token dopiero po ponownej weryfikacji
    setZweryfikowano(false);
    ref.current?.reset();
  }, [resetKey]);

  return (
    <div className={className}>
      <Turnstile
        ref={ref}
        siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? KLUCZ_TESTOWY}
        options={{
          appearance: "interaction-only",
          size: "flexible",
          theme: "light",
          language: "pl",
        }}
        onSuccess={() => setZweryfikowano(true)}
        onExpire={() => setZweryfikowano(false)}
        onError={() => setZweryfikowano(false)}
      />
      {phoneStatus && zweryfikowano && (
        // .alert.ok z makiet: ikona, tekst i plakietka „Turnstile”
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-lg border border-success-border bg-success/[.04] px-3 py-2.5 text-[13px] min-[800px]:hidden"
        >
          <CircleCheck
            aria-hidden="true"
            className="size-4 flex-none text-success"
            strokeWidth={2}
          />
          <span className="flex-1">Weryfikacja zakończona</span>
          <StatusBadge tone="outline">Turnstile</StatusBadge>
        </div>
      )}
    </div>
  );
}
