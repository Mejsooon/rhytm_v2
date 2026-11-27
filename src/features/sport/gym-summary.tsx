"use client";

// Podsumowanie zakończonego treningu (S2GymSummary / CMGymSummary) — jedno drzewo (próg 800 px).
// „Zgodnie z planem” i „plan 4 × 5” pochodzą z obecnego szablonu; bez szablonu są ukryte.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Copy, Dumbbell, Layers, MoreHorizontal, Pencil, Trophy, X } from "lucide-react";

import { ActionPopover, Button, Card, DatePicker, FormDialog, MENU_ITEM, MENU_ITEM_DANGER, MENU_SEPARATOR, StatusBadge, TextField, type IsoDate } from "@/components/controls";
import { weekdayOf } from "@/features/calendar/view-range";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import { copyWorkout, saveSessionAsTemplate } from "./actions";
import { DeleteSessionDialog } from "./delete-session-dialog";
import { DNI, historiaZTreningiem } from "./gym-log";
import type { WorkoutData } from "./load-sport";
import {
  effectiveKg,
  epley1rm,
  firstReps,
  formatKg,
  formatSet,
  formatVolume,
  historyOrder,
  isBodyweightKind,
  kgVsLast,
  kindOf,
  plPlural,
  recordSetIds,
  sessionItems,
  sessionVolume,
  type GymSetRow,
} from "./model";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const DNI_DLUGIE = ["", "poniedziałek", "wtorek", "środa", "czwartek", "piątek", "sobota", "niedziela"];

