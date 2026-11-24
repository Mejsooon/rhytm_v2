"use client";

// Okno zakresu zmiany wg ScopeDialog.dc.html: tylko to wystąpienie / to i następne / wszystkie.
// Używane przy edycji i usuwaniu wystąpienia bloku cyklicznego.
// Telefon (< 800 px) wg CMScopeSheet.dc.html: arkusz od dołu bez ✕, tytuł 20 px z podtytułem,
// jedna karta z wierszami-radio 64 px i stopka w dwóch kolumnach (to samo drzewo DOM, różnice w klasach).
import { useState } from "react";
import { InfoIcon } from "lucide-react";

import { Button, FormDialog } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { cn } from "@/lib/utils";
import type { Scope } from "./scope";

export function ScopeDialog({
  subtitle,
  date,
  timeLabel,
  intent = "edit",
  disableThis,
  disableFollowing,
  disableAll,
  error,
  pending = false,
  onPick,
  onCancel,
}: {
  // Podtytuł, np. „rhytm — kod” · co tydzień we wtorki
  subtitle: string;
  // Data wystąpienia (oryginalna) i jego godziny „10:00–12:30” do opisów opcji
  date: IsoDate;
  timeLabel: string;
  intent?: "edit" | "delete";
  // Powód, dla którego „Tylko to wystąpienie” jest niedostępne (wyjątki nie przechowują kategorii,
  // notatki ani przypomnienia)
  disableThis?: string;
  // Powód, dla którego „To i następne” jest niedostępne (zmiana dnia poza pierwszym wystąpieniem)
  disableFollowing?: string;
  // Powód, dla którego „Wszystkie wystąpienia” jest niedostępne (zmiana dnia serii codziennej
  // albo dni roboczych)
  disableAll?: string;
  error?: string;
  pending?: boolean;
  onPick: (scope: Scope) => void;
  onCancel: () => void;
}) {
  // Domyślnie pierwsza dostępna opcja
  const [wybrany, setWybrany] = useState<Scope>(
    !disableThis ? "this" : !disableFollowing ? "following" : "all",
  );
  const wszystkieWylaczone = Boolean(
    disableThis && disableFollowing && disableAll,
  );

  // „wt 17.11” z daty i dnia tygodnia
  const [, miesiac, dzien] = date.split("-");
  const dniTygodnia = ["nd", "pn", "wt", "śr", "cz", "pt", "sb"];
  const dzienTygodnia = dniTygodnia[new Date(`${date}T12:00:00Z`).getUTCDay()];
  const krotko = `${Number(dzien)}.${miesiac}`;

  const opcje: {
    value: Scope;
    tytul: string;
    opis: string;
    wylaczona: boolean;
  }[] = [
    {
      value: "this",
      tytul: "Tylko to wystąpienie",
      opis: `${dzienTygodnia} ${krotko} · ${timeLabel}. Inne tygodnie zostają bez zmian.`,
      wylaczona: Boolean(disableThis),
    },
    {
      value: "following",
      tytul: "To i następne",
      opis: `Od ${krotko} w przód. Wcześniejsze wystąpienia zostają.`,
      wylaczona: Boolean(disableFollowing),
    },
    {
      value: "all",
      tytul: "Wszystkie wystąpienia",
      opis:
        intent === "delete"
          ? "Usunie całą serię, także przeszłe tygodnie."
          : "Zmieni całą serię, także przeszłe tygodnie.",
      wylaczona: Boolean(disableAll),
    },
  ];

  return (
    <FormDialog
      open
      onOpenChange={(otwarte) => !otwarte && onCancel()}
      title={
        intent === "delete"
          ? "Usuwasz blok, który się powtarza"
          : "Zmieniasz blok, który się powtarza"
      }
      description={subtitle}
      phoneClose={false}
      // Telefon: tytuł 20 px, podtytuł widoczny (muted, cyfry tabelaryczne), stopka w 2 kolumnach bez tła
      titleClassName="max-[799px]:h-auto max-[799px]:text-xl"
      descriptionClassName="max-[799px]:mt-1 max-[799px]:block max-[799px]:text-[13px] max-[799px]:tabular-nums"
      footerClassName="max-[799px]:grid max-[799px]:grid-cols-2 max-[799px]:gap-2.5 max-[799px]:border-t-0 max-[799px]:bg-transparent max-[799px]:px-5 max-[799px]:pt-0 max-[799px]:pb-[max(20px,env(safe-area-inset-bottom))]"
      footer={
        <>
          {error && (
            <p
              role="alert"
              className="mr-auto text-xs text-destructive-foreground max-[799px]:col-span-2"
            >
              {error}
            </p>
          )}
          <Button variant="ghost" onClick={onCancel}>
            Anuluj
          </Button>
          <Button
            variant={intent === "delete" ? "destructive" : "primary"}
            disabled={pending || wszystkieWylaczone}
            onClick={() => onPick(wybrany)}
          >
            {intent === "delete" ? "Usuń" : "Zapisz zmianę"}
          </Button>
        </>
      }
    >
      <div
        role="radiogroup"
        aria-label="Zakres zmiany"
        className="flex flex-col gap-2 max-[799px]:gap-0 max-[799px]:overflow-hidden max-[799px]:rounded-xl max-[799px]:border max-[799px]:border-border max-[799px]:bg-white max-[799px]:shadow-card"
      >
        {opcje.map((o) => (
          // Karta opcji jak w CScopeDialog.dc.html: 12 px promienia, wybrana z ciemniejszą obwódką;
          // telefon: wiersz m-row 64 px w jednej karcie, bez wyróżnienia wybranej (zaznacza ją radio)
          <label
            key={o.value}
            className={cn(
              "flex items-start gap-3 rounded-lg border bg-clip-padding px-3.5 py-3 max-[799px]:min-h-16 max-[799px]:rounded-none max-[799px]:border-x-0 max-[799px]:border-t-0 max-[799px]:border-b max-[799px]:border-border max-[799px]:bg-transparent max-[799px]:px-4 max-[799px]:shadow-none max-[799px]:last:border-b-0",
              o.wylaczona
                ? "cursor-not-allowed opacity-[.64]"
                : "cursor-pointer",
              wybrany === o.value
                ? "border-black/[.24] bg-black/[.025] shadow-[0_0_0_1px_rgba(0,0,0,.12)]"
                : "border-input bg-white shadow-xs",
            )}
          >
            {/* Radio z coss.css: 16 px, zaznaczone = obwódka 5 px w kolorze primary */}
            <input
              type="radio"
              name="zakres"
              checked={wybrany === o.value}
              disabled={o.wylaczona}
              onChange={() => setWybrany(o.value)}
              className="m-0 mt-0.5 size-4 flex-none cursor-pointer appearance-none rounded-full border border-input bg-white shadow-xs outline-none checked:border-[5px] checked:border-primary focus-visible:shadow-focus disabled:cursor-not-allowed"
            />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{o.tytul}</span>
              <span className="text-[13px] text-muted-foreground max-[799px]:text-xs">
                {o.opis}
              </span>
            </span>
          </label>
        ))}
      </div>
      {/* Podpowiedzi bez powtórzeń (ta sama może dotyczyć dwóch opcji) */}
      {[
        ...new Set([disableThis, disableFollowing, disableAll].filter(Boolean)),
      ].map((p) => (
        <p key={p} className="m-0 text-xs text-muted-foreground">
          {p}
        </p>
      ))}
      {/* .alert.info z makiety: niebieska ramka i ikona (web); na telefonie zwykła podpowiedź jak dotąd */}
      <p className="m-0 flex items-start gap-2.5 rounded-lg border border-info-border bg-info/[.04] px-3.5 py-3 text-[13px] max-[799px]:border-0 max-[799px]:bg-transparent max-[799px]:p-0 max-[799px]:text-xs max-[799px]:text-muted-foreground">
        <InfoIcon
          aria-hidden="true"
          className="mt-px size-4 flex-none text-info max-[799px]:hidden"
        />
        {intent === "delete"
          ? "Zadania z usuniętych wystąpień zostaną usunięte razem z nimi."
          : "Zadania z wystąpień, które znikną ze zmienionej serii, zostaną usunięte."}
      </p>
    </FormDialog>
  );
}
