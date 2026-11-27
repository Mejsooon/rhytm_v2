"use client";

// Karta „Widok” (S2SettingsCalendar): każda zmiana zapisuje się od razu, błąd cofa wybór.
import { useState } from "react";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Dropdown,
  Segment,
  Switch,
} from "@/components/controls";
import type { CalendarSettings } from "@/features/calendar/settings";
import { saveCalendarSettings } from "@/features/calendar/settings-actions";

const OPIS_WIDOKU = {
  dzien: "Jeden dzień z godzinami",
  tydzien: "Pn–Nd z godzinami",
  miesiac: "Cały miesiąc, bez godzin",
} as const;

const godziny = (od: number, doG: number) =>
  Array.from({ length: doG - od + 1 }, (_, i) => ({
    value: String(od + i),
    label: `${String(od + i).padStart(2, "0")}:00`,
  }));

function Wiersz({ nazwa, opis, children }: { nazwa: string; opis: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-border py-3.5 first:border-t-0 max-[799px]:flex-wrap">
      <div className="min-w-0">
        <div className="font-medium">{nazwa}</div>
        <div className="text-[13px] text-muted-foreground">{opis}</div>
      </div>
      {children}
    </div>
  );
}

export function CalendarSettingsCard({ settings }: { settings: CalendarSettings }) {
  const [stan, setStan] = useState(settings);
  // Next 16 zachowuje stan trasy (Activity), więc nowe dane z serwera trzeba przejąć
  const [dla, setDla] = useState(settings);
  if (dla !== settings) {
    setDla(settings);
    setStan(settings);
  }
  const [komunikat, setKomunikat] = useState("Zmiany zapisują się od razu.");

  async function zapisz(patch: Partial<CalendarSettings>) {
    const przed = stan;
    setStan({ ...przed, ...patch });
    let wynik;
    try {
      wynik = await saveCalendarSettings(patch);
    } catch {
      wynik = { ok: false as const, message: "Nie udało się zapisać. Spróbuj ponownie." };
    }
    if (!wynik.ok) setStan(przed);
    setKomunikat(wynik.ok ? "Zapisano" : wynik.message);
  }

  return (
    <Card data-testid="karta-widok">
      <CardHeader>
        <div>
          <CardTitle as="h2">Widok</CardTitle>
          <CardDescription>Jak kalendarz otwiera się po wejściu.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="max-[799px]:px-4">
        <Wiersz nazwa="Widok domyślny" opis={OPIS_WIDOKU[stan.view]}>
          <Segment
            ariaLabel="Widok domyślny"
            value={stan.view}
            onChange={(view) => void zapisz({ view })}
            options={[
              { value: "dzien", label: "Dzień" },
              { value: "tydzien", label: "Tydzień" },
              { value: "miesiac", label: "Miesiąc" },
            ]}
          />
        </Wiersz>
        <Wiersz nazwa="Godziny siatki" opis="Siatka zawsze wypełnia całą wysokość ekranu">
          <div className="flex items-center gap-2">
            <Dropdown
              variant="select"
              ariaLabel="Siatka od"
              width={120}
              value={String(stan.fromHour)}
              onChange={(v) => void zapisz({ fromHour: Number(v), toHour: stan.toHour })}
              options={godziny(0, stan.toHour - 4)}
            />
            <span aria-hidden="true">–</span>
            <Dropdown
              variant="select"
              ariaLabel="Siatka do"
              width={120}
              value={String(stan.toHour)}
              onChange={(v) => void zapisz({ fromHour: stan.fromHour, toHour: Number(v) })}
              options={godziny(stan.fromHour + 4, 24)}
            />
          </div>
        </Wiersz>
        <Wiersz nazwa="Domyślna długość bloku" opis="Po kliknięciu w pustą godzinę">
          <Segment
            ariaLabel="Domyślna długość bloku"
            value={String(stan.blockMin)}
            onChange={(v) => void zapisz({ blockMin: Number(v) as CalendarSettings["blockMin"] })}
            options={[
              { value: "30", label: "30 min" },
              { value: "60", label: "1 h" },
              { value: "90", label: "1,5 h" },
            ]}
          />
        </Wiersz>
        <Wiersz nazwa="Pokazuj odnowienia subskrypcji" opis="Chipy ze stron typu Subskrypcje nad dniem">
          <Switch
            ariaLabel="Pokazuj odnowienia subskrypcji"
            checked={stan.showRenewals}
            onChange={(showRenewals) => void zapisz({ showRenewals })}
          />
        </Wiersz>
        <Wiersz nazwa="Numery tygodni" opis="W widoku miesiąca i mini-kalendarzu">
          <Switch
            ariaLabel="Numery tygodni"
            checked={stan.weekNumbers}
            onChange={(weekNumbers) => void zapisz({ weekNumbers })}
          />
        </Wiersz>
      </CardContent>
      <CardFooter>
        <span role="status" className="text-[13px] text-muted-foreground">
          {komunikat}
        </span>
        <Link href="/kalendarz" className="text-sm font-medium underline-offset-4 hover:underline">
          Otwórz kalendarz
        </Link>
      </CardFooter>
    </Card>
  );
}
