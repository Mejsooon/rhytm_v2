"use client";

// Podgląd odnowienia subskrypcji na telefonie wg CMRenewalSheet.dc.html: arkusz od dołu z jednym ✕,
// plakietka „↻ Odnowienie · <strona>”, nazwa, kwota, karta z wierszami (Cykl, Ten termin, Następne, Kategoria),
// dopisek „Tylko podgląd…” i przycisk „Otwórz w <strona>” na całą szerokość. Tylko podgląd: odnowienia
// nie da się edytować w kalendarzu. Treść odpowiada dymkowi webowemu (RenewalPopover), ale to osobny markup.
import Link from "next/link";

import { Button, Card, FormDialog, StatusBadge } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { formatMoney, relativeDue } from "@/features/pages/fields";
import type { RenewalItem } from "../load-calendar";
import { weekdayOf } from "../view-range";

const DNI_KROTKO = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];

export function MRenewalSheet({
  item,
  today,
  onClose,
}: {
  item: RenewalItem;
  today: IsoDate;
  onClose: () => void;
}) {
  const [rok, miesiac, dzien] = item.date.split("-");
  const [rokN, miesiacN, dzienN] = item.next.split("-");
  // „sob 14.11.2026” i „pon 14.12.2026 · za 29 dni” (następne jest zawsze w przyszłości)
  const tenTermin = `${DNI_KROTKO[weekdayOf(item.date)]} ${dzien}.${miesiac}.${rok}`;
  const nastepne = `${DNI_KROTKO[weekdayOf(item.next)]} ${dzienN}.${miesiacN}.${rokN} · ${relativeDue(item.next, today).text}`;

  return (
    <FormDialog
      open
      onOpenChange={(otwarte) => !otwarte && onClose()}
      title={`Odnowienie ${item.title}`}
      // Makieta nie ma nagłówka z tytułem: nazwa arkusza zostaje dla czytników, ✕ stoi w prawym rogu
      titleClassName="max-[799px]:sr-only"
      headerStart={
        <StatusBadge tone="gray">{`↻ Odnowienie · ${item.pageTitle}`}</StatusBadge>
      }
    >
      <div>
        <h2 className="m-0 text-[22px] font-semibold break-words">{item.title}</h2>
        <p className="m-0 mt-1 text-[17px] font-medium tabular-nums">
          {item.amount !== null
            ? `${formatMoney(item.amount)} zł / ${item.cycle === "month" ? "mies." : "rok"}`
            : "—"}
        </p>
      </div>
      <Card className="py-1">
        <div className="m-row">
          <span className="flex-1 text-muted-foreground">Cykl</span>
          <span>{item.cycle === "month" ? "co miesiąc" : "co rok"}</span>
        </div>
        <div className="m-row">
          <span className="flex-1 text-muted-foreground">Ten termin</span>
          <span className="tabular-nums">{tenTermin}</span>
        </div>
        <div className="m-row">
          <span className="flex-1 text-muted-foreground">Następne</span>
          <span className="tabular-nums">{nastepne}</span>
        </div>
        <div className="m-row">
          <span className="flex-1 text-muted-foreground">{item.categoryName}</span>
          {item.categoryLabel !== null ? (
            <StatusBadge tone="outline">{item.categoryLabel}</StatusBadge>
          ) : (
            <span>—</span>
          )}
        </div>
      </Card>
      <p className="m-0 text-xs text-muted-foreground">
        {`Tylko podgląd. Edytujesz na stronie ${item.pageTitle}.`}
      </p>
      <Button asChild className="w-full">
        <Link href={`/strony/${item.pageId}`}>{`Otwórz w ${item.pageTitle}`}</Link>
      </Button>
    </FormDialog>
  );
}
