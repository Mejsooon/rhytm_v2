"use client";

// Okno „Nowa aktywność” (S2ActivityDialog): rodzaj z szukaniem i własnym, kolor rodzaju, status,
// termin, czas, dystans (tylko rodzaje z dystansem), kcal na żywo, trudność i notatka.
import { useState } from "react";
import { Check, Plus } from "lucide-react";

import {
  Button,
  Checkbox,
  DatePicker,
  FIELD,
  FormDialog,
  Segment,
  TextField,
  TimePicker,
  type IsoDate,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { ACTIVITY_COLORS, activityKcal, activityKinds, type ActivityKindRow } from "./activities";
import { saveActivity } from "./activity-actions";
import type { SportProfile } from "./load-sport";
import { parseKm, type SportItem } from "./model";

// „1:15” -> 4500 s, „45” -> 45 min; zły zapis -> null
export function parseActivityTime(text: string): number | null {
  const m = text.trim().match(/^(?:(\d{1,2}):)?(\d{1,3})$/);
  if (!m || (m[1] !== undefined && Number(m[2]) > 59)) return null;
  const minuty = Number(m[1] ?? 0) * 60 + Number(m[2]);
  return minuty > 0 ? minuty * 60 : null;
}

export function ActivityDialog({
  item,
  date,
  start,
  profile,
  kinds,
  onClose,
  onDelete,
}: {
  // Aktywność do edycji; null = nowa
  item: SportItem | null;
  date: IsoDate;
  start: string;
  profile: SportProfile;
  // Własne rodzaje i zmienione kolory z bazy
  kinds: ActivityKindRow[];
  onClose: () => void;
  onDelete?: (item: SportItem) => void;
}) {
  const rodzaje = activityKinds(kinds);
  const [rodzaj, setRodzaj] = useState(item?.title ?? "Tenis");
  const [wlasny, setWlasny] = useState<{ name: string; hasDistance: boolean } | null>(null);
  const [szukaj, setSzukaj] = useState("");
  const [kolor, setKolor] = useState<string | null>(null);
  const [wykonana, setWykonana] = useState(item ? !item.planned : true);
  const [dzien, setDzien] = useState<IsoDate | null>(date);
  const [godzina, setGodzina] = useState(start);
  const [czas, setCzas] = useState(
    item?.durationS != null
      ? `${Math.floor(item.durationS / 3600)}:${String(Math.round((item.durationS % 3600) / 60)).padStart(2, "0")}`
      : "",
  );
  const [km, setKm] = useState(item?.distanceKm != null ? String(item.distanceKm).replace(".", ",") : "");
  const [trudnosc, setTrudnosc] = useState<number | null>(item?.difficulty ?? null);
  const [notatka, setNotatka] = useState(item?.note ?? "");
  const [wKalendarzu, setWKalendarzu] = useState(item?.showInCalendar ?? true);
  const [blad, setBlad] = useState("");
  const [pending, setPending] = useState(false);

  const znany = rodzaje.find((k) => k.name === rodzaj);
  const nazwa = wlasny ? wlasny.name : rodzaj;
  const zDystansem = wlasny ? wlasny.hasDistance : (znany?.hasDistance ?? false);
  const wybranyKolor = kolor ?? (wlasny ? ACTIVITY_COLORS[0] : (znany?.color ?? ACTIVITY_COLORS[0]));
  const sekundy = parseActivityTime(czas);
  const kcal = activityKcal(wlasny ? 5 : (znany?.met ?? 5), sekundy, profile.weightKg);
  const pasujace = rodzaje.filter((k) => k.name.toLowerCase().includes(szukaj.trim().toLowerCase()));

  async function zapisz() {
    if (pending) return;
    if (!dzien) return setBlad("Wybierz datę.");
    if (czas.trim() !== "" && sekundy === null) return setBlad("Czas wpisz jako g:mm albo w minutach.");
    const dystans = zDystansem && km.trim() !== "" ? parseKm(km) : null;
    if (zDystansem && km.trim() !== "" && dystans === null) return setBlad("Podaj dystans liczbą.");
    setPending(true);
    setBlad("");
    try {
      const wynik = await saveActivity({
        id: item?.sessionId ?? undefined,
        kind: nazwa,
        color: wybranyKolor,
        hasDistance: zDystansem,
        done: wykonana,
        date: dzien,
        start: godzina,
        durationS: sekundy,
        distanceKm: dystans,
        difficulty: trudnosc,
        note: notatka,
        showInCalendar: wKalendarzu,
      });
      if (wynik.ok) return onClose();
      setBlad(wynik.message);
    } catch {
      setBlad("Nie udało się zapisać. Spróbuj ponownie.");
    }
    setPending(false);
  }

  const chip = "inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full border bg-white px-3 text-[13px] font-medium outline-none focus-visible:shadow-focus max-[799px]:h-10";

  return (
    <FormDialog
      open
      onOpenChange={(otwarte) => {
        if (!otwarte) onClose();
      }}
      title={item ? "Edytuj aktywność" : "Nowa aktywność"}
      description="Wszystko poza biegiem i siłownią: tenis, rower, joga, pole dance…"
      wide
      footer={
        <>
          {blad && (
            <p role="alert" className="m-0 mr-auto text-xs text-destructive-foreground">
              {blad}
            </p>
          )}
          {item && onDelete && (
            <Button variant="ghost" onClick={() => onDelete(item)}>
              Usuń
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Anuluj
          </Button>
          <Button variant="primary" disabled={pending} onClick={() => void zapisz()}>
            {`${wykonana ? "Zapisz" : "Zaplanuj"}: ${nazwa}`}
          </Button>
        </>
      }
    >
      <TextField
        label="Rodzaj aktywności"
        placeholder="Szukaj: tenis, rower, pole dance…"
        autoComplete="off"
        value={szukaj}
        onChange={(e) => setSzukaj(e.target.value)}
      />
      <div role="group" aria-label="Rodzaje" className="flex flex-wrap gap-1.5">
        {pasujace.map((k) => {
          const wybrany = !wlasny && k.name === rodzaj;
          return (
            <button
              key={k.name}
              type="button"
              aria-pressed={wybrany}
              onClick={() => {
                setWlasny(null);
                setRodzaj(k.name);
                setKolor(null);
              }}
              className={cn(chip, wybrany ? "border-2" : "border-input")}
              style={wybrany ? { borderColor: wybranyKolor, background: `${wybranyKolor}14` } : undefined}
            >
              <span aria-hidden="true" className="size-2 rounded-full" style={{ background: wybrany ? wybranyKolor : k.color }} />
              {k.name}
            </button>
          );
        })}
        <button
          type="button"
          aria-pressed={wlasny !== null}
          onClick={() => {
            setWlasny({ name: szukaj.trim() || "Własny", hasDistance: false });
            setKolor(null);
          }}
          className={cn(chip, "border-dashed border-input text-muted-foreground")}
        >
          <Plus size={14} aria-hidden="true" />
          {szukaj.trim() && pasujace.length === 0 ? `Dodaj „${szukaj.trim()}”` : "Własny rodzaj"}
        </button>
      </div>
      {wlasny && (
        <div className="flex flex-wrap items-end gap-3">
          <TextField
            label="Nazwa rodzaju"
            maxLength={40}
            autoComplete="off"
            value={wlasny.name}
            onChange={(e) => setWlasny({ ...wlasny, name: e.target.value })}
          />
          <Checkbox
            checked={wlasny.hasDistance}
            onChange={(hasDistance) => setWlasny({ ...wlasny, hasDistance })}
            label="Z dystansem"
          />
        </div>
      )}
      <div role="group" aria-label={`Kolor „${nazwa}”`} className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="mr-1 font-medium">{`Kolor „${nazwa}”`}</span>
        {ACTIVITY_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`Kolor ${c}`}
            aria-pressed={c === wybranyKolor}
            onClick={() => setKolor(c)}
            className="grid size-[26px] cursor-pointer place-items-center rounded-full border-0 text-white outline-none focus-visible:shadow-focus aria-pressed:shadow-[0_0_0_2px_#fff,0_0_0_4px_#262626]"
            style={{ background: c }}
          >
            {c === wybranyKolor && <Check size={14} strokeWidth={3} aria-hidden="true" />}
          </button>
        ))}
        <span className="text-xs text-muted-foreground">w kalendarzu i na liście</span>
      </div>

      <div className="flex flex-col items-start gap-1.5 text-[13px] font-medium">
        Status
        <Segment
          ariaLabel="Status"
          value={wykonana ? "done" : "plan"}
          onChange={(v) => setWykonana(v === "done")}
          options={[
            { value: "done", label: "Wykonana" },
            { value: "plan", label: "Zaplanowana" },
          ]}
        />
      </div>

      <div className="grid grid-cols-3 gap-3 max-[799px]:grid-cols-1">
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          Data
          <DatePicker value={dzien} onChange={setDzien} weekStart={profile.weekStart} ariaLabel="Data" />
        </div>
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          Start
          <TimePicker value={godzina} onChange={setGodzina} ariaLabel="Start" clock={profile.clock} />
        </div>
        <TextField
          label="Czas trwania"
          placeholder="g:mm"
          autoComplete="off"
          className="tabular-nums"
          value={czas}
          onChange={(e) => setCzas(e.target.value)}
        />
      </div>
      <div className="grid grid-cols-3 gap-3 max-[799px]:grid-cols-1">
        {zDystansem && (
          <TextField
            label="Dystans (km)"
            placeholder="0,0"
            inputMode="decimal"
            autoComplete="off"
            className="tabular-nums"
            value={km}
            onChange={(e) => setKm(e.target.value)}
          />
        )}
        <div className="flex flex-col gap-1.5 text-[13px] font-medium">
          Kcal
          <div data-testid="kcal" className={cn(FIELD, "flex items-center bg-black/[.025] tabular-nums shadow-none")}>
            {kcal !== null ? `≈ ${kcal}` : "—"}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        <span>
          Trudność <span className="text-xs font-normal text-muted-foreground">1 = bardzo lekko, 10 = maks</span>
        </span>
        <div className="flex flex-wrap gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={trudnosc === n}
              onClick={() => setTrudnosc(trudnosc === n ? null : n)}
              className="size-8 cursor-pointer rounded-[10px] border border-input bg-white text-[13px] font-medium tabular-nums outline-none focus-visible:shadow-focus aria-pressed:border-warning aria-pressed:bg-warning aria-pressed:text-white"
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <TextField
        label="Notatka"
        placeholder="co ćwiczyłeś, samopoczucie"
        autoComplete="off"
        value={notatka}
        onChange={(e) => setNotatka(e.target.value)}
      />
      <Checkbox checked={wKalendarzu} onChange={setWKalendarzu} label="Pokaż w kalendarzu głównym jako blok" />
    </FormDialog>
  );
}
