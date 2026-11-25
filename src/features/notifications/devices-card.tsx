"use client";

// Karta „Urządzenia” (Ustawienia → Powiadomienia, S2SettingsNotifications.dc.html): urządzenia z push,
// plakietka „TO” przy tej przeglądarce, „Wyłącz” / „Włącz” per urządzenie.
import * as React from "react";
import { Monitor, Smartphone } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusBadge,
} from "@/components/controls";
import { setDeviceEnabled } from "./push-actions";

export type DeviceItem = {
  id: string;
  endpoint: string;
  label: string;
  mobile: boolean;
  enabled: boolean;
  lastSeenAt: string;
  createdAt: string;
};

// Wiersz .nrow: 14 px w pionie, linia rgba(0,0,0,.06) między wierszami
const WIERSZ =
  "flex flex-wrap items-center justify-between gap-3 border-b border-black/[.06] py-3.5 leading-[1.21] last:border-b-0 max-[799px]:min-h-[60px] max-[799px]:flex-nowrap max-[799px]:border-border max-[799px]:px-4 max-[799px]:py-2.5 max-[799px]:[&>:first-child]:min-w-0 max-[799px]:[&>:first-child]:flex-1";

export function DevicesCard({
  devices,
  currentEndpoint,
  loadError,
  timeZone,
}: {
  devices: Omit<DeviceItem, "createdAt">[];
  currentEndpoint: string | null;
  loadError: boolean;
  timeZone: string;
}) {
  // Przełączenia z tej wizyty (zanim serwer odświeży listę); błąd zapisu cofa wpis
  const [zmiany, setZmiany] = React.useState<Record<string, boolean>>({});
  const [blad, setBlad] = React.useState<string | null>(null);

  // „ostatnio: teraz | dziś 08:02 | wczoraj 21:14 | 12.11 08:02” w strefie z profilu
  const dzien = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const godzina = new Intl.DateTimeFormat("pl-PL", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const teraz = new Date();
  const dzis = dzien.format(teraz);
  const [r, m, d] = dzis.split("-").map(Number);
  const wczoraj = new Date(Date.UTC(r, m - 1, d - 1))
    .toISOString()
    .slice(0, 10);

  async function przelacz(id: string, enabled: boolean) {
    setBlad(null);
    setZmiany((z) => ({ ...z, [id]: enabled }));
    let wynik: Awaited<ReturnType<typeof setDeviceEnabled>>;
    try {
      wynik = await setDeviceEnabled(id, enabled);
    } catch {
      wynik = { ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." };
    }
    if (!wynik.ok) {
      setZmiany((z) => {
        const reszta = { ...z };
        delete reszta[id];
        return reszta;
      });
      setBlad(wynik.message);
    }
  }

  return (
    <Card data-testid="karta-urzadzenia">
      <CardHeader>
        <div>
          <CardTitle as="h2">Urządzenia</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 max-[799px]:p-0">
        {loadError ? (
          <p className="m-0 py-3.5 text-[13px] text-destructive-foreground">
            Nie udało się wczytać urządzeń.
          </p>
        ) : devices.length === 0 ? (
          <p className="m-0 py-3.5 text-[13px] text-muted-foreground">
            Brak urządzeń. Włącz push na tym urządzeniu powyżej.
          </p>
        ) : (
          devices.map((u) => {
            const wlaczone = zmiany[u.id] ?? u.enabled;
            const to = currentEndpoint !== null && u.endpoint === currentEndpoint;
            let podpis = "powiadomienia wyłączone";
            if (wlaczone) {
              const kiedy = new Date(u.lastSeenAt);
              // Ta przeglądarka odświeża wpis przy każdym wejściu; inne: „teraz” do 5 min
              if (to || teraz.getTime() - kiedy.getTime() < 5 * 60_000)
                podpis = "ostatnio: teraz";
              else if (!Number.isNaN(kiedy.getTime())) {
                const dzienU = dzien.format(kiedy);
                const hh = godzina.format(kiedy);
                if (dzienU === dzis) podpis = `ostatnio: dziś ${hh}`;
                else if (dzienU === wczoraj) podpis = `ostatnio: wczoraj ${hh}`;
                else
                  podpis = `ostatnio: ${dzienU.slice(8, 10)}.${dzienU.slice(5, 7)} ${hh}`;
              }
            }
            return (
              <div key={u.id} className={WIERSZ}>
                <div className="flex items-center gap-3">
                  <span className="inline-flex size-8 flex-none items-center justify-center rounded-full bg-muted shadow-[inset_0_0_0_1px_var(--border)]">
                    {u.mobile ? (
                      <Smartphone size={16} aria-hidden="true" />
                    ) : (
                      <Monitor size={16} aria-hidden="true" />
                    )}
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5 font-medium">
                      {u.label}
                      {to && <StatusBadge tone="green">TO</StatusBadge>}
                    </div>
                    <div className="text-[13px] text-muted-foreground">
                      {podpis}
                    </div>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant={wlaczone ? "secondary" : "primary"}
                  aria-label={`${wlaczone ? "Wyłącz" : "Włącz"}: ${u.label}`}
                  onClick={() => void przelacz(u.id, !wlaczone)}
                >
                  {wlaczone ? "Wyłącz" : "Włącz"}
                </Button>
              </div>
            );
          })
        )}
        {blad && (
          <p
            role="alert"
            className="m-0 pb-1 text-[13px] text-destructive-foreground"
          >
            {blad}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
