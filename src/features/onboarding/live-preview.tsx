import { Card, StatusBadge } from "@/components/controls";
import { cn } from "@/lib/utils";
import { formatClockTime } from "@/lib/time/timezones";
import {
  categoriesForRoles,
  effectivePages,
  formatKm,
  type OnboardingDraft,
} from "./model";

// Kolory kategorii bierzemy z modelu (categoriesForRoles), tu tylko przykładowe bloki
// [godzina, minuta, tytuł, licznik]
const BL: Record<string, [number, number, string, string]> = {
  Studia: [8, 0, "Matematyka — ćwiczenia", "0/3"],
  Praca: [9, 0, "Praca — spotkanie zespołu", "1/2"],
  Projekty: [11, 0, "Projekt klienta", "2/4"],
  Sport: [17, 0, "Bieg 10 km", ""],
  Dom: [19, 0, "Zakupy i pranie", "0/2"],
};

// Zielony obrys podświetlanej części podglądu (HI z makiety: biała obwódka 2 px + zielony pierścień)
const OBRYS =
  "rounded-[10px] shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--success)]";

const DNI = [
  "Niedziela",
  "Poniedziałek",
  "Wtorek",
  "Środa",
  "Czwartek",
  "Piątek",
  "Sobota",
];
const MIESIACE = [
  "stycznia",
  "lutego",
  "marca",
  "kwietnia",
  "maja",
  "czerwca",
  "lipca",
  "sierpnia",
  "września",
  "października",
  "listopada",
  "grudnia",
];

// Dzisiejsza data kalendarzowa w strefie szkicu (rok, miesiąc 1–12, dzień)
function dataWStrefie(now: Date, timezone: string) {
  const czesci = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(now);
  const wez = (t: string) => Number(czesci.find((c) => c.type === t)?.value);
  return { y: wez("year"), m: wez("month"), d: wez("day") };
}

const dwie = (n: number) => String(n).padStart(2, "0");

// „16–22.11” albo „28.10–3.11”, dla bieżącego tygodnia
function zakresTygodnia(
  y: number,
  m: number,
  d: number,
  weekStart: "mon" | "sun",
) {
  const dzis = new Date(Date.UTC(y, m - 1, d));
  const dow = dzis.getUTCDay();
  const start = new Date(dzis);
  start.setUTCDate(d - ((dow - (weekStart === "mon" ? 1 : 0) + 7) % 7));
  const koniec = new Date(start);
  koniec.setUTCDate(start.getUTCDate() + 6);
  const miesiacKonca = dwie(koniec.getUTCMonth() + 1);
  if (start.getUTCMonth() === koniec.getUTCMonth()) {
    return `${start.getUTCDate()}–${koniec.getUTCDate()}.${miesiacKonca}`;
  }
  return `${start.getUTCDate()}.${dwie(start.getUTCMonth() + 1)}–${koniec.getUTCDate()}.${miesiacKonca}`;
}

