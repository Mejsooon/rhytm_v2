"use client";

// Dymek „Nowy wpis” wg Calendar.dc.html: data i godzina slotu oraz wybór Blok / Bieg / Siłownia.
// Kotwicą jest duch slotu w siatce. Bieg i Siłownia to linki do strony Sport (okno biegu / pusty trening).
import Link from "next/link";
import { X } from "lucide-react";

import { Button, MENU_ITEM } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { formatClockTime } from "@/lib/time/timezones";
import { weekdayOf } from "./view-range";

const DNI_KROTKO = ["", "pn", "wt", "śr", "cz", "pt", "sb", "nd"];
// Pozycja .mi z CToday: 44 px wysokości (także na webie)
const OPCJA = `${MENU_ITEM} min-h-11 hover:text-foreground`;
// Kafelek ikony 28 px, promień 8 px
const KAFELEK = "grid size-7 flex-none place-items-center rounded-[8px]";

export function NewEntryPopover({
  anchor,
  date,
  startMin,
  clock,
  align = "start",
  side = "right",
  onBlock,
  onClose,
}: {
  anchor: HTMLElement | null;
  date: IsoDate;
  startMin: number;
  clock: "24" | "12";
  // "end" otwiera dymek w górę (dolne wiersze siatki miesiąca)
  align?: "start" | "end";
  // Dziś: slot na całą szerokość osi, więc dymek pod slotem
  side?: "right" | "bottom";
  onBlock: () => void;
  onClose: () => void;
}) {
  if (!anchor) return null;

  const [, miesiac, dzien] = date.split("-");
  const kiedy = `${DNI_KROTKO[weekdayOf(date)]} ${Number(dzien)}.${miesiac} · ${formatClockTime(Math.floor(startMin / 60), startMin % 60, clock)}`;
  // Adresy Sportu zawsze z godziną 24 h
  const godzina24 = `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`;
  const parametry = `data=${date}&godzina=${godzina24}`;

  return (
    <Popover open onOpenChange={(otwarty) => !otwarty && onClose()}>
      <PopoverAnchor virtualRef={{ current: anchor }} />
      <PopoverContent
        role="dialog"
        aria-label="Nowy wpis"
        side={side}
        align={align}
        sideOffset={10}
        collisionPadding={12}
        // Klik w siatkę przełącza wpis w kalendarzu (onSlotClick), więc nie zamykamy go tu dwa razy
        onInteractOutside={(e) => {
          if (
            e.target instanceof Node &&
            anchor.parentElement?.contains(e.target)
          )
            e.preventDefault();
        }}
        // .pop z paddingiem 4 px i odstępem 1 px między pozycjami
        className="flex w-[270px] flex-col gap-px rounded-lg border-border p-1 text-sm shadow-lg"
      >
        <div className="flex items-center gap-2 pt-1 pr-1 pb-2 pl-2">
          <span className="text-sm font-semibold">Nowy wpis</span>
          <span className="text-xs text-muted-foreground tabular-nums">{kiedy}</span>
          <Button
            variant="ghost"
            size="xs"
            icon
            aria-label="Zamknij"
            onClick={onClose}
            className="ml-auto max-[799px]:size-11"
          >
            <X size={14} aria-hidden="true" />
          </Button>
        </div>
        <button type="button" onClick={onBlock} className={OPCJA}>
          <span
            aria-hidden="true"
            className={`${KAFELEK} bg-success-soft text-success`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="5" width="18" height="16" rx="2" />
              <path d="M3 10h18" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="font-medium">Blok</span>
            <span className="text-xs text-muted-foreground">
              czas na zadania, z kategorią
            </span>
          </span>
        </button>
        <Link href={`/sport?nowy=bieg&${parametry}`} className={OPCJA}>
          <span
            aria-hidden="true"
            className={`${KAFELEK} bg-warning/10 text-warning-foreground`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="font-medium">Bieg</span>
            <span className="text-xs text-muted-foreground">dystans, czas, tempo</span>
          </span>
        </Link>
        <Link href={`/sport?nowy=silownia&${parametry}`} className={OPCJA}>
          <span
            aria-hidden="true"
            className={`${KAFELEK} bg-black/5 text-[#404040]`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6.5 6.5h11M6.5 17.5h11M4 9v6M20 9v6M2 11v2M22 11v2" />
            </svg>
          </span>
          <span className="flex flex-col">
            <span className="font-medium">Siłownia</span>
            <span className="text-xs text-muted-foreground">trening siłowy</span>
          </span>
        </Link>
      </PopoverContent>
    </Popover>
  );
}
