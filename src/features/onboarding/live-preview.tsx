import { cn } from "@/lib/utils";
import { formatClockTime } from "@/lib/time/timezones";
import {
  categoriesForRoles,
  effectivePages,
  type OnboardingDraft,
} from "./model";

// Stałe przepisane ze wspólnego skryptu makiet (Onboarding.dc.html, `pv`)
const CAT: Record<string, string> = {
  Studia: "#0070f3",
  Projekty: "#15803d",
  Praca: "#7c3aed",
  Sport: "#c2410c",
  Dom: "#a16207",
};
const TINT: Record<string, [string, string]> = {
  Studia: ["#eff6ff", "#bfdbfe"],
  Projekty: ["#f0fdf4", "#bbf7d0"],
  Praca: ["#f5f3ff", "#ddd6fe"],
  Sport: ["#fff7ed", "#fed7aa"],
  Dom: ["#fefce8", "#fde68a"],
};
// [godzina, minuta, tytuł, licznik]
const BL: Record<string, [number, number, string, string]> = {
  Studia: [8, 0, "Matematyka — ćwiczenia", "0/3"],
  Praca: [9, 0, "Praca — spotkanie zespołu", "1/2"],
  Projekty: [11, 0, "Projekt klienta", "2/4"],
  Sport: [17, 0, "Bieg 10 km", ""],
  Dom: [19, 0, "Zakupy i pranie", "0/2"],
};

// Zielony obrys podświetlanej części podglądu (HI z makiety)
const OBRYS = "rounded-lg shadow-[0_0_0_2px_#15803d]";

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
    // eslint-disable-next-line @next/next/no-img-element
    return (
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
        "grid flex-none place-items-center rounded-full bg-[#171717] font-medium text-white",
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
  const kategorie = categoriesForRoles(draft.roles).map((c) => c.name);
  const strony = effectivePages(draft);

  const bloki = kategorie
    .map((c) => {
      const [h, m, tytul, licznik] = BL[c];
      return {
        c,
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
  const tydzien =
    "Tydzień " +
    (draft.weekStart === "sun" ? "od niedzieli" : "od poniedziałku") +
    ` · ${zakresTygodnia(y, m, d, draft.weekStart)} · zegar ${draft.clock === "12" ? "12 h" : "24 h"}`;

  const pierwszy = bloki[0];
  const dymek = step === 6 && draft.notify.perm && draft.notify.before;

  const obrysProfil = step === 1;
  const obrysStrony = step === 3 || step === 5;
  const obrysKategorie = step === 2;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-8 flex overflow-hidden rounded-xl border border-[#e0e0e0] bg-white text-xs shadow-[0_8px_24px_rgba(0,0,0,0.06)]"
    >
      <div className="box-border flex w-44 flex-none flex-col gap-0.5 border-r border-[#eaeaea] bg-[#fafafa] px-2 py-3">
        <div
          data-testid="pv-profile"
          data-highlighted={String(obrysProfil)}
          className={cn("flex items-center gap-2 p-1.5", obrysProfil && OBRYS)}
        >
          <Awatar
            inicjalyTekst={ini}
            avatarUrl={avatarUrl}
            className="size-6 text-[10px]"
          />
          <span className="flex min-w-0 flex-col">
            <span className="truncate font-medium whitespace-nowrap">
              {nazwa}
            </span>
            <span className="text-[11px] text-[#737373]">{draft.timezone}</span>
          </span>
        </div>
        <div className="px-2 pt-3 pb-1 text-[11px] text-[#737373]">Moduły</div>
        <div className="flex h-7 items-center rounded-md bg-white px-2 font-medium shadow-[inset_0_0_0_1px_#eaeaea]">
          Dziś
        </div>
        {["Kalendarz", "Sport", "Nawyki i sen"].map((n) => (
          <div key={n} className="flex h-7 items-center px-2 text-[#525252]">
            {n}
          </div>
        ))}
        <div
          data-testid="pv-pages"
          data-highlighted={String(obrysStrony)}
          className={cn("mt-2 py-1", obrysStrony && OBRYS)}
        >
          <div className="px-2 pb-1 text-[11px] text-[#737373]">Strony</div>
          {strony.map((p) => (
            <div key={p} className="flex h-7 items-center px-2 text-[#525252]">
              {p}
            </div>
          ))}
          {strony.length === 0 && (
            <div className="flex h-7 items-center px-2 text-[#a3a3a3]">
              Brak stron
            </div>
          )}
        </div>
      </div>

      <div className="relative min-w-0 flex-1 p-4">
        <div className="text-sm font-medium">{dzien}</div>
        <div className="mt-0.5 text-[11px] text-[#737373]">{tydzien}</div>
        <div
          data-testid="pv-cats"
          data-highlighted={String(obrysKategorie)}
          className={cn(
            "mt-3 flex flex-wrap gap-1.5 p-1",
            obrysKategorie && OBRYS,
          )}
        >
          {kategorie.map((c) => (
            <span
              key={c}
              className="inline-flex h-6 items-center gap-1.5 rounded-md border border-[#eaeaea] bg-white px-2 text-[#404040]"
            >
              <span
                className="size-2 rounded-full"
                style={{ background: CAT[c] }}
              />
              {c}
            </span>
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-1.5">
          {bloki.map((b) => (
            <div
              key={b.c}
              data-testid="pv-block"
              className="flex items-stretch gap-2"
            >
              <span className="w-[52px] flex-none pt-1.5 font-mono text-[11px] text-[#737373]">
                {b.godzina}
              </span>
              <div
                className="box-border flex h-8 flex-1 items-center justify-between gap-2 rounded-md border px-2.5"
                style={{ background: TINT[b.c][0], borderColor: TINT[b.c][1] }}
              >
                <span className="font-medium">{b.tytul}</span>
                <span className="font-mono text-[11px] text-[#525252]">
                  {b.licznik}
                </span>
              </div>
            </div>
          ))}
        </div>
        {dymek && (
          <div className="absolute top-4 right-4 flex w-60 gap-2.5 rounded-[10px] border border-[#e0e0e0] bg-white px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.10)] outline-2 outline-offset-2 outline-[#15803d]">
            <span className="grid size-6 flex-none place-items-center rounded-md bg-[#171717]">
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
              <span className="text-[#525252]">
                Start o{" "}
                {pierwszy
                  ? pierwszy.godzina
                  : formatClockTime(8, 0, draft.clock)}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
