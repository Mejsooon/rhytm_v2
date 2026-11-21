"use client";

import { Lock, LockOpen, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { useVault } from "./vault-provider";

// Baner stanu sejfu (.alert z CVault.dc.html): zablokowany — neutralny, odblokowany — zielony
// (.alert.ok) z odliczaniem do blokady mm:ss. Przy braku sejfu i ładowaniu nic nie pokazuje.
export function VaultBanner() {
  const { status, remainingMs } = useVault();

  if (status === "brak" || status === "ladowanie") return null;

  // Brak WebCrypto (stara przeglądarka lub brak HTTPS)
  if (status === "nieobslugiwany") {
    return (
      <div
        role="alert"
        className="flex items-center gap-2.5 rounded-lg border border-warning-border bg-warning/[.05] px-3.5 py-3 text-sm"
      >
        <TriangleAlert aria-hidden="true" className="size-[18px] flex-none" />
        <span className="flex-1 font-medium">Sejf wymaga nowoczesnej przeglądarki i połączenia HTTPS.</span>
      </div>
    );
  }

  const otwarty = status === "odblokowany";
  // Pozostały czas zaokrąglany w górę do pełnej sekundy: mm:ss
  const sekundy = Math.max(0, Math.ceil(remainingMs / 1000));
  const odliczanie = `${String(Math.floor(sekundy / 60)).padStart(2, "0")}:${String(sekundy % 60).padStart(2, "0")}`;

  return (
    <div
      className={cn(
        "flex items-center gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        otwarty ? "border-success-border bg-success/[.04]" : "border-border bg-white",
      )}
    >
      {otwarty ? (
        <LockOpen aria-hidden="true" className="size-[18px] flex-none" />
      ) : (
        <Lock aria-hidden="true" className="size-[18px] flex-none" />
      )}
      {/* Region live tylko dla tekstu stanu; licznik co sekundę nie jest ogłaszany */}
      <span role="status" className="flex-1 font-medium">
        {otwarty ? "Sejf odblokowany" : "Sejf zablokowany"}
      </span>
      <span className="text-[13px] tabular-nums opacity-80">
        {otwarty ? `blokada za ${odliczanie}` : "serwer widzi tylko szyfrogram"}
      </span>
    </div>
  );
}
