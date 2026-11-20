import { Calendar, Plus } from "lucide-react";

import { Button, EmptyState, StatusBadge } from "@/components/controls";
import type { FirstStep } from "./first-steps";

// Pusty ekran Dziś (EmptyToday.dc.html web, MToday.dc.html karty telefonu): jedna kolumna, te same karty.
export function EmptyToday({
  name,
  steps,
}: {
  name: string;
  steps: { steps: FirstStep[]; doneCount: number };
}) {
  const { steps: lista, doneCount } = steps;
  return (
    <div className="flex w-full max-w-[900px] flex-col gap-6 px-6 py-7 max-[799px]:gap-4 max-[799px]:px-4 max-[799px]:pt-3 max-[799px]:pb-6">
      <div>
        <h2 className="m-0 text-2xl font-semibold tracking-[-0.02em] min-[800px]:leading-[normal] max-[799px]:text-[22px]">
          Witaj w rhytm, {name}
        </h2>
        <p className="mt-1.5 mb-0 text-muted-foreground min-[800px]:leading-[normal] max-[799px]:text-[13px]">
          Cztery kroki i Dziś zacznie pokazywać Twój tydzień.
        </p>
      </div>

      {/* CEmptyToday: .card z .card-h, paskiem .prog i listą pozycji .mi; telefon zostaje jak w MToday */}
      <section className="overflow-hidden rounded-xl border border-border bg-white bg-clip-padding shadow-[0_1px_2px_rgba(0,0,0,.05),inset_0_-1px_0_rgba(0,0,0,.04)]">
        <div className="flex items-center justify-between gap-3 px-6 pt-5 max-[799px]:border-b max-[799px]:border-border max-[799px]:px-4 max-[799px]:py-3.5">
          <h3 className="m-0 text-base leading-[1.3] font-semibold max-[799px]:text-[17px]">
            Pierwsze kroki
          </h3>
          <StatusBadge tone="gray" size="lg" className="tabular-nums">
            {doneCount} / 4
          </StatusBadge>
        </div>
        <div className="px-6 pt-3.5 pb-2 max-[799px]:p-0">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted max-[799px]:h-1 max-[799px]:rounded-none">
            <div
              className="h-full rounded-full bg-success max-[799px]:rounded-none"
              style={{ width: `${(doneCount / 4) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-0.5 px-3 pt-1 pb-3 max-[799px]:gap-0 max-[799px]:p-0">
          {lista.map((krok) => (
            <a
              key={krok.key}
              href={krok.href}
              className="flex min-h-14 items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground no-underline outline-none hover:bg-accent hover:text-foreground focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--ring)] max-[799px]:min-h-[52px] max-[799px]:gap-3.5 max-[799px]:rounded-none max-[799px]:border-b max-[799px]:border-border max-[799px]:px-3.5 max-[799px]:py-3.5 max-[799px]:last:border-b-0"
            >
              {krok.done ? (
                <span
                  aria-hidden="true"
                  className="flex size-5 flex-none items-center justify-center rounded-full bg-success text-[11px] text-white max-[799px]:size-[22px]"
                >
                  ✓
                </span>
              ) : (
                <span
                  aria-hidden="true"
                  className="size-5 flex-none rounded-full shadow-[inset_0_0_0_1.5px_rgba(0,0,0,.2)] max-[799px]:size-[22px]"
                />
              )}
              <span className="flex flex-1 flex-col">
                <span
                  className={
                    krok.done
                      ? "text-muted-foreground line-through"
                      : "font-medium text-foreground"
                  }
                >
                  {krok.title}
                </span>
                {krok.hint && (
                  <span className="text-[13px] text-muted-foreground">{krok.hint}</span>
                )}
              </span>
              {!krok.done && (
                // Wygląd .btn.sm (cały wiersz jest linkiem)
                <span className="inline-flex h-7 flex-none items-center rounded-md border border-input bg-white bg-clip-padding px-[9px] text-sm leading-none font-medium text-foreground shadow-[0_1px_2px_rgba(0,0,0,.05),inset_0_-1px_0_rgba(0,0,0,.04)] max-[799px]:h-11">
                  Dodaj
                </span>
              )}
            </a>
          ))}
        </div>
      </section>

      {/* Karta z przerywaną ramką bez cienia i pustym stanem .empty */}
      <section className="rounded-xl border border-dashed border-border bg-white">
        <EmptyState
          icon={<Calendar size={16} aria-hidden="true" />}
          title="Plan dnia jest pusty"
          description="Bloki z kalendarza na dziś pojawią się tutaj jako oś czasu."
          className="px-6 py-10 max-[799px]:px-4 max-[799px]:py-8 [&>p:first-of-type]:mt-1 [&>p:first-of-type]:text-sm [&>p:last-of-type]:max-w-[380px]"
        >
          <Button
            asChild
            variant="secondary"
            className="mt-2 max-[799px]:w-full"
          >
            <a href="/kalendarz">
              <Plus size={16} aria-hidden="true" />
              {/* „+” zostaje w nazwie dostępnej linku, widać ikonę */}
              <span className="sr-only">+</span>
              {" Nowy blok"}
            </a>
          </Button>
        </EmptyState>
      </section>
    </div>
  );
}