export function GymSummary({ data, onEdit }: { data: WorkoutData; onEdit: () => void }) {
  const router = useRouter();
  const { session, profile } = data;
  const [menu, setMenu] = useState(false);
  const [okno, setOkno] = useState<"szablon" | "kopia" | "usun" | null>(null);
  const [nazwa, setNazwa] = useState(session.title);
  const [dzienKopii, setDzienKopii] = useState<IsoDate | null>(data.today);
  const [czeka, setCzeka] = useState(false);

  const data10 = session.start_local.slice(0, 10);
  const [rok, mm, dd] = data10.split("-");
  const minuty = (iso: string) => Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
  const czasMin = session.end_local ? Math.round((Date.parse(`${session.end_local}Z`) - Date.parse(`${session.start_local}Z`)) / 60000) : null;
  const zegar = (iso: string) => formatClockTime(Math.floor(minuty(iso) / 60), minuty(iso) % 60, profile.clock);
  const godziny = session.end_local ? `${zegar(session.start_local)}–${zegar(session.end_local)}` : zegar(session.start_local);
  const czas = czasMin === null ? "—" : czasMin < 60 ? `${czasMin} min` : `${Math.floor(czasMin / 60)} h ${String(czasMin % 60).padStart(2, "0")} min`;
  const szablon = data.templateName ? `z szablonu ${data.templateName}` : null;
  const powrot = `/sport?miesiac=${data10.slice(0, 7)}`;

  const historia = historiaZTreningiem(data, data.sets);
  const zMasaCiala = new Set(data.exercises.filter((e) => isBodyweightKind(kindOf(e))).map((e) => e.id));
  const objetosc = (serie: GymSetRow[]) => sessionVolume(serie, zMasaCiala, profile.weightKg);
  const zrobione = data.sets.filter((s) => s.done);

  // Porównanie z poprzednim zakończonym treningiem o tej samej nazwie
  const poprzedni = data.history
    .filter((h) => h.completed && h.title === session.title && h.sessionId !== session.id && historyOrder(h, { sessionId: session.id, startLocal: session.start_local }) < 0)
    .sort(historyOrder)
    .at(-1);
  const przedtem = poprzedni ? objetosc(poprzedni.sets) : 0;
  const procent = przedtem > 0 ? Math.round(((objetosc(zrobione) - przedtem) / przedtem) * 100) : null;

  const cwiczenia = [...new Set(zrobione.map((s) => s.exercise_id))].map((id) => {
    const e = data.exercises.find((x) => x.id === id);
    const kind = e ? kindOf(e) : ("wr" as const);
    const serie = zrobione.filter((s) => s.exercise_id === id);
    const wszystkie = data.sets.filter((s) => s.exercise_id === id);
    const pozycja = data.templateItems.find((i) => i.exercise_id === id);
    const cel = firstReps(pozycja?.reps_text ?? "");
    const bw = isBodyweightKind(kind);
    const rekordowe = recordSetIds(historia, id, bw, profile.weightKg);
    const rekord = serie.find((s) => rekordowe.has(s.id)) ?? null;
    const kg = rekord ? effectiveKg(rekord.weight_kg, bw, profile.weightKg) : null;
    return {
      id,
      name: e?.name ?? "",
      kind,
      serie,
      wszystkich: wszystkie.length,
      plan: pozycja ? `plan ${pozycja.sets_count} × ${pozycja.reps_text}` : null,
      zgodne: pozycja ? serie.filter((s) => cel === null || (s.reps ?? 0) >= cel).length : 0,
      rekord:
        rekord && kg !== null
          ? {
              opis: `${formatKg(kg)} kg × ${rekord.reps ?? 0}${rekord.reps ? ` · szac. 1RM ${formatKg(epley1rm(kg, rekord.reps))} kg` : ""}`,
              roznica: kgVsLast(historia, session.id, id, bw, profile.weightKg),
            }
          : null,
    };
  });
  const zPlanu = data.templateItems.length > 0 ? cwiczenia.reduce((a, c) => a + c.zgodne, 0) : null;
  const rekordy = cwiczenia.filter((c) => c.rekord);
  const kafle = [
    { k: "Czas", v: czas, dopisek: null, tone: "" },
    {
      k: "Objętość",
      v: `${formatVolume(objetosc(zrobione))} kg`,
      dopisek: procent === null ? null : `${procent > 0 ? "↑ " : procent < 0 ? "↓ " : ""}${Math.abs(procent)}% vs poprzedni`,
      tone: procent !== null && procent > 0 ? "text-success" : "",
    },
    { k: "Serie", v: String(zrobione.length), dopisek: zPlanu === null ? null : `${zPlanu} zgodnie z planem`, tone: "max-[799px]:hidden" },
    { k: "Trudność", v: session.difficulty === null ? "—" : `${session.difficulty} / 10`, dopisek: session.note ? `„${session.note}”` : null, tone: "max-[799px]:hidden" },
  ];

  async function wyslij(akcja: () => Promise<ActionResult>): Promise<ActionResult | null> {
    setCzeka(true);
    try {
      const wynik = await akcja();
      if (wynik.ok) return wynik;
      toast.error(wynik.message);
    } catch {
      toast.error(BLAD_ZAPISU);
    } finally {
      setCzeka(false);
    }
    return null;
  }
  async function skopiuj(date?: string) {
    const wynik = await wyslij(() => copyWorkout(session.id, date));
    if (!wynik?.ok || !wynik.id) return;
    setOkno(null);
    router.push(`/sport/trening/${wynik.id}`);
  }
  async function zapiszSzablon() {
    if (!(await wyslij(() => saveSessionAsTemplate(session.id, nazwa)))) return;
    setOkno(null);
    toast.success(`Zapisano szablon „${nazwa.trim()}”.`);
  }
  const wybierz = (co: "szablon" | "kopia" | "usun") => {
    setMenu(false);
    setOkno(co);
  };

  return (
    <div data-testid="gym" className="flex min-w-0 flex-col">
      <header className="flex min-h-[52px] items-center gap-2 border-b border-border px-2 py-1.5 min-[800px]:px-6">
        <Button variant="ghost" icon asChild className="min-[800px]:hidden">
          <Link href={powrot} aria-label="Wróć do Sportu">
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
        </Button>
        <nav aria-label="Okruszki" className="flex min-w-0 flex-1 items-center gap-1.5 text-muted-foreground max-[799px]:hidden">
          <Link href={powrot} className="text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:shadow-focus">
            Sport
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate font-medium text-foreground">{`${session.title} · ${DNI[weekdayOf(data10)]} ${dd}.${mm}`}</span>
        </nav>
        <span className="flex-1 min-[800px]:hidden" />
        <ActionPopover
          open={menu}
          onOpenChange={setMenu}
          align="end"
          width={220}
          className="p-1"
          ariaLabel="Więcej"
          trigger={
            <Button icon aria-label="Więcej">
              <MoreHorizontal size={16} aria-hidden="true" />
            </Button>
          }
        >
          <button
            type="button"
            className={cn(MENU_ITEM, "min-[800px]:hidden")}
            onClick={() => {
              setMenu(false);
              onEdit();
            }}
          >
            <Pencil size={16} aria-hidden="true" />
            Edytuj trening
          </button>
          <button type="button" className={MENU_ITEM} onClick={() => wybierz("szablon")}>
            <Layers size={16} aria-hidden="true" />
            Zapisz jako szablon
          </button>
          <button type="button" className={MENU_ITEM} onClick={() => wybierz("kopia")}>
            <Copy size={16} aria-hidden="true" />
            Duplikuj na inny dzień
          </button>
          <div className={MENU_SEPARATOR} />
          <button type="button" className={cn(MENU_ITEM, MENU_ITEM_DANGER)} onClick={() => wybierz("usun")}>
            <X size={16} aria-hidden="true" />
            Usuń trening
          </button>
        </ActionPopover>
        <Button onClick={onEdit} className="max-[799px]:hidden">
          <Pencil size={16} aria-hidden="true" />
          Edytuj
        </Button>
        <Button variant="primary" disabled={czeka} onClick={() => void skopiuj()} className="max-[799px]:hidden">
          Powtórz trening
        </Button>
      </header>

      <div className="box-border grid w-full items-start gap-4 p-4 min-[800px]:p-6 min-[1100px]:grid-cols-[minmax(0,1fr)_340px] min-[1100px]:gap-6">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <span aria-hidden="true" className="grid size-11 flex-none place-items-center rounded-[9px] bg-black/[.06] text-soft-foreground max-[799px]:hidden">
              <Dumbbell size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">{session.title}</h1>
              <div className="text-xs text-muted-foreground tabular-nums">
                {[`${DNI_DLUGIE[weekdayOf(data10)]} ${dd}.${mm}.${rok}`, godziny, szablon].filter(Boolean).join(" · ")}
              </div>
            </div>
            <StatusBadge tone="green" size="lg">
              ✓ zakończony
            </StatusBadge>
          </div>
          <div className="grid grid-cols-2 gap-2 min-[800px]:grid-cols-4 min-[800px]:gap-3">
            {kafle.map((k) => (
              <div key={k.k} className="flex min-w-0 flex-col gap-1.5 rounded-xl border border-border bg-white p-3 min-[800px]:px-4 min-[800px]:py-3.5">
                <span className="text-xs text-muted-foreground">{k.k}</span>
                <b data-testid={`kafel-${k.k}`} className="text-xl font-semibold tracking-[-0.02em] tabular-nums min-[800px]:text-2xl">
                  {k.v}
                </b>
                {k.dopisek && <span className={cn("truncate text-xs text-muted-foreground", k.tone)}>{k.dopisek}</span>}
              </div>
            ))}
          </div>

          {/* Telefon: zielony baner rekordu (na komputerze karta po prawej) */}
          {rekordy.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] px-3.5 py-3 min-[800px]:hidden">
              <Trophy size={20} aria-hidden="true" className="flex-none text-success" />
              <span className="min-w-0">
                <b className="block font-semibold">{`Nowy rekord: ${c.name}`}</b>
                <span className="block text-xs text-muted-foreground tabular-nums">{c.rekord?.opis}</span>
              </span>
            </div>
          ))}

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3.5">
              <h2 className="m-0 text-sm font-semibold">Ćwiczenia</h2>
              <span className="text-xs text-muted-foreground tabular-nums">{plPlural(cwiczenia.length, "ćwiczenie", "ćwiczenia", "ćwiczeń")}</span>
            </div>
            {cwiczenia.map((c) => (
              <div key={c.id} className="flex items-center gap-3 border-t border-black/[.06] px-4 py-3 min-[800px]:items-start">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/sport/cwiczenia/${c.id}`} className="font-medium text-foreground">
                      {c.name}
                    </Link>
                    {c.rekord && <StatusBadge tone="green">rekord</StatusBadge>}
                  </div>
                  {c.plan && <div className="text-xs text-muted-foreground tabular-nums">{c.plan}</div>}
                </div>
                <div className="flex max-w-[360px] flex-wrap justify-end gap-1 max-[799px]:hidden">
                  {c.serie.map((s) => (
                    <StatusBadge key={s.id} tone="gray" className="whitespace-nowrap tabular-nums">
                      {formatSet(s, c.kind) ?? "✓"}
                    </StatusBadge>
                  ))}
                </div>
                <span className="text-xs text-muted-foreground tabular-nums min-[800px]:hidden">{`${c.serie.length}/${c.wszystkich} serii`}</span>
                <ChevronRight size={16} aria-hidden="true" className="flex-none text-[#a3a3a3] min-[800px]:hidden" />
              </div>
            ))}
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          {rekordy.length > 0 && (
            <Card className="overflow-hidden max-[799px]:hidden">
              <h2 className="m-0 px-4 py-3.5 text-sm font-semibold">Rekordy z tego treningu</h2>
              {rekordy.map((c) => (
                <div key={c.id} className="flex items-center gap-3 border-t border-black/[.06] px-4 py-3">
                  <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-[9px] bg-[#f0fdf4] text-success">
                    <Trophy size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <b className="block font-medium">{c.name}</b>
                    <span className="block text-xs text-muted-foreground tabular-nums">{c.rekord?.opis}</span>
                  </span>
                  {!!c.rekord?.roznica && <span className="text-xs text-muted-foreground tabular-nums">{`+${formatKg(c.rekord.roznica)} kg`}</span>}
                </div>
              ))}
            </Card>
          )}
          {session.note && (
            <Card className="px-4 py-3.5">
              <h2 className="m-0 mb-2 text-sm font-semibold">Notatka</h2>
              <p className="m-0 leading-normal">{session.note}</p>
            </Card>
          )}
          {session.show_in_calendar && (
            <Card className="flex flex-col gap-2 px-4 py-3.5 max-[799px]:hidden">
              <h2 className="m-0 text-sm font-semibold">W kalendarzu</h2>
              <div className="rounded-lg border border-[#525252]/30 bg-[#525252]/[.08] px-2.5 py-1.5 text-[13px]">
                <b className="font-medium">{session.title}</b> <span className="text-xs text-muted-foreground tabular-nums">{godziny}</span>
              </div>
              <span className="text-xs text-muted-foreground">Trening widać w kalendarzu tylko do odczytu. Zmiany robisz w Sporcie.</span>
            </Card>
          )}
          <span className="text-xs text-muted-foreground min-[800px]:hidden">Trening widać w kalendarzu tylko do odczytu. Zmiany robisz w Sporcie.</span>
          <Button variant="primary" disabled={czeka} onClick={() => void skopiuj()} className="h-11 w-full justify-center min-[800px]:hidden">
            Powtórz trening
          </Button>
        </div>
      </div>

      <FormDialog
        open={okno === "szablon"}
        onOpenChange={(v) => !v && !czeka && setOkno(null)}
        title="Zapisz jako szablon"
        footer={
          <>
            <Button variant="ghost" disabled={czeka} onClick={() => setOkno(null)}>
              Anuluj
            </Button>
            <Button variant="primary" disabled={czeka || nazwa.trim() === ""} onClick={() => void zapiszSzablon()}>
              Zapisz
            </Button>
          </>
        }
      >
        <TextField label="Nazwa szablonu" value={nazwa} maxLength={60} onChange={(e) => setNazwa(e.target.value)} />
      </FormDialog>
      <FormDialog
        open={okno === "kopia"}
        onOpenChange={(v) => !v && !czeka && setOkno(null)}
        title="Duplikuj na inny dzień"
        footer={
          <>
            <Button variant="ghost" disabled={czeka} onClick={() => setOkno(null)}>
              Anuluj
            </Button>
            <Button variant="primary" disabled={czeka || !dzienKopii} onClick={() => void skopiuj(dzienKopii ?? undefined)}>
              Duplikuj
            </Button>
          </>
        }
      >
        <DatePicker value={dzienKopii} onChange={setDzienKopii} weekStart={profile.weekStart} today={data.today} ariaLabel="Dzień nowego treningu" />
      </FormDialog>
      {okno === "usun" && (
        <DeleteSessionDialog
          item={sessionItems([session], [])[0]}
          clock={profile.clock}
          onCancel={() => setOkno(null)}
          onDeleted={() => router.push(powrot)}
        />
      )}
    </div>
  );
}
