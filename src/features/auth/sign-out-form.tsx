"use client";

import * as React from "react";

import { signOut } from "./actions";

// Formularz „Wyloguj”: przed wylogowaniem wypisuje tę przeglądarkę z powiadomień push (unsubscribe)
// i przekazuje endpoint akcji signOut, która usuwa jego wiersz. Każdy błąd jest pomijany — wylogowanie
// zawsze idzie dalej (najdłużej 2 s czekania na service worker).
export function SignOutForm({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <form
      className={className}
      action={async (formData: FormData) => {
        try {
          const subskrypcja = await Promise.race([
            (async () => {
              if (typeof navigator === "undefined" || !("serviceWorker" in navigator))
                return null;
              const rejestracja = await navigator.serviceWorker.getRegistration("/");
              return (await rejestracja?.pushManager?.getSubscription()) ?? null;
            })(),
            new Promise<null>((r) => setTimeout(() => r(null), 2000)),
          ]);
          if (subskrypcja) {
            formData.set("push_endpoint", subskrypcja.endpoint);
            await subskrypcja.unsubscribe().catch(() => false);
          }
        } catch {
          // brak service workera, odmowa przeglądarki — wylogowanie bez wypisania
        }
        await signOut(formData);
      }}
    >
      {children}
    </form>
  );
}
