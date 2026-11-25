"use client";

import * as React from "react";
import { UploadIcon } from "lucide-react";

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

// Krok 1: profil (COnboarding + CMOnboarding). Zdjęcie wgrywa się od razu po wyborze pliku.
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

  return (
    <>
      <StepHeader
        title="Uzupełnij profil"
        subtitle="Te dane widzisz tylko Ty. Zmienisz je później w Ustawieniach"
        phoneSubtitle="Te dane widzisz tylko Ty. Zmienisz je później w Ustawieniach."
      />

      <div className="flex flex-col gap-1.5">
        {/* Wiersz zdjęcia jak w Ustawieniach (AvatarRow): 56 px, podpis, przycisk z ikoną po prawej */}
        <div className="flex items-center gap-4 max-[799px]:gap-3.5">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="size-14 flex-none rounded-full object-cover"
            />
          ) : (
            <span className="grid size-14 flex-none place-items-center rounded-full bg-primary text-lg font-medium text-primary-foreground">
              {inicjaly(draft.name)}
            </span>
          )}
          <div className="flex flex-col gap-1">
            <span className="font-medium">Zdjęcie profilowe</span>
            <span className="text-[13px] text-muted-foreground">
              Bez zdjęcia pokażemy inicjały
            </span>
          </div>
          <Button
            className="ml-auto max-[799px]:px-3.5"
            disabled={wgrywanie}
            onClick={() => wejscie.current?.click()}
          >
            <UploadIcon
              aria-hidden="true"
              className="size-4 max-[799px]:hidden"
            />
            {wgrywanie ? "Wgrywanie…" : "Wgraj"}
          </Button>
          <input
            ref={wejscie}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            aria-label="Wybierz zdjęcie profilowe"
            className="hidden"
            onChange={naWyborPliku}
          />
        </div>
        {blad && (
          <p
            role="alert"
            className="m-0 text-[13px] text-destructive-foreground"
          >
            {blad}
          </p>
        )}
      </div>

      <TextField
        label="Imię lub pseudonim"
        autoComplete="nickname"
        value={draft.name}
        placeholder="Jak mamy się do Ciebie zwracać?"
        webPlaceholder=" "
        onChange={(e) => onChange({ ...draft, name: e.target.value })}
      />

      <div className="flex flex-col gap-2 text-[13px] font-medium">
        <span>Strefa czasowa</span>
        {/* Web: „Europe/Warsaw (UTC+01:00)” */}
        <div className="max-[799px]:hidden">
          <Dropdown
            variant="select"
            ariaLabel="Strefa czasowa"
            value={draft.timezone}
            onChange={(timezone) => onChange({ ...draft, timezone })}
            options={opcje.map((o) => ({
              value: o.value,
              label: o.value,
              hint: `(${o.offset})`,
            }))}
          />
        </div>
        {/* Telefon: miasto + dopisek z przesunięciem */}
        <div className="min-[800px]:hidden">
          <Dropdown
            ariaLabel="Strefa czasowa"
            value={draft.timezone}
            onChange={(timezone) => onChange({ ...draft, timezone })}
            options={opcje.map((o) => ({
              value: o.value,
              label: o.city,
              hint: o.offset,
            }))}
          />
        </div>
        {wykryta === draft.timezone && (
          <span className="text-xs font-normal text-muted-foreground">
            Wykryta z przeglądarki
          </span>
        )}
      </div>

      <div className="flex flex-col gap-2 text-[13px] font-medium">
        <span>Tydzień zaczyna się od</span>
        <Segment
          fill
          ariaLabel="Początek tygodnia"
          value={draft.weekStart}
          onChange={(weekStart) => onChange({ ...draft, weekStart })}
          options={[
            { value: "mon", label: "Poniedziałku" },
            { value: "sun", label: "Niedzieli" },
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
  );
}
