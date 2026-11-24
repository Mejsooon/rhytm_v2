"use client";

// Karta „Eksport danych” (Ustawienia → Konto i bezpieczeństwo, S2SettingsAccount.dc.html):
// GET /api/eksport → plik .json pobierany przez tymczasowy <a download>.
// Ostatni eksport pamięta przeglądarka (localStorage, decyzja C9).
import * as React from "react";
import { Download } from "lucide-react";

import {
  Button,
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/controls";
import { cn } from "@/lib/utils";

const KLUCZ = "rhytm-ostatni-eksport";

type Stan =
  | { typ: "spoczynek" }
  | { typ: "pracuje" }
  | { typ: "gotowe"; nazwa: string; rozmiar: string }
  | { typ: "blad" };

export function ExportCard() {
  const [stan, setStan] = React.useState<Stan>({ typ: "spoczynek" });
  // Zapis ostatniego eksportu z localStorage: useSyncExternalStore daje null na serwerze i przy hydratacji
  // (bez rozjazdu HTML ani setState w efekcie), potem wartość z przeglądarki
  const zapis = React.useSyncExternalStore(
    (powiadom) => {
      window.addEventListener("storage", powiadom);
      return () => window.removeEventListener("storage", powiadom);
    },
    () => {
      try {
        return localStorage.getItem(KLUCZ);
      } catch {
        return null;
      }
    },
    () => null,
  );
  // Data ostatniego eksportu (DD.MM.RRRR); uszkodzony wpis = „nigdy”
  let ostatni: string | null = null;
  try {
    const at = (JSON.parse(zapis ?? "null") as { at?: unknown } | null)?.at;
    const data = typeof at === "string" ? new Date(at) : null;
    if (data && !Number.isNaN(data.getTime()))
      ostatni = new Intl.DateTimeFormat("pl-PL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(data);
  } catch {
    ostatni = null;
  }

  async function pobierz() {
    if (stan.typ === "pracuje") return;
    setStan({ typ: "pracuje" });
    try {
      const odp = await fetch("/api/eksport", { cache: "no-store" });
      if (!odp.ok) throw new Error(`eksport ${odp.status}`);
      const plik = await odp.blob();

      // Nazwa z Content-Disposition (data w strefie profilu liczy serwer)
      const naglowek = odp.headers.get("Content-Disposition") ?? "";
      const nazwa =
        /filename="([^"]+)"/.exec(naglowek)?.[1] ??
        `rhytm-export-${new Date().toISOString().slice(0, 10)}.json`;

      // Rozmiar: „340 KB” albo „2,4 MB” (polski przecinek)
      const rozmiar =
        plik.size < 1024 * 1024
          ? `${Math.max(1, Math.round(plik.size / 1024))} KB`
          : `${(plik.size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;

      const adres = URL.createObjectURL(plik);
      const link = document.createElement("a");
      link.href = adres;
      link.download = nazwa;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Zwolnienie po chwili: część przeglądarek zaczyna pobieranie asynchronicznie
      setTimeout(() => URL.revokeObjectURL(adres), 1000);

      try {
        localStorage.setItem(
          KLUCZ,
          JSON.stringify({
            name: nazwa,
            size: rozmiar,
            at: new Date().toISOString(),
          }),
        );
      } catch {
        // Bez localStorage eksport i tak się udał
      }
      setStan({ typ: "gotowe", nazwa, rozmiar });
    } catch {
      setStan({ typ: "blad" });
    }
  }

  let tekst = `ostatni eksport: ${ostatni ?? "nigdy"}`;
  if (stan.typ === "pracuje") tekst = "przygotowuję plik…";
  if (stan.typ === "gotowe")
    tekst = `${stan.nazwa} · ${stan.rozmiar} · pobrano`;
  if (stan.typ === "blad")
    tekst = "Nie udało się przygotować eksportu. Spróbuj ponownie.";

  return (
    <Card data-testid="karta-eksport">
      <CardHeader>
        <div>
          <CardTitle as="h2">Eksport danych</CardTitle>
          <CardDescription>
            Wszystkie moduły i strony jako JSON. Sekrety zostają zaszyfrowane.
          </CardDescription>
        </div>
      </CardHeader>
      <CardFooter className="mt-5">
        <span className="inline-flex items-center gap-2">
          {stan.typ === "pracuje" && (
            <span
              aria-hidden="true"
              className="size-3.5 animate-[spin_.7s_linear_infinite] rounded-full border-2 border-black/[.12] border-t-foreground"
            />
          )}
          <span
            role="status"
            className={cn(
              "text-xs tabular-nums",
              stan.typ === "gotowe"
                ? "text-success"
                : stan.typ === "blad"
                  ? "text-destructive-foreground"
                  : "text-muted-foreground",
            )}
          >
            {tekst}
          </span>
        </span>
        <Button
          aria-disabled={stan.typ === "pracuje"}
          className="aria-disabled:pointer-events-none aria-disabled:opacity-[.45]"
          onClick={() => void pobierz()}
        >
          <Download size={16} aria-hidden="true" />
          {stan.typ === "gotowe" ? "Pobierz ponownie" : "Pobierz .json"}
        </Button>
      </CardFooter>
    </Card>
  );
}
