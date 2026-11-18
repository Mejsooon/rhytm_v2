"use client";

// Dymek „Nowy wpis” wg Calendar.dc.html: data i godzina slotu oraz wybór Blok / Bieg / Siłownia.
// Kotwicą jest duch slotu w siatce. Bieg i Siłownia to linki do strony Sport (Etap 3 zbuduje formularze).
import Link from "next/link";

import type { IsoDate } from "@/components/controls/calendar-math";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { formatClockTime } from "@/lib/time/timezones";
import { weekdayOf } from "./view-range";

const DNI_KROTKO = ["", "pn", "wt", "śr", "cz", "pt", "sb", "nd"];
const OPCJA =
  "flex items-center gap-2.5 rounded-md p-2 text-left text-[#171717] no-underline outline-none hover:bg-[#f5f5f5] hover:text-[#171717] focus-visible:bg-[#f5f5f5] max-[799px]:min-h-11";

export function NewEntryPopover({
  anchor,
  date,
  startMin,
  clock,
  align = "start",
  onBlock,
  onClose,
}: {
  anchor: HTMLElement | null;
  date: IsoDate;
  startMin: number;
  clock: "24" | "12";
  // "end" otwiera dymek w górę (dolne wiersze siatki miesiąca)
  align?: "start" | "end";
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
        side="right"
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
        className="flex w-[260px] flex-col gap-0.5 rounded-[10px] border-[#e0e0e0] p-2 text-sm shadow-[0_12px_32px_rgba(0,0,0,.12),0_2px_6px_rgba(0,0,0,.06)]"
      >
        <div className="flex items-center gap-2 px-1 pt-0.5 pb-2">
          <span className="text-[13px] font-semibold">Nowy wpis</span>
          <span className="font-mono text-[11px] text-[#6b6b6b]">{kiedy}</span>
          <button
            type="button"
            aria-label="Zamknij"
            onClick={onClose}
            className="ml-auto size-6 cursor-pointer rounded-md border-0 bg-transparent text-xs text-[#666666] outline-none hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-[#171717]/20 max-[799px]:size-11"
          >
            ✕
          </button>
        </div>
        <button
          type="button"
          onClick={onBlock}
          className={`${OPCJA} cursor-pointer border-0 bg-transparent`}
        >
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-md border border-[#bbe5cc] bg-[#f0fdf4] text-xs text-[#15803d]"
          >
            ▤
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-medium">Blok</span>
            <span className="text-xs text-[#666666]">
              czas na zadania, z kategorią
            </span>
          </span>
        </button>
        <Link href={`/sport?nowy=bieg&${parametry}`} className={OPCJA}>
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-md border border-[#fed7aa] bg-[#fff4ed] text-xs text-[#c2410c]"
          >
            ●
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-medium">Bieg</span>
            <span className="text-xs text-[#666666]">dystans, czas, tempo</span>
          </span>
        </Link>
        <Link href={`/sport?nowy=silownia&${parametry}`} className={OPCJA}>
          <span
            aria-hidden="true"
            className="flex size-7 items-center justify-center rounded-md border border-[#e0e0e0] bg-[#f5f5f5] text-xs text-[#404040]"
          >
            ■
          </span>
          <span className="flex flex-col">
            <span className="text-[13px] font-medium">Siłownia</span>
            <span className="text-xs text-[#666666]">trening siłowy</span>
          </span>
        </Link>
      </PopoverContent>
    </Popover>
  );
}