function inicjaly(imie: string) {
  return imie
    .split(/\s+/)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function Awatar({
  inicjalyTekst,
  avatarUrl,
  className,
}: {
  inicjalyTekst: string;
  avatarUrl: string | null;
  className: string;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        className={cn("flex-none rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "grid flex-none place-items-center rounded-full bg-primary font-medium text-primary-foreground",
        className,
      )}
    >
      {inicjalyTekst}
    </span>
  );
}

// Podgląd aplikacji na żywo (prawa kolumna web). Ozdoba — treść jest w formularzu, więc aria-hidden.
export function LivePreview({
  draft,
  step,
  avatarUrl,
  now,
}: {
  draft: OnboardingDraft;
  step: number;
  avatarUrl: string | null;
  now: Date;
}) {
  const nazwa = draft.name.trim() || "Ty";
  const ini = inicjaly(nazwa);
  const kategorie = categoriesForRoles(draft.roles);
  const strony = effectivePages(draft);

  const bloki = kategorie
    .map((k) => {
      const [h, m, tytul, licznik] = BL[k.name];
      return {
        c: k.name,
        color: k.color,
        h,
        m,
        godzina: formatClockTime(h, m, draft.clock),
        tytul,
        licznik,
      };
    })
    .sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));

  const { y, m, d } = dataWStrefie(now, draft.timezone);
  const dzien = `${DNI[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]}, ${d} ${MIESIACE[m - 1]}`;
  const zakres = zakresTygodnia(y, m, d, draft.weekStart);
  const tydzien =
    "Tydzień " +
    (draft.weekStart === "sun" ? "od niedzieli" : "od poniedziałku") +
    ` · ${zakres} · zegar ${draft.clock === "12" ? "12 h" : "24 h"}`;

  // Kafelki bloku „Ten tydzień” z celów kroku 3 (wyłączony cel znika), same zera
  const kafelki: { label: string; value: string; of: string }[] = [];
  if (draft.workoutsOn)
    kafelki.push({
      label: "Treningi",
      value: "0",
      of: `/ ${Number.isFinite(draft.weeklyWorkouts) ? draft.weeklyWorkouts : "—"}`,
    });
  if (draft.kmOn)
    kafelki.push({
      label: "Bieg",
      value: "0,0",
      of: `/ ${Number.isFinite(draft.weeklyKm) ? formatKm(draft.weeklyKm) : "—"} km`,
    });
  kafelki.push({
    label: "Śr. sen",
    value: "—",
    of: `/ ${String(draft.sleepGoalMin / 60).replace(".", ",")} h`,
  });

  const pierwszy = bloki[0];
  const dymek = step === 6 && draft.notify.perm && draft.notify.before;

  const obrysProfil = step === 1;
  const obrysStrony = step === 5;
  const obrysCele = step === 3;
  const obrysKategorie = step === 2;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 overflow-hidden bg-black/[.025] tabular-nums"
    >
      <Card className="absolute inset-8 flex-row overflow-hidden text-[13px] shadow-lg">
        <div className="box-border flex w-[180px] flex-none flex-col gap-0.5 border-r border-border-soft bg-panel px-2 py-2.5">
          <div
            data-testid="pv-profile"
            data-highlighted={String(obrysProfil)}
            className={cn(
              "flex items-center gap-2 p-1.5",
              obrysProfil && OBRYS,
            )}
          >
            <Awatar
              inicjalyTekst={ini}
              avatarUrl={avatarUrl}
              className="size-6 text-[10px]"
            />
            <span className="flex min-w-0 flex-col leading-[1.3]">
              <span className="truncate font-medium whitespace-nowrap">
                {nazwa}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {draft.timezone}
              </span>
            </span>
          </div>
          <div className="px-2 pt-3 pb-1 text-[11px] font-medium text-muted-foreground">
            Moduły
          </div>
          <div className="flex h-7 items-center rounded-[8px] bg-black/[.05] px-2 font-medium">
            Dziś
          </div>
          {["Kalendarz", "Sport", "Nawyki i sen", "Hasła"].map((n) => (
            <div
              key={n}
              className="flex h-7 items-center px-2 font-medium text-soft-foreground"
            >
              {n}
            </div>
          ))}
          <div
            data-testid="pv-pages"
            data-highlighted={String(obrysStrony)}
            className={cn("mt-2 py-1", obrysStrony && OBRYS)}
          >
            <div className="px-2 pb-1 text-[11px] font-medium text-muted-foreground">
              Strony
            </div>
            {strony.map((p) => (
              <div
                key={p}
                className="flex h-7 items-center px-2 font-medium text-soft-foreground"
              >
                {p}
              </div>
            ))}
            {strony.length === 0 && (
              <div className="flex h-7 items-center px-2 text-faint-foreground">
                Brak stron
              </div>
            )}
          </div>
        </div>

        <div className="relative min-w-0 flex-1 p-4">
          <div className="text-[15px] font-semibold">{dzien}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{tydzien}</div>
          <div
            data-testid="pv-goals"
            data-highlighted={String(obrysCele)}
            className={cn("mt-3 p-1.5", obrysCele && OBRYS)}
          >
            <div className="flex items-baseline justify-between px-0.5 pb-1.5">
              <span className="text-xs font-semibold">Ten tydzień</span>
              <span className="text-[11px] text-muted-foreground">
                {zakres}
              </span>
            </div>
            <div className="grid grid-flow-col auto-cols-fr gap-1.5">
              {kafelki.map((k) => (
                <div
                  key={k.label}
                  data-testid="pv-goal"
                  className="min-w-0 rounded-[10px] border border-border bg-white px-2.5 pt-2 pb-[9px] shadow-xs"
                >
                  <div className="text-[11px] whitespace-nowrap text-muted-foreground">
                    {k.label}
                  </div>
                  <div className="mt-0.5 whitespace-nowrap">
                    <span className="text-[17px] font-semibold tracking-[-0.02em]">
                      {k.value}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {" "}
                      {k.of}
                    </span>
                  </div>
                  <div className="mt-[7px] grid grid-cols-7 gap-0.5">
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <span
                        key={i}
                        className="h-[3px] rounded-[2px] bg-black/[.08]"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div
            data-testid="pv-cats"
            data-highlighted={String(obrysKategorie)}
            className={cn(
              "mt-3 flex flex-wrap gap-1.5 p-1",
              obrysKategorie && OBRYS,
            )}
          >
            {kategorie.map((k) => (
              <StatusBadge key={k.name} tone="outline" size="lg">
                <span
                  className="size-2 flex-none rounded-full"
                  style={{ background: k.color }}
                />
                {k.name}
              </StatusBadge>
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-1.5">
            {bloki.map((b) => (
              <div
                key={b.c}
                data-testid="pv-block"
                className="flex items-stretch gap-2"
              >
                <span className="w-[54px] flex-none pt-2 text-xs text-muted-foreground">
                  {b.godzina}
                </span>
                <div
                  className="box-border flex h-[34px] flex-1 items-center justify-between gap-2 rounded-[8px] border px-2.5"
                  // CATEGORY_COLORS to 6-znakowe hexy, więc dopisek "12"/"4d" to alfa (#rrggbbaa)
                  style={{
                    background: b.color + "12",
                    borderColor: b.color + "4d",
                  }}
                >
                  <span className="font-medium">{b.tytul}</span>
                  <span className="text-xs text-soft-foreground">
                    {b.licznik}
                  </span>
                </div>
              </div>
            ))}
          </div>
          {dymek && (
            <div className="absolute top-4 right-4 box-border flex w-[250px] items-start gap-3 rounded-lg border border-border bg-white px-3 py-2.5 text-[13px] shadow-[0_0_0_2px_var(--background),0_0_0_4px_var(--success),0_10px_15px_-3px_rgba(0,0,0,.08)]">
              <span className="grid size-6 flex-none place-items-center rounded-md bg-primary">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <rect
                    x="4"
                    y="4"
                    width="11"
                    height="11"
                    rx="3"
                    fill="#ffffff"
                  />
                  <rect
                    x="18"
                    y="4"
                    width="11"
                    height="11"
                    rx="3"
                    fill="#ffffff"
                    opacity="0.55"
                  />
                  <rect
                    x="32"
                    y="4"
                    width="11"
                    height="11"
                    rx="3"
                    fill="#ffffff"
                    opacity="0.25"
                  />
                  <rect
                    x="4"
                    y="18"
                    width="11"
                    height="11"
                    rx="3"
                    fill="#ffffff"
                    opacity="0.55"
                  />
                  <rect
                    x="18"
                    y="18"
                    width="11"
                    height="11"
                    rx="3"
                    fill="#ffffff"
                    opacity="0.25"
                  />
                  <rect
                    x="32"
                    y="18"
                    width="11"
                    height="11"
                    rx="3"
                    fill="#4ade80"
                  />
                  <rect
                    x="4"
                    y="32"
                    width="11"
                    height="11"
                    rx="3"
                    fill="#ffffff"
                    opacity="0.25"
                  />
                  <rect
                    x="18"
                    y="32"
                    width="11"
                    height="11"
                    rx="3"
                    fill="#ffffff"
                  />
                  <rect
                    x="32"
                    y="32"
                    width="11"
                    height="11"
                    rx="3"
                    fill="#ffffff"
                    opacity="0.55"
                  />
                </svg>
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">
                  Za 10 min · {pierwszy ? pierwszy.tytul : "blok"}
                </span>
                <span className="text-muted-foreground">
                  Start o{" "}
                  {pierwszy
                    ? pierwszy.godzina
                    : formatClockTime(8, 0, draft.clock)}
                </span>
              </span>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
