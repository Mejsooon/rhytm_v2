import { Button } from "@/components/controls";
import type { FirstStep } from "./first-steps";

// Pusty ekran Dziś (EmptyToday.dc.html web, MToday.dc.html karty telefonu): jedna kolumna, te same karty.
export function EmptyToday({ name, steps }: { name: string; steps: { steps: FirstStep[]; doneCount: number } }) {
  const { steps: lista, doneCount } = steps;
  return (
    <div className="flex w-full max-w-[900px] flex-col gap-6 px-6 py-7 max-[799px]:gap-4 max-[799px]:px-4 max-[799px]:pt-3 max-[799px]:pb-6">
      <div>
        <h2 className="m-0 text-2xl font-semibold tracking-[-0.02em] max-[799px]:text-[22px]">
          Witaj w rhytm, {name}
        </h2>
        <p className="mt-1.5 text-[#666666] max-[799px]:text-[13px]">
          Cztery kroki i Dziś zacznie pokazywać Twój tydzień.
        </p>
      </div>

      <section className="overflow-hidden rounded-lg border border-[#eaeaea] bg-white max-[799px]:rounded-xl">
        <div className="flex items-center justify-between border-b border-[#eaeaea] px-4 py-3.5">
          <h3 className="m-0 text-[15px] font-semibold max-[799px]:text-[17px]">Pierwsze kroki</h3>
          <span className="font-mono text-xs text-[#666666]">{doneCount} / 4</span>
        </div>
        <div className="h-1 bg-[#f0f0f0]">
          <div className="h-1 bg-[#15803d]" style={{ width: `${(doneCount / 4) * 100}%` }} />
        </div>
        {lista.map((krok) => (
          <a
            key={krok.key}
            href={krok.href}
            className="flex min-h-[52px] items-center gap-3.5 border-b border-[#f0f0f0] px-4 py-3.5 no-underline last:border-b-0 hover:bg-[#fafafa] max-[799px]:min-h-[52px] max-[799px]:px-3.5"
          >
            {krok.done ? (
              <span
                aria-hidden="true"
                className="flex size-[22px] flex-none items-center justify-center rounded-full bg-[#15803d] text-xs text-white"
              >
                ✓
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="box-border size-[22px] flex-none rounded-full border border-[#d4d4d4]"
              />
            )}
            <span className="flex-1">
              <span
                className={
                  krok.done
                    ? "block font-medium text-[#6b6b6b] line-through"
                    : "block font-medium text-[#171717]"
                }
              >
                {krok.title}
              </span>
              {krok.hint && <span className="text-[13px] text-[#666666]">{krok.hint}</span>}
            </span>
            {!krok.done && (
              <span className="inline-flex items-center rounded-md border border-[#e0e0e0] bg-white px-3 py-[7px] text-sm text-[#171717] max-[799px]:min-h-11">
                Dodaj
              </span>
            )}
          </a>
        ))}
      </section>

      <section className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-[#eaeaea] bg-white px-4 py-8 text-center max-[799px]:rounded-xl">
        <div className="font-semibold">Plan dnia jest pusty</div>
        <p className="m-0 max-w-[380px] text-[#666666]">
          Bloki z kalendarza na dziś pojawią się tutaj jako oś czasu.
        </p>
        <Button asChild variant="secondary" className="mt-1.5 max-[799px]:w-full">
          <a href="/kalendarz">+ Nowy blok</a>
        </Button>
      </section>
    </div>
  );
}
