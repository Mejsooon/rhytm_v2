// Podgląd aplikacji na żywo (prawa kolumna web, S2OnboardingFlow). Ozdoba — treść jest w formularzu, więc aria-hidden.
import { Card, StatusBadge } from "@/components/controls";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import {
  blockValid,
  categoriesForUses,
  CATEGORY_COLORS,
  pagesForUses,
  toMinutes,
  type OnboardingDraft,
  type Step,
} from "./model";

// Zielony obrys podświetlanej części podglądu (HI z makiety)
const OBRYS = "rounded-[10px] shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--success)]";

const NAZWY_STRON = { Subscriptions: "Subskrypcje", Projects: "Projekty", Books: "Książki" };

export function LivePreview({
  draft,
  step,
  avatarUrl,
  now,
}: {
  draft: OnboardingDraft;
  step: Step;
  avatarUrl: string | null;
  now: Date;
}) {
  const nazwa = draft.name.trim() || "Ty";
  const inicjaly = nazwa
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const dzien = new Intl.DateTimeFormat("pl-PL", {
    timeZone: draft.timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const strony = pagesForUses(draft.uses);
  const godzina = (min: number) => formatClockTime(Math.floor(min / 60), min % 60, draft.clock);
  const bloki = draft.blocks
    .filter((b) => b.saved || blockValid(b))
    .map((b) => ({ ...b, od: toMinutes(b.start) ?? 0 }))
    .sort((a, b) => a.od - b.od);
  const pierwszy = bloki[0];
  const dymek = step === 4 && draft.notify.perm && draft.notify.before && pierwszy;

  return (
    <div aria-hidden="true" className="absolute inset-0 overflow-hidden bg-black/[.025] tabular-nums">
      <Card className="absolute inset-8 flex-row overflow-hidden text-[13px] shadow-lg">
        <div className="box-border flex w-[180px] flex-none flex-col gap-0.5 border-r border-border-soft bg-panel px-2 py-2.5">
          <div data-testid="pv-profile" className={cn("flex items-center gap-2 p-1.5", step === 1 && OBRYS)}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt="" className="size-6 flex-none rounded-full object-cover" />
            ) : (
              <span className="grid size-6 flex-none place-items-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                {inicjaly}
              </span>
            )}
            <span className="flex min-w-0 flex-col leading-[1.3]">
              <span className="truncate font-medium">{nazwa}</span>
              <span className="truncate text-[11px] text-muted-foreground">{draft.timezone}</span>
            </span>
          </div>
          <div data-testid="pv-pages" className={cn("mt-1 py-1", step === 2 && OBRYS)}>
            <div className="px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">Moduły</div>
            {["Dziś", "Kalendarz", "Sport", "Nawyki i sen", "Hasła"].map((m, i) => (
              <div key={m} className={cn("flex h-7 items-center rounded-[8px] px-2 font-medium", i === 0 ? "bg-black/[.05]" : "text-soft-foreground")}>
                {m}
              </div>
            ))}
            <div className="px-2 pt-2 pb-1 text-[11px] font-medium text-muted-foreground">Strony</div>
            {strony.map((p) => (
              <div key={p} className="flex h-7 items-center px-2 font-medium text-soft-foreground">
                {NAZWY_STRON[p]}
              </div>
            ))}
            {strony.length === 0 && <div className="flex h-7 items-center px-2 text-faint-foreground">brak</div>}
          </div>
        </div>

        <div className="relative min-w-0 flex-1 p-4">
          <div className="text-[15px] font-semibold">Dzień dobry, {nazwa}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {dzien} · tydzień od {draft.weekStart === "mon" ? "pon." : "niedz."} · {draft.clock} h
          </div>
          <div data-testid="pv-cats" className={cn("mt-3 flex flex-wrap gap-1.5 p-1", step === 2 && OBRYS)}>
            {categoriesForUses(draft.uses).map((k) => (
              <StatusBadge key={k.name} tone="outline" size="lg">
                <span className="size-1.5 flex-none rounded-full" style={{ background: k.color }} />
                {k.name}
              </StatusBadge>
            ))}
          </div>
          <div className={cn("mt-3 flex flex-col gap-1.5 p-1", step === 3 && OBRYS)}>
            {bloki.map((b, i) => (
              <div key={`${i}|${b.title}`} data-testid="pv-block" className="flex items-stretch gap-2">
                <span className="w-[54px] flex-none pt-2 text-xs text-muted-foreground">{godzina(b.od)}</span>
                <div
                  className="box-border flex h-[34px] flex-1 items-center justify-between gap-2 rounded-[8px] border px-2.5"
                  // CATEGORY_COLORS to 6-znakowe hexy, więc dopisek to alfa (#rrggbbaa)
                  style={{ background: CATEGORY_COLORS[b.category] + "14", borderColor: CATEGORY_COLORS[b.category] + "55" }}
                >
                  <span className="truncate font-medium">{b.title}</span>
                  <span className="text-xs text-soft-foreground">{b.category}</span>
                </div>
              </div>
            ))}
            {bloki.length === 0 && (
              <div className="py-2 text-xs text-muted-foreground">Pusty dzień. W kroku 3 dodasz pierwsze bloki.</div>
            )}
          </div>
          {dymek && (
            <div
              data-testid="pv-toast"
              className="absolute top-4 right-4 flex w-[230px] flex-col gap-0.5 rounded-lg border border-border bg-white px-3 py-2.5 shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--success),0_10px_15px_-3px_rgba(0,0,0,.08)]"
            >
              <span className="font-medium">Za 5 min · {pierwszy.title}</span>
              <span className="text-muted-foreground">Start o {godzina(pierwszy.od)}</span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
