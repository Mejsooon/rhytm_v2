"use client";

// Karta „Przypomnienia nawyków” (Ustawienia → Powiadomienia, S2SettingsNotifications.dc.html):
// każdy nawyk z godziną przypomnienia albo plakietką „wyłączone” i przełącznikiem.
import * as React from "react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  StatusBadge,
  Switch,
  TimePicker,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { setHabitReminder } from "./actions";

export type HabitReminderItem = {
  id: string;
  name: string;
  schedule: string; // „codziennie”, „pn, śr, pt, nd”, „4× w tygodniu”
  remindAt: string | null; // 'HH:MM' albo null = wyłączone
};

// Wiersz .nrow: 14 px w pionie, linia rgba(0,0,0,.06) między wierszami
const WIERSZ =
  "flex flex-wrap items-center justify-between gap-3 border-b border-black/[.06] py-3.5 leading-[1.21] last:border-b-0 max-[799px]:min-h-[60px] max-[799px]:flex-nowrap max-[799px]:border-border max-[799px]:px-4 max-[799px]:py-2.5 max-[799px]:[&>:first-child]:min-w-0 max-[799px]:[&>:first-child]:flex-1";
// Godzina włączenia przypomnienia = domyślna godzina okna nawyku (decyzja C14)
const DOMYSLNA_GODZINA = "20:30";

export function HabitRemindersCard({
  habits,
  disabled,
}: {
  habits: HabitReminderItem[];
  // Push tu nie jest włączony albo „Przypomnienia o nawykach” wyłączone: wiersze wyszarzone (C13)
  disabled: boolean;
}) {
  // Godziny ustawione w tej wizycie (optymistycznie) i ostatnio zapisane (do cofnięcia przy błędzie)
  const [godziny, setGodziny] = React.useState<Record<string, string | null>>(
    {},
  );
  const zapisane = React.useRef<Record<string, string | null>>({});
  const [blad, setBlad] = React.useState<string | null>(null);

  async function ustaw(nawyk: HabitReminderItem, wartosc: string | null) {
    setBlad(null);
    setGodziny((g) => ({ ...g, [nawyk.id]: wartosc }));
    let wynik: Awaited<ReturnType<typeof setHabitReminder>>;
    try {
      wynik = await setHabitReminder(nawyk.id, wartosc);
    } catch {
      wynik = { ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." };
    }
    if (wynik.ok) {
      zapisane.current[nawyk.id] = wartosc;
      return;
    }
    const poprzednia =
      nawyk.id in zapisane.current ? zapisane.current[nawyk.id] : nawyk.remindAt;
    setGodziny((g) => ({ ...g, [nawyk.id]: poprzednia }));
    setBlad(wynik.message);
  }

  return (
    <Card data-testid="karta-przypomnienia-nawykow">
      <CardHeader>
        <div>
          <CardTitle as="h2">Przypomnienia nawyków</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0 max-[799px]:p-0">
        {habits.length === 0 ? (
          <p className="m-0 py-3.5 text-[13px] text-muted-foreground max-[799px]:px-4">
            Nie masz jeszcze nawyków.{" "}
            <Link href="/nawyki" className="font-medium text-foreground underline">
              Przejdź do Nawyków
            </Link>
          </p>
        ) : (
          habits.map((h) => {
            const godzina = h.id in godziny ? godziny[h.id] : h.remindAt;
            // Przy wyszarzeniu pokazane jako wyłączone; zapisana godzina zostaje
            const wlaczone = godzina !== null && !disabled;
            return (
              <div
                key={h.id}
                className={cn(
                  WIERSZ,
                  disabled && "opacity-55 [&_[role=switch]]:opacity-100",
                )}
              >
                <div>
                  <div className="font-medium">{h.name}</div>
                  <div className="text-[13px] text-muted-foreground">
                    {h.schedule}
                  </div>
                </div>
                <span className="flex items-center gap-2.5">
                  {wlaczone && godzina !== null ? (
                    <TimePicker
                      value={godzina}
                      ariaLabel={`${h.name} — godzina przypomnienia`}
                      onChange={(v) => void ustaw(h, v)}
                    />
                  ) : (
                    <StatusBadge tone="gray">wyłączone</StatusBadge>
                  )}
                  <Switch
                    checked={wlaczone}
                    ariaLabel={`Przypomnienie: ${h.name}`}
                    disabled={disabled}
                    onChange={(v) => void ustaw(h, v ? DOMYSLNA_GODZINA : null)}
                  />
                </span>
              </div>
            );
          })
        )}
        {blad && (
          <p
            role="alert"
            className="m-0 pb-1 text-[13px] text-destructive-foreground max-[799px]:px-4"
          >
            {blad}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
