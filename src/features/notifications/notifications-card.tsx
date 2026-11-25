"use client";

// Zakładka Ustawienia → Powiadomienia (S2SettingsNotifications.dc.html): karta główna (push na tym urządzeniu,
// trzy rodzaje, cicha noc, „Wyślij testowe”), „Urządzenia” i „Przypomnienia nawyków”.
// Hook usePushDevice działa raz, w NotificationsTab, a jego stan trafia propsami do trzech kart (bez kontekstu).
import * as React from "react";
import { Bell, Moon } from "lucide-react";

import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Switch,
  TimePicker,
} from "@/components/controls";
import { describeUserAgent } from "@/lib/user-agent";
import { cn } from "@/lib/utils";
import { saveNotificationSettings, sendTestPush } from "./actions";
import { DevicesCard, type DeviceItem } from "./devices-card";
import {
  HabitRemindersCard,
  type HabitReminderItem,
} from "./habit-reminders-card";
import { usePushDevice, type PushStan } from "./use-push-device";

export type NotificationSettings = {
  habits: boolean;
  block: boolean;
  renewals: boolean;
  quiet: boolean;
  quietFrom: string; // 'HH:MM'
  quietTo: string; // 'HH:MM'
};

// Wiersz .nrow: 14 px w pionie, linia rgba(0,0,0,.06) między wierszami, bez linii pod ostatnim
const WIERSZ =
  "flex flex-wrap items-center justify-between gap-3 border-b border-black/[.06] py-3.5 leading-[1.21] last:border-b-0 max-[799px]:min-h-[60px] max-[799px]:flex-nowrap max-[799px]:border-border max-[799px]:px-4 max-[799px]:py-2.5 max-[799px]:[&>:first-child]:min-w-0 max-[799px]:[&>:first-child]:flex-1";
// Wiersz wyszarzony jak w makiecie (opacity .55); przełącznik w nim bez własnego przygaszenia
const WYSZARZONY = "opacity-55 [&_[role=switch]]:opacity-100";

// Rodzic-klient: jeden hook push, z którego korzystają trzy karty
export function NotificationsTab({
  settings,
  devices,
  devicesLoadError,
  habits,
  timeZone,
}: {
  settings: NotificationSettings;
  devices: DeviceItem[];
  devicesLoadError: boolean;
  habits: HabitReminderItem[];
  timeZone: string;
}) {
  const push = usePushDevice();
  // „Przypomnienia o nawykach” wyłączone → karta nawyków wyszarzona (stan z karty głównej, po zapisie)
  const [nawykiWlaczone, setNawykiWlaczone] = React.useState(settings.habits);

  const deviceCreatedAt: Record<string, string> = {};
  const deviceLabels: Record<string, string> = {};
  for (const d of devices) {
    deviceCreatedAt[d.endpoint] = d.createdAt;
    deviceLabels[d.endpoint] = d.label;
  }
  const activeDevices = devices.filter((d) => d.enabled).length;
  // Wyszarzenie (decyzja C13): push na tym urządzeniu nie jest włączony. Wyjątek: push nieskonfigurowany
  // na serwerze (brak VAPID) — wtedy ustawienia i godziny nawyków da się przygotować zawczasu.
  const wyszarz = push.stan !== "wlaczony" && push.stan !== "nieskonfigurowany";

  return (
    <>
      <NotificationsCard
        push={push}
        settings={settings}
        deviceCreatedAt={deviceCreatedAt}
        deviceLabels={deviceLabels}
        activeDevices={activeDevices}
        timeZone={timeZone}
        onHabitsChange={setNawykiWlaczone}
      />
      <DevicesCard
        devices={devices}
        currentEndpoint={push.endpoint}
        loadError={devicesLoadError}
        timeZone={timeZone}
      />
      <HabitRemindersCard
        habits={habits}
        disabled={wyszarz || !nawykiWlaczone}
      />
    </>
  );
}

const RODZAJE = [
  {
    klucz: "habits",
    tytul: "Przypomnienia o nawykach",
    opis: "Wysyłane o godzinie ustawionej przy nawyku",
  },
  {
    klucz: "block",
    tytul: "Start bloku w kalendarzu",
    opis: "5 minut przed rozpoczęciem bloku",
  },
  {
    klucz: "renewals",
    tytul: "Odnowienia subskrypcji",
    opis: "Dzień przed odnowieniem, o 9:00",
  },
] as const;

// Podpis przełącznika push dla stanów innych niż „włączony”
const PODPISY: Record<Exclude<PushStan, "wlaczony">, string> = {
  ladowanie: "Sprawdzam to urządzenie…",
  wylaczony: "Wyłączone — nie dostaniesz żadnych powiadomień na tym urządzeniu",
  nieskonfigurowany: "Push nie jest jeszcze skonfigurowany",
  nieobslugiwany: "Ta przeglądarka nie obsługuje powiadomień push",
  "ios-instalacja": "Na iPhonie push działa po dodaniu rhytm do ekranu głównego",
  zablokowany: "Powiadomienia są zablokowane w ustawieniach przeglądarki",
};

