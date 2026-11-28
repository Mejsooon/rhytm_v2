"use client";

// Okno „Zaplanuj trening siłowy” / „Zmień termin treningu” (S2GymPlan, S2GymPlanEdit).
import { useState } from "react";
import { toast } from "sonner";

import {
  Button,
  Chip,
  DatePicker,
  FormDialog,
  Segment,
  Switch,
  TimePicker,
  type IsoDate,
} from "@/components/controls";
import { addDays } from "@/features/calendar/view-range";
import { cn } from "@/lib/utils";
import { planGymSession, type GymSessionInput } from "./actions";
import type { TemplateWithItems } from "./load-sport";
import type { SportItem } from "./model";

const CZASY = [45, 60, 75, 90];
const DOMYSLNY_CZAS = 60;
const BLAD = "Nie udało się zapisać. Spróbuj ponownie.";

const minuty = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
// Do 23:59 — trening nie przechodzi przez północ
const hhmm = (min: number) => {
  const m = Math.min(min, 1439);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

export function GymPlanDialog({
  templates,
  today,
  clock,
  weekStart,
  date,
  start,
  templateId = null,
  item = null,
  onClose,
  onStartNow,
  onDelete,
}: {
  templates: TemplateWithItems[];
  today: IsoDate;
  clock: "24" | "12";
  weekStart: "mon" | "sun";
  // Wartości startowe nowego planu
  date: IsoDate;
  start: string;
  templateId?: string | null;
  // Zaplanowany trening do przeniesienia (sesja albo wystąpienie szablonu); null = nowy
  item?: SportItem | null;
  onClose: () => void;
  onStartNow: (input: GymSessionInput) => void;
  onDelete: (item: SportItem) => void;
}) {
  const od0 = item ? hhmm(item.startMin) : start;
  const [szablon, setSzablon] = useState(item ? item.templateId : templateId);
  const [dzien, setDzien] = useState<IsoDate | null>(item?.date ?? date);
  const [od, setOd] = useState(od0);
  const [doG, setDo] = useState(hhmm(minuty(od0) + (item?.durationMin || DOMYSLNY_CZAS)));
  const [wKalendarzu, setWKalendarzu] = useState(item?.showInCalendar ?? true);
  const [zapis, setZapis] = useState(false);

  const jutro = addDays(today, 1);
  const wybor = dzien === today ? "dzis" : dzien === jutro ? "jutro" : "inny";
  const dlugosc = minuty(doG) - minuty(od);
  const zle = dlugosc <= 0;
  const wybrany = templates.find((t) => t.id === szablon);

  // Zmiana początku zachowuje długość
  function zmienOd(v: string) {
    setDo(hhmm(minuty(v) + (dlugosc > 0 ? dlugosc : DOMYSLNY_CZAS)));
    setOd(v);
  }

  async function zapisz() {
    if (!dzien || zle || zapis) return;
    setZapis(true);
    const wynik = await planGymSession({
      sessionId: item?.sessionId ?? undefined,
      templateId: szablon ?? undefined,
      // Wystąpienie szablonu bez sesji: zapamiętujemy jego dzień, żeby nie wróciło po przeniesieniu
      originalDate: item && !item.sessionId ? item.date : undefined,
      date: dzien,
      start: od,
      end: doG,
      showInCalendar: wKalendarzu,
    }).catch(() => null);
    setZapis(false);
    if (wynik?.ok) {
      toast.success(item ? "Zapisano nowy termin" : "Zaplanowano trening");
      onClose();
    } else {
      toast.error(wynik?.message ?? BLAD);
    }
  }

  return (
    <FormDialog
      open
      wide
      onOpenChange={(o) => !o && onClose()}
      title={item ? "Zmień termin treningu" : "Zaplanuj trening siłowy"}
      description={
        item ? item.title : "Trening pojawi się w kalendarzu sportu i — jeśli chcesz — w kalendarzu głównym."
      }
      footerClassName="justify-between"
      footer={
        <>
          <span>
            {item && (
              <Button
                variant="ghost"
                className="text-destructive-foreground"
                onClick={() => {
                  onClose();
                  onDelete(item);
                }}
              >
                Usuń trening
              </Button>
            )}
          </span>
          <span className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Anuluj
            </Button>
            {!item && dzien === today && (
              <Button
                onClick={() => {
                  onClose();
                  onStartNow({ date: today, start, templateId: szablon ?? undefined });
                }}
              >
                Rozpocznij teraz
              </Button>
            )}
            <Button variant="primary" disabled={!dzien || zle || zapis} onClick={() => void zapisz()}>
              {item ? "Zapisz zmiany" : "Zaplanuj"}
            </Button>
          </span>
        </>
      }
    >
      {/* Przy zmianie terminu trening (i jego szablon) zostaje ten sam */}
      {!item && (
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          <span>Trening</span>
          <div role="radiogroup" aria-label="Trening" className="grid grid-cols-4 gap-2 max-[799px]:grid-cols-2">
            {[null, ...templates].map((t) => {
              const on = (t?.id ?? null) === (wybrany?.id ?? null);
              return (
                <button
                  key={t?.id ?? "pusty"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setSzablon(t?.id ?? null);
                    if (t) zmienOd(t.start_time.slice(0, 5));
                  }}
                  className={cn(
                    "flex cursor-pointer flex-col items-start gap-0.5 rounded-[10px] border border-input bg-white px-3 py-2.5 text-left outline-none focus-visible:shadow-focus",
                    on && "border-primary shadow-[0_0_0_1px_var(--primary)]",
                  )}
                >
                  <b className="max-w-full truncate font-semibold">{t?.name ?? "Pusty"}</b>
                  <span className="text-xs font-normal text-muted-foreground">
                    {t ? `${t.items.length} ćw.` : "bez ćwiczeń"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        <span>Dzień</span>
        <div className="flex flex-wrap items-center gap-2">
          <Segment
            ariaLabel="Dzień"
            value={wybor}
            onChange={(v) => setDzien(v === "dzis" ? today : v === "jutro" ? jutro : addDays(today, 2))}
            options={[
              { value: "dzis", label: "Dziś" },
              { value: "jutro", label: "Jutro" },
              { value: "inny", label: "Inny dzień" },
            ]}
          />
          <div className="min-w-[160px] flex-1">
            <DatePicker ariaLabel="Data treningu" value={dzien} onChange={setDzien} today={today} weekStart={weekStart} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          <span>Od</span>
          <TimePicker ariaLabel="Od" value={od} onChange={zmienOd} clock={clock} />
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          <span>Do</span>
          <TimePicker ariaLabel="Do" value={doG} onChange={setDo} clock={clock} />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Długość:</span>
        {CZASY.map((c) => (
          <Chip key={c} selected={dlugosc === c} onClick={() => setDo(hhmm(minuty(od) + c))}>
            {c} min
          </Chip>
        ))}
      </div>
      {zle && (
        <p role="alert" className="m-0 text-xs text-destructive-foreground">
          Koniec musi być po początku.
        </p>
      )}
      <label className="flex cursor-pointer items-center gap-2.5">
        <Switch checked={wKalendarzu} onChange={setWKalendarzu} ariaLabel="Pokaż w kalendarzu głównym" />
        Pokaż w kalendarzu głównym jako blok
      </label>
      <p className="m-0 text-xs leading-normal text-muted-foreground">
        Godzinę zmienisz później w szczegółach treningu („Zmień termin”). Zaplanowany trening rozpoczniesz w jego dniu —
        licznik czasu startuje dopiero wtedy.
      </p>
    </FormDialog>
  );
}
