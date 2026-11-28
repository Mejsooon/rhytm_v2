"use client";

import * as React from "react";

import { Button, Dropdown, Segment, TextField } from "@/components/controls";
import { timezoneOptions } from "@/lib/time/timezones";
import { uploadAvatar, validateAvatarFile } from "../avatar-upload";
import type { OnboardingDraft } from "../model";
import { StepHeader } from "./step-header";

function inicjaly(imie: string) {
  return (
    imie
      .trim()
      .split(/\s+/)
      .map((w) => w[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase() || "?"
  );
}

// useSyncExternalStore: strefa przeglądarki to wartość spoza Reacta; na serwerze i przy hydratacji daje undefined, potem właściwą, bez rozjazdu HTML ani setState w efekcie
const bezSubskrypcji = () => () => {};
// Strefa przeglądarki; na serwerze (i przy hydratacji) undefined, więc bez rozjazdu HTML
function wykryjStrefe(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

// Krok 1: profil (S2OnboardingFlow). Zdjęcie wgrywa się od razu po wyborze pliku.
export function StepProfile({
  draft,
  onChange,
  userId,
  avatarUrl,
  onAvatarFile,
  firstVisit,
  now,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
  userId: string;
  avatarUrl: string | null;
  onAvatarFile: (file: File) => void;
  firstVisit: boolean;
  now: Date;
}) {
  const wykryta = React.useSyncExternalStore(
    bezSubskrypcji,
    wykryjStrefe,
    () => undefined,
  );
  // Lista zawiera też zapisaną strefę ze szkicu (gdy nie ma jej w domyślnych) oraz wykrytą, bez duplikatów
  const opcje = timezoneOptions(now, draft.timezone);
  for (const o of timezoneOptions(now, wykryta)) {
    if (!opcje.some((istniejaca) => istniejaca.value === o.value))
      opcje.push(o);
  }
  const wykrytaPoprawna =
    wykryta !== undefined && opcje.some((o) => o.value === wykryta);

  // Szkic jest potrzebny po zakończeniu uploadu, a do tego czasu mógł się zmienić (np. wpisane imię)
  const najnowszy = React.useRef(draft);
  const onChangeRef = React.useRef(onChange);
  // Efekt bez zależności celowo: po każdym renderze odświeża refy, żeby asynchroniczny upload widział aktualny szkic
  React.useEffect(() => {
    najnowszy.current = draft;
    onChangeRef.current = onChange;
  });

  // Pierwsza wizyta: wykryta strefa wchodzi do szkicu (raz)
  const zastosowano = React.useRef(false);
  React.useEffect(() => {
    if (zastosowano.current || !firstVisit || !wykrytaPoprawna) return;
    zastosowano.current = true;
    if (najnowszy.current.timezone !== wykryta) {
      onChangeRef.current({ ...najnowszy.current, timezone: wykryta });
    }
  }, [firstVisit, wykrytaPoprawna, wykryta]);

  const [blad, setBlad] = React.useState<string | null>(null);
  const [wgrywanie, setWgrywanie] = React.useState(false);
  const wejscie = React.useRef<HTMLInputElement>(null);

  async function naWyborPliku(e: React.ChangeEvent<HTMLInputElement>) {
    const plik = e.target.files?.[0];
    // Ten sam plik wybrany ponownie też ma odpalić zdarzenie
    e.target.value = "";
    if (!plik) return;
    const komunikat = validateAvatarFile(plik);
    if (komunikat) {
      setBlad(komunikat);
      return;
    }
    setBlad(null);
    setWgrywanie(true);
    const wynik = await uploadAvatar(plik, userId);
    setWgrywanie(false);
    if ("error" in wynik) {
      setBlad(wynik.error);
      return;
    }
    onChangeRef.current({ ...najnowszy.current, avatarPath: wynik.path });
    onAvatarFile(plik);
  }

  const [otwarte, setOtwarte] = React.useState(false);
  const wybrana = opcje.find((o) => o.value === draft.timezone);
  const wykryteTekst = `${wybrana ? `${wybrana.city} (${wybrana.offset})` : draft.timezone} · tydzień od ${
    draft.weekStart === "mon" ? "poniedziałku" : "niedzieli"
  } · zegar ${draft.clock} h`;

  return (
    <>
      <StepHeader title="Cześć! Jak mamy się do Ciebie zwracać?" subtitle="Imię zobaczysz na stronie Dziś. Resztę wykryliśmy sami." />

      <div className="flex items-end gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className="size-14 flex-none rounded-full object-cover" />
        ) : (
          <span className="grid size-14 flex-none place-items-center rounded-full bg-primary text-lg font-medium text-primary-foreground">
            {inicjaly(draft.name)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <TextField
            label="Imię lub pseudonim"
            autoComplete="nickname"
            maxLength={40}
            value={draft.name}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
      </div>

      <div className="flex flex-col items-start gap-1.5">
        <Button variant="ghost" size="sm" disabled={wgrywanie} onClick={() => wejscie.current?.click()}>
          {wgrywanie ? "Wgrywanie…" : "+ Dodaj zdjęcie (opcjonalnie)"}
        </Button>
        <input
          ref={wejscie}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Wybierz zdjęcie profilowe"
          className="hidden"
          onChange={naWyborPliku}
        />
        {blad && (
          <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
            {blad}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
        <div className="flex items-center gap-3">
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-medium">Wykryte z przeglądarki</span>
            <span className="text-xs text-muted-foreground tabular-nums">{wykryteTekst}</span>
          </span>
          <Button size="sm" aria-expanded={otwarte} onClick={() => setOtwarte((o) => !o)}>
            {otwarte ? "Gotowe" : "Zmień"}
          </Button>
        </div>
        {otwarte && (
          <>
            <div className="flex flex-col gap-2 text-[13px] font-medium">
              <span>Strefa czasowa</span>
              <Dropdown
                variant="select"
                ariaLabel="Strefa czasowa"
                value={draft.timezone}
                onChange={(timezone) => onChange({ ...draft, timezone })}
                options={opcje.map((o) => ({ value: o.value, label: o.value, hint: `(${o.offset})` }))}
              />
            </div>
            <div className="flex flex-col gap-2 text-[13px] font-medium">
              <span>Tydzień zaczyna się od</span>
              <Segment
                fill
                ariaLabel="Początek tygodnia"
                value={draft.weekStart}
                onChange={(weekStart) => onChange({ ...draft, weekStart })}
                options={[
                  { value: "mon", label: "Poniedziałek" },
                  { value: "sun", label: "Niedziela" },
                ]}
              />
            </div>
            <div className="flex flex-col gap-2 text-[13px] font-medium">
              <span>Format godziny</span>
              <Segment
                fill
                ariaLabel="Format godziny"
                value={draft.clock}
                onChange={(clock) => onChange({ ...draft, clock })}
                options={[
                  { value: "24", label: "24 h · 14:30" },
                  { value: "12", label: "12 h · 2:30 PM" },
                ]}
              />
            </div>
          </>
        )}
      </div>
    </>
  );
}