export function NotificationsCard({
  push,
  settings,
  deviceCreatedAt,
  deviceLabels,
  activeDevices,
  timeZone,
  onHabitsChange,
}: {
  push: ReturnType<typeof usePushDevice>;
  settings: NotificationSettings;
  // Po endpoincie: data włączenia i etykieta urządzenia (podpis „Chrome · Linux · włączone 12.11.2026”)
  deviceCreatedAt: Record<string, string>;
  deviceLabels: Record<string, string>;
  activeDevices: number;
  timeZone: string;
  onHabitsChange?: (v: boolean) => void;
}) {
  // Wartości na ekranie (optymistycznie) i ostatnio zapisane (do cofnięcia przy błędzie)
  const [wartosci, setWartosci] = React.useState(settings);
  const zapisane = React.useRef(settings);
  const [komunikat, setKomunikat] = React.useState<{
    ok: boolean;
    tekst: string;
  } | null>(null);
  const [rowneGodziny, setRowneGodziny] = React.useState(false);
  const [wysylam, setWysylam] = React.useState(false);

  const wlaczony = push.stan === "wlaczony";
  const wyszarz = !wlaczony && push.stan !== "nieskonfigurowany";
  const mozeTest = wlaczony && activeDevices > 0;

  // Zapis pola (albo pary godzin): od razu na ekranie, przy błędzie powrót do zapisanej wartości
  async function zapisz(
    zmiana: Partial<NotificationSettings>,
    patch: Parameters<typeof saveNotificationSettings>[0],
  ) {
    setWartosci((w) => ({ ...w, ...zmiana }));
    if (zmiana.habits !== undefined) onHabitsChange?.(zmiana.habits);
    let wynik: Awaited<ReturnType<typeof saveNotificationSettings>>;
    try {
      wynik = await saveNotificationSettings(patch);
    } catch {
      wynik = { ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." };
    }
    if (wynik.ok) {
      zapisane.current = { ...zapisane.current, ...zmiana };
      return;
    }
    // Cofamy tylko pola tej zmiany (inne mogły się w międzyczasie zapisać)
    const cofniete: Partial<NotificationSettings> = {};
    for (const k of Object.keys(zmiana) as (keyof NotificationSettings)[]) {
      (cofniete as Record<string, unknown>)[k] = zapisane.current[k];
    }
    setWartosci((w) => ({ ...w, ...cofniete }));
    if (cofniete.habits !== undefined) onHabitsChange?.(cofniete.habits);
    setKomunikat({ ok: false, tekst: wynik.message });
  }

  function przelaczRodzaj(klucz: "habits" | "block" | "renewals", v: boolean) {
    if (wyszarz) return;
    setKomunikat(null);
    if (klucz === "habits") void zapisz({ habits: v }, { habits_enabled: v });
    else if (klucz === "block")
      void zapisz({ block: v }, { before_block_min: v ? 5 : null });
    else void zapisz({ renewals: v }, { renewals_enabled: v });
  }

  // Godzina cichej nocy: równe „od” i „do” nie są zapisywane (komunikat pod podpisem)
  function zmienGodzine(pole: "quietFrom" | "quietTo", v: string) {
    const od = pole === "quietFrom" ? v : wartosci.quietFrom;
    const do_ = pole === "quietTo" ? v : wartosci.quietTo;
    setKomunikat(null);
    if (od === do_) {
      setWartosci((w) => ({ ...w, [pole]: v }));
      setRowneGodziny(true);
      return;
    }
    setRowneGodziny(false);
    void zapisz(
      { quietFrom: od, quietTo: do_ },
      { quiet_from: od, quiet_to: do_ },
    );
  }

  async function wyslijTest() {
    if (!mozeTest || wysylam) return;
    setWysylam(true);
    setKomunikat(null);
    try {
      const wynik = await sendTestPush();
      if (wynik.ok) {
        const n = wynik.sent;
        // Odmiana: 1 urządzenie, 2–4 urządzenia (bez 12–14), reszta urządzeń
        const slowo =
          n === 1
            ? "urządzenie"
            : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
              ? "urządzenia"
              : "urządzeń";
        setKomunikat({
          ok: true,
          tekst: `Wysłano testowe powiadomienie na ${n} ${slowo} ✓`,
        });
      } else {
        setKomunikat({ ok: false, tekst: wynik.message });
      }
    } catch {
      setKomunikat({
        ok: false,
        tekst: "Nie udało się wysłać testowego powiadomienia. Spróbuj ponownie.",
      });
    } finally {
      setWysylam(false);
    }
  }

  // Podpis push: „{etykieta} · włączone DD.MM.RRRR” (data w strefie profilu). Urządzenie włączone przed
  // chwilą może jeszcze nie być na liście z serwera — wtedy etykieta z tej przeglądarki i dzisiejsza data.
  let podpisPush = "";
  if (push.stan === "wlaczony") {
    const ep = push.endpoint ?? "";
    const etykieta =
      deviceLabels[ep] ??
      describeUserAgent(
        typeof navigator === "undefined" ? null : navigator.userAgent,
      ).label;
    const kiedy = deviceCreatedAt[ep] ? new Date(deviceCreatedAt[ep]) : new Date();
    const data = new Intl.DateTimeFormat("pl-PL", {
      timeZone,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(kiedy);
    podpisPush = `${etykieta} · włączone ${data}`;
  } else {
    podpisPush = PODPISY[push.stan];
  }

  const stopka =
    komunikat?.tekst ??
    (mozeTest
      ? "Na iPhonie push działa po dodaniu rhytm do ekranu głównego."
      : "Włącz push i co najmniej jedno urządzenie, żeby wysłać test.");

  return (
    <Card data-testid="karta-powiadomienia">
      <CardContent className="py-1.5 max-[799px]:p-0">
        <div className={WIERSZ}>
          <div>
            <div className="font-medium">Push na tym urządzeniu</div>
            <div className="text-[13px] text-muted-foreground">{podpisPush}</div>
            {push.blad && (
              <div className="text-[13px] text-destructive-foreground">
                {push.blad}
              </div>
            )}
          </div>
          <Switch
            checked={wlaczony}
            ariaLabel="Push na tym urządzeniu"
            disabled={
              push.zajety ||
              (push.stan !== "wlaczony" && push.stan !== "wylaczony")
            }
            onChange={(v) => {
              setKomunikat(null);
              void (v ? push.wlacz() : push.wylacz());
            }}
          />
        </div>

        {RODZAJE.map((r) => (
          <div key={r.klucz} className={cn(WIERSZ, wyszarz && WYSZARZONY)}>
            <div>
              <div className="font-medium">{r.tytul}</div>
              <div className="text-[13px] text-muted-foreground">{r.opis}</div>
            </div>
            <Switch
              // Przy wyszarzeniu pokazany jako wyłączony; zapisana wartość zostaje (C13)
              checked={wartosci[r.klucz] && !wyszarz}
              ariaLabel={r.tytul}
              disabled={wyszarz}
              onChange={(v) => przelaczRodzaj(r.klucz, v)}
            />
          </div>
        ))}

        <div className={cn(WIERSZ, "max-[799px]:flex-wrap")}>
          <div>
            <div className="flex items-center gap-2 font-medium">
              <Moon size={15} aria-hidden="true" />
              Cicha noc
            </div>
            <div className="text-[13px] text-muted-foreground">
              {wartosci.quiet
                ? `Bez powiadomień ${wartosci.quietFrom}–${wartosci.quietTo}`
                : "Wyłączona — powiadomienia przychodzą całą dobę"}
            </div>
            {wartosci.quiet && rowneGodziny && (
              <div role="alert" className="text-[13px] text-destructive-foreground">
                Początek i koniec cichej nocy muszą się różnić.
              </div>
            )}
          </div>
          <span className="flex items-center gap-2 max-[799px]:contents">
            {wartosci.quiet && (
              <span className="flex items-center gap-2 max-[799px]:order-last max-[799px]:basis-full max-[799px]:justify-between max-[799px]:pb-1 max-[799px]:[&>*:not(span)]:flex-1">
                <TimePicker
                  value={wartosci.quietFrom}
                  ariaLabel="Cicha noc od"
                  onChange={(v) => zmienGodzine("quietFrom", v)}
                />
                <span className="text-muted-foreground">–</span>
                <TimePicker
                  value={wartosci.quietTo}
                  ariaLabel="Cicha noc do"
                  onChange={(v) => zmienGodzine("quietTo", v)}
                />
              </span>
            )}
            <Switch
              checked={wartosci.quiet}
              ariaLabel="Cicha noc"
              onChange={(v) => {
                setKomunikat(null);
                // Włączenie z zapisanymi równymi godzinami nie zapisałoby się — zapisujemy tylko przełącznik
                void zapisz({ quiet: v }, { quiet_enabled: v });
              }}
            />
          </span>
        </div>
      </CardContent>
      <CardFooter>
        <span
          role="status"
          className={cn(
            "text-[13px]",
            komunikat
              ? komunikat.ok
                ? "text-success"
                : "text-destructive-foreground"
              : "text-muted-foreground",
          )}
        >
          {stopka}
        </span>
        <Button
          size="sm"
          aria-disabled={!mozeTest || wysylam}
          className="aria-disabled:pointer-events-none aria-disabled:opacity-[.45]"
          onClick={() => void wyslijTest()}
        >
          <Bell size={14} aria-hidden="true" />
          Wyślij testowe
        </Button>
      </CardFooter>
    </Card>
  );
}
