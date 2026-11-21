"use client";

// Zwarte potwierdzenie „Usunąć trening?” (wzór: DeleteBlockDialog). Sesja jest usuwana (kaskada),
// a wystąpienie szablonu zapisuje pominięcie (template_skips). Okno czeka na serwer.
import { useRef, useState } from "react";
import { Dialog } from "radix-ui";
import { Trash2Icon } from "lucide-react";

import { Button } from "@/components/controls";
import { weekdayOf } from "@/features/calendar/view-range";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { formatClockTime } from "@/lib/time/timezones";
import { deleteSession, skipTemplateOccurrence } from "./actions";
import type { SportItem } from "./model";

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

export function DeleteSessionDialog({
  item,
  clock,
  onDeleted,
  onCancel,
}: {
  item: SportItem;
  clock: "24" | "12";
  onDeleted: () => void;
  onCancel: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego usunięcia (szybkie dwa kliknięcia)
  const usuwa = useRef(false);

  async function usun() {
    if (usuwa.current) return;
    usuwa.current = true;
    setPending(true);
    setBlad("");
    let wynik: ActionResult;
    try {
      wynik = item.sessionId
        ? await deleteSession(item.sessionId)
        : await skipTemplateOccurrence(item.templateId ?? "", item.date);
    } catch {
      wynik = { ok: false, message: BLAD_ZAPISU };
    } finally {
      usuwa.current = false;
      setPending(false);
    }
    if (!wynik.ok) {
      setBlad(wynik.message);
      return;
    }
    onDeleted();
  }

  // „„Długi bieg” · nd 15.11 · 09:00–10:30”
  const koniec = Math.min(item.startMin + item.durationMin, 1440);
  const godzina = (min: number) =>
    formatClockTime(Math.floor(min / 60), min % 60, clock);
  const [, mm, dd] = item.date.split("-");
  const opis = `„${item.title}” · ${DNI[weekdayOf(item.date)]} ${dd}.${mm} · ${godzina(item.startMin)}–${godzina(koniec)}`;

  return (
    <Dialog.Root
      open
      // W trakcie usuwania Esc i klik w tło nie zamykają okna
      onOpenChange={(otwarte) => !otwarte && !pending && onCancel()}
    >
      <Dialog.Portal>
        {/* .backdrop z coss.css na webie; telefon bez zmian */}
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/[.32] backdrop-blur-[4px] max-[799px]:bg-black/25 max-[799px]:backdrop-blur-none" />
        <Dialog.Content
          role="alertdialog"
          // Web: .dlg (promień 16 px, ramka border, cień pop) z .dlg-h i szarą stopką .dlg-f;
          // telefon: zwarta karta na środku jak dotąd
          className="fixed top-1/2 left-1/2 z-50 flex w-[min(400px,calc(100%-32px))] -translate-x-1/2 -translate-y-1/2 flex-col bg-white bg-clip-padding text-sm text-foreground outline-none min-[800px]:rounded-xl min-[800px]:border min-[800px]:border-border min-[800px]:shadow-pop max-[799px]:w-[min(360px,calc(100%-32px))] max-[799px]:gap-4 max-[799px]:rounded-xl max-[799px]:border max-[799px]:border-input max-[799px]:px-5 max-[799px]:pt-[18px] max-[799px]:pb-4 max-[799px]:shadow-[0_16px_48px_rgba(0,0,0,.16)]"
        >
          {/* .dlg-h z makiety: dolny odstęp 20 px (z błędem pod spodem 16 px) */}
          <div
            className={cn(
              "min-[800px]:px-6 min-[800px]:pt-6",
              blad ? "min-[800px]:pb-4" : "min-[800px]:pb-5",
            )}
          >
            <Dialog.Title className="m-0 text-base leading-[1.3] font-semibold min-[800px]:text-lg">
              Usunąć trening?
            </Dialog.Title>
            <Dialog.Description className="m-0 mt-1 text-[13px] text-muted-foreground min-[800px]:text-sm">
              {opis}
            </Dialog.Description>
          </div>
          {blad && (
            <p
              role="alert"
              className="m-0 text-xs text-destructive-foreground min-[800px]:px-6 min-[800px]:pb-4"
            >
              {blad}
            </p>
          )}
          {/* Web: stopka .dlg-f na szarym tle; telefon: przyciski 44 px */}
          <div className="flex justify-end gap-2 min-[800px]:rounded-b-[15px] min-[800px]:border-t min-[800px]:border-border min-[800px]:bg-black/[.025] min-[800px]:px-6 min-[800px]:py-4">
            <Button variant="ghost" disabled={pending} onClick={onCancel}>
              Anuluj
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => void usun()}
            >
              <Trash2Icon
                aria-hidden="true"
                className="size-4 max-[799px]:hidden"
              />
              Usuń
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
