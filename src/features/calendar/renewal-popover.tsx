"use client";

// Dymek odnowienia subskrypcji wg S2CalendarRenewal.dc.html: plakietka „Odnowienie · <strona>”,
// nazwa, data i czas do odnowienia, siatka Kwota / kategoria / Cykl / Następne, „Tylko podgląd…”
// i „Otwórz w <strona>”. Tylko podgląd: odnowienia nie da się edytować w kalendarzu.
// Kotwiczenie jak w BlockPopover (Radix Popover przy klikniętym wpisie); Esc, „Zamknij” i klik obok zamykają.
import { useEffect, useRef } from "react";
import Link from "next/link";
import { ExternalLink, Info, Repeat, X } from "lucide-react";

import { Button, StatusBadge } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { formatMoney, relativeDue } from "@/features/pages/fields";
import type { RenewalItem } from "./load-calendar";
import { weekdayOf } from "./view-range";

const DNI_KROTKO = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];

export function RenewalPopover({
  item,
  anchor,
  today,
  side = "bottom",
  align = "center",
  onClose,
}: {
  item: RenewalItem;
  // Kliknięty wpis odnowienia; odłączony od DOM (np. po odświeżeniu) zamyka dymek
  anchor: HTMLElement | null;
  today: IsoDate;
  // Tydzień i dzień: pod wpisem, wyśrodkowany (makieta); miesiąc: obok wpisu, jak dymek bloku
  side?: "bottom" | "right";
  align?: "start" | "center" | "end";
  onClose: () => void;
}) {
  const kotwica = anchor?.isConnected ? anchor : null;
  const tresc = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!kotwica) onClose();
  });
  if (!kotwica) return null;

  const [rok, miesiac, dzien] = item.date.split("-");
  // Przeszłe wystąpienie: sama data, bez „minął”
  const kiedy = `${DNI_KROTKO[weekdayOf(item.date)]} ${dzien}.${miesiac}.${rok}${
    item.date >= today ? ` · ${relativeDue(item.date, today).text}` : ""
  }`;
  const [rokN, miesiacN, dzienN] = item.next.split("-");
  const pola = [
    {
      k: "Kwota",
      v:
        item.amount !== null
          ? `${formatMoney(item.amount)} zł / ${item.cycle === "month" ? "mies." : "rok"}`
          : "—",
      liczba: true,
    },
    { k: item.categoryName, v: item.categoryLabel ?? "—", liczba: false },
    {
      k: "Cykl",
      v: item.cycle === "month" ? "co miesiąc" : "co rok",
      liczba: false,
    },
    { k: "Następne", v: `${dzienN}.${miesiacN}.${rokN}`, liczba: true },
  ];

  return (
    <Popover open onOpenChange={(otwarty) => !otwarty && onClose()}>
      <PopoverAnchor virtualRef={{ current: kotwica }} />
      <PopoverContent
        ref={tresc}
        role="dialog"
        aria-label={`Odnowienie ${item.title}`}
        side={side}
        align={align}
        sideOffset={side === "bottom" ? 6 : 10}
        collisionPadding={12}
        onInteractOutside={(e) => {
          // Klik w ten sam wpis zamyka dymek (przełącza go rodzic), nie otwiera od nowa
          if (e.target instanceof Node && kotwica.contains(e.target))
            e.preventDefault();
        }}
        // Fokus przeniesiony gdzie indziej (np. dymek bloku oddaje go swojemu blokowi) nie zamyka
        // podglądu; zamyka go klik obok, Esc i „Zamknij”
        onFocusOutside={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          // Fokus wraca na wpis, gdy był w dymku albo nigdzie (Esc, „Zamknij”); klik w inny blok zostawia go tam
          const aktywny = document.activeElement;
          if (
            kotwica.isConnected &&
            (aktywny === null ||
              aktywny === document.body ||
              tresc.current?.contains(aktywny))
          )
            kotwica.focus();
        }}
        // .pop: szer. 340 px, promień 12 px, odstępy sekcji 12 px, bez paddingu (sekcje mają własny)
        className="flex max-h-(--radix-popover-content-available-height) w-[340px] flex-col gap-3 overflow-y-auto rounded-lg border-border p-0 text-sm shadow-lg"
      >
        <div className="flex items-start gap-2.5 px-4 pt-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            {/* .bdg.sec z ikoną Repeat */}
            <StatusBadge tone="gray" className="self-start">
              <Repeat size={12} aria-hidden="true" />
              {`Odnowienie · ${item.pageTitle}`}
            </StatusBadge>
            <span className="text-base font-semibold break-words">
              {item.title}
            </span>
            <span className="text-xs text-muted-foreground tabular-nums">
              {kiedy}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon
            aria-label="Zamknij"
            onClick={onClose}
          >
            <X size={16} aria-hidden="true" />
          </Button>
        </div>

        <div className="flex flex-col gap-2.5 px-4">
          {/* .frame>.inner: ramka 1,5 px rgba(0,0,0,.14), promień 12 px, siatka 2×2 */}
          <div className="grid grid-cols-2 overflow-hidden rounded-lg border-[1.5px] border-black/[.14] bg-white">
            {pola.map((p, i) => (
              <div
                key={i}
                className={`px-3 py-2.5 ${i % 2 === 1 ? "border-l border-border" : ""} ${i > 1 ? "border-t border-border" : ""}`}
              >
                {/* .lbl */}
                <div className="text-xs font-medium text-muted-foreground">
                  {p.k}
                </div>
                <div
                  className={`mt-1 font-medium break-words ${p.liczba ? "tabular-nums" : ""}`}
                >
                  {p.v}
                </div>
              </div>
            ))}
          </div>
          {/* .alert.info: niebieska ramka, ikona Info 14 px */}
          <div className="flex items-start gap-2.5 rounded-lg border border-info-border bg-info/[.04] px-2.5 py-2 text-[13px]">
            <Info
              size={14}
              aria-hidden="true"
              className="mt-0.5 flex-none text-info"
            />
            {`Tylko podgląd. Edytujesz na stronie ${item.pageTitle}.`}
          </div>
        </div>

        {/* Stopka: szare tło, górna kreska, przycisk na całą szerokość */}
        <div className="rounded-b-[11px] border-t border-border bg-black/[.025] px-4 py-3">
          <Button size="sm" asChild className="w-full">
            <Link href={`/strony/${item.pageId}`}>
              {`Otwórz w ${item.pageTitle}`}
              <ExternalLink size={16} aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
