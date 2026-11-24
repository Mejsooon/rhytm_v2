"use client";

// „Nowy wpis” na telefonie wg CMNewEntry.dc.html: arkusz od dołu z kartą trzech wierszy
// (Blok · Bieg · Trening siłowy) i „Anuluj”. Wiersze prowadzą tam samo jak dymek na webie:
// „Blok” otwiera arkusz nowego bloku, bieg i trening to linki do Sportu z datą i godziną.
import Link from "next/link";
import { CalendarIcon, ChevronRightIcon, DumbbellIcon } from "lucide-react";

import { Button, Card, FormDialog } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { formatClockTime } from "@/lib/time/timezones";
import { weekdayOf } from "../view-range";
import { DNI_SKROT } from "./pl";

// Awatar ikony wiersza (.avatar 36 px z coss.css)
const AWATAR =
  "inline-flex size-9 flex-none items-center justify-center rounded-full bg-muted text-foreground shadow-[inset_0_0_0_1px_var(--border)]";

export function MNewEntry({
  date,
  startMin,
  clock,
  onBlock,
  onClose,
}: {
  date: IsoDate;
  startMin: number;
  clock: "24" | "12";
  onBlock: () => void;
  onClose: () => void;
}) {
  const [, miesiac, dzien] = date.split("-");
  const kiedy = `${DNI_SKROT[weekdayOf(date)]} ${Number(dzien)}.${miesiac} · ${formatClockTime(Math.floor(startMin / 60), startMin % 60, clock)}`;
  // Adresy Sportu zawsze z godziną 24 h
  const godzina24 = `${String(Math.floor(startMin / 60)).padStart(2, "0")}:${String(startMin % 60).padStart(2, "0")}`;
  const parametry = `data=${date}&godzina=${godzina24}`;

  return (
    <FormDialog
      open
      onOpenChange={(otwarte) => !otwarte && onClose()}
      title="Nowy wpis"
      description={kiedy}
      phoneClose={false}
      // Telefon: tytuł 20 px, data muted z cyframi tabelarycznymi, „Anuluj” bez tła stopki
      titleClassName="max-[799px]:h-auto max-[799px]:text-xl"
      descriptionClassName="max-[799px]:mt-1 max-[799px]:block max-[799px]:text-sm max-[799px]:tabular-nums"
      footerClassName="max-[799px]:border-t-0 max-[799px]:bg-transparent max-[799px]:px-5 max-[799px]:pt-0 max-[799px]:pb-[max(20px,env(safe-area-inset-bottom))]"
      footer={
        <Button variant="ghost" className="w-full" onClick={onClose}>
          Anuluj
        </Button>
      }
    >
      <Card className="py-1">
        <button
          type="button"
          onClick={onBlock}
          className="m-row min-h-16 w-full cursor-pointer border-0 bg-transparent text-left"
        >
          <span aria-hidden="true" className={AWATAR}>
            <CalendarIcon className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Blok</span>
            <span className="text-xs text-muted-foreground">
              czas na zadania, z kategorią
            </span>
          </span>
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 flex-none text-faint-foreground"
          />
        </button>
        <Link
          href={`/sport?nowy=bieg&${parametry}`}
          onClick={onClose}
          className="m-row min-h-16"
        >
          <span aria-hidden="true" className={AWATAR}>
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="13" cy="4" r="2" />
              <path d="m4 22 4-7 3 2 2-5 4 3h3M9 9l3-2 3 3" />
            </svg>
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Bieg</span>
            <span className="text-xs text-muted-foreground">
              dystans, czas, tempo
            </span>
          </span>
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 flex-none text-faint-foreground"
          />
        </Link>
        <Link
          href={`/sport?nowy=silownia&${parametry}`}
          onClick={onClose}
          className="m-row min-h-16"
        >
          <span aria-hidden="true" className={AWATAR}>
            <DumbbellIcon className="size-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium">Trening siłowy</span>
            <span className="text-xs text-muted-foreground">
              pusty albo z szablonu
            </span>
          </span>
          <ChevronRightIcon
            aria-hidden="true"
            className="size-4 flex-none text-faint-foreground"
          />
        </Link>
      </Card>
    </FormDialog>
  );
}
