"use client";

// Okno szukania wg S2CommandK: nad bieżącym ekranem, ⌘K / Ctrl+K, strzałki i Enter.
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Dialog } from "radix-ui";

import { Kbd, MENU_LABEL } from "@/components/controls";
import { quickHref, type QuickAction } from "@/features/today/quick-request";
import { cn } from "@/lib/utils";
import { searchAll, type SearchGroup } from "./actions";
import { OPEN_SEARCH_EVENT } from "./open-search";

const KLUCZ_OSTATNIO = "rhytm_cmdk_ostatnio";
const MAX_OSTATNICH = 4;
const MIN_ZNAKOW = 2;
const OPOZNIENIE_MS = 250;

type Pozycja = {
  grupa: string;
  title: string;
  meta?: string;
  // Adres albo prośba o okno na Dziś
  href?: string;
  akcja?: QuickAction;
  tekst?: string;
  skrot?: string;
};

const PRZEJDZ: [string, string, string][] = [
  ["Dziś", "", "/dzis"],
  ["Kalendarz", "", "/kalendarz"],
  ["Sport", "", "/sport"],
  ["Nawyki i sen", "", "/nawyki"],
  ["Hasła", "sejf", "/hasla"],
  ["Archiwum nawyków", "", "/nawyki/archiwum"],
  ["Kosz", "usunięte strony · 30 dni", "/ustawienia/kosz"],
  ["Ustawienia", "", "/ustawienia/ogolne"],
];

const AKCJE: Pozycja[] = [
  { grupa: "Akcje", title: "Nowy blok", akcja: "blok" },
  { grupa: "Akcje", title: "Rozpocznij trening", meta: "siłownia", akcja: "trening" },
  { grupa: "Akcje", title: "Zapisz bieg", href: "/sport?nowy=bieg" },
  { grupa: "Akcje", title: "Dodaj aktywność", meta: "tenis, rower…", akcja: "aktywnosc" },
  { grupa: "Akcje", title: "Zapisz sen", href: "/nawyki?nowy=sen" },
  { grupa: "Akcje", title: "Nowy nawyk", akcja: "nawyk" },
  { grupa: "Akcje", title: "Nowa strona", href: "/strony/nowa" },
];

const IKONY: Record<string, [string, string]> = {
  Kalendarz: ["▦", ""],
  Sport: ["", "bg-black/[.06] text-[#404040]"],
  "Nawyki i sen": ["N", "bg-success-soft text-success"],
  "Przejdź do": ["→", ""],
  Akcje: ["+", ""],
};

function czytajOstatnie(): Pozycja[] {
  try {
    const zapis: unknown = JSON.parse(localStorage.getItem(KLUCZ_OSTATNIO) ?? "[]");
    return Array.isArray(zapis)
      ? zapis
          .filter((p): p is Pozycja => typeof p?.title === "string" && typeof p?.href === "string" && p.href.startsWith("/"))
          .slice(0, MAX_OSTATNICH)
      : [];
  } catch {
    return [];
  }
}

export function CommandMenu() {
  const [otwarte, setOtwarte] = React.useState(false);
  const sciezka = usePathname();

  React.useEffect(() => {
    function klawisz(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOtwarte((o) => !o);
      }
    }
    const otworz = (e: Event) => {
      e.preventDefault();
      setOtwarte(true);
    };
    window.addEventListener("keydown", klawisz);
    window.addEventListener(OPEN_SEARCH_EVENT, otworz);
    return () => {
      window.removeEventListener("keydown", klawisz);
      window.removeEventListener(OPEN_SEARCH_EVENT, otworz);
    };
  }, []);

  // Zmiana ekranu (np. „wstecz”) zamyka okno
  const [dla, setDla] = React.useState(sciezka);
  if (dla !== sciezka) {
    setDla(sciezka);
    setOtwarte(false);
  }

  return (
    <Dialog.Root open={otwarte} onOpenChange={setOtwarte}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/[.32] backdrop-blur-[4px] max-[799px]:backdrop-blur-none" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[12vh] left-1/2 z-50 flex max-h-[min(560px,76vh)] w-[min(640px,calc(100%-32px))] -translate-x-1/2 flex-col overflow-hidden rounded-xl border border-border bg-white bg-clip-padding text-sm text-foreground shadow-pop outline-none"
        >
          <Dialog.Title className="sr-only">Szukaj</Dialog.Title>
          {/* Zawartość montuje się przy otwarciu, więc każde otwarcie zaczyna od pustego pola */}
          <Wyniki zamknij={() => setOtwarte(false)} />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function Wyniki({ zamknij }: { zamknij: () => void }) {
  const router = useRouter();
  const listaId = React.useId();
  const [fraza, setFraza] = React.useState("");
  // Wynik razem z frazą, dla której powstał (stary wynik nie udaje nowego)
  const [wynik, setWynik] = React.useState<{ fraza: string; grupy: SearchGroup[]; blad?: boolean } | null>(null);
  const [wybrany, setWybrany] = React.useState(0);
  const [ostatnie] = React.useState(czytajOstatnie);
  const ostatniaFraza = React.useRef("");

  const przyciete = fraza.trim();
  const male = przyciete.toLowerCase();
  const aktualny = wynik?.fraza === przyciete ? wynik : null;

  React.useEffect(() => {
    ostatniaFraza.current = przyciete;
    if (przyciete.length < MIN_ZNAKOW) return;
    const timer = window.setTimeout(async () => {
      const odpowiedz = await searchAll(przyciete).catch(() => null);
      // Odpowiedź na nieaktualną frazę wyrzucamy
      if (ostatniaFraza.current !== przyciete) return;
      setWynik({ fraza: przyciete, grupy: odpowiedz?.ok ? odpowiedz.groups : [], blad: !odpowiedz?.ok });
    }, OPOZNIENIE_MS);
    return () => window.clearTimeout(timer);
  }, [przyciete]);

  const pasuje = (p: Pozycja) => `${p.title} ${p.meta ?? ""}`.toLowerCase().includes(male);
  const pozycje: Pozycja[] =
    przyciete === ""
      ? [
          ...ostatnie.map((p) => ({ ...p, grupa: "Ostatnio" })),
          { grupa: "Akcje", title: "Szybko dodaj…", meta: "bieg, blok, sen…", akcja: "dodaj" as const, skrot: "⌘⇧K" },
          ...AKCJE.slice(0, 4),
        ]
      : [
          ...(aktualny?.grupy.flatMap((g) => g.items.map((it) => ({ ...it, grupa: g.title }))) ?? []),
          ...PRZEJDZ.map(([title, meta, href]) => ({ grupa: "Przejdź do", title, meta, href })).filter(pasuje),
          ...AKCJE.filter(pasuje),
          { grupa: "Akcje", title: `Szybko dodaj „${przyciete}”`, akcja: "dodaj" as const, tekst: przyciete, skrot: "⌘⇧K" },
        ];
  const sel = Math.min(wybrany, Math.max(pozycje.length - 1, 0));
  // Czekamy na serwer: Enter nie może otworzyć akcji, zanim przyjdą wyniki
  const czeka = przyciete.length >= MIN_ZNAKOW && !aktualny;
  // „Brak wyników”: nic poza „Szybko dodaj”
  const komunikat = aktualny?.blad
    ? "Nie udało się wyszukać"
    : przyciete !== "" && !czeka && pozycje.length === 1
      ? "Brak wyników"
      : null;

  function otworz(p: Pozycja) {
    zamknij();
    if (p.akcja) {
      router.push(quickHref(p.akcja, p.tekst));
      return;
    }
    if (!p.href) return;
    if (p.grupa !== "Akcje") {
      const nowe = [
        { grupa: p.grupa, title: p.title, meta: p.meta, href: p.href },
        ...ostatnie.filter((o) => o.href !== p.href || o.title !== p.title),
      ].slice(0, MAX_OSTATNICH);
      try {
        localStorage.setItem(KLUCZ_OSTATNIO, JSON.stringify(nowe));
      } catch {
        // Tryb prywatny: „Ostatnio” zostaje puste
      }
    }
    router.push(p.href);
  }

  function naKlawisz(e: React.KeyboardEvent) {
    const n = pozycje.length;
    if (n === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const nowy = (sel + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      setWybrany(nowy);
      document.getElementById(`${listaId}-${nowy}`)?.scrollIntoView?.({ block: "nearest" });
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!czeka) otworz(pozycje[sel]);
    }
  }

  // Trafiony fragment pogrubiony
  function tytul(t: string) {
    const i = male ? t.toLowerCase().indexOf(male) : -1;
    if (i < 0) return t;
    return (
      <>
        {t.slice(0, i)}
        <b className="font-semibold">{t.slice(i, i + male.length)}</b>
        {t.slice(i + male.length)}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-none items-center gap-2 border-b border-border px-4">
        <Search size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
        <input
          autoFocus
          type="text"
          role="combobox"
          aria-expanded="true"
          aria-controls={listaId}
          aria-activedescendant={pozycje.length > 0 ? `${listaId}-${sel}` : undefined}
          aria-label="Szukaj"
          value={fraza}
          maxLength={80}
          onChange={(e) => {
            setFraza(e.target.value);
            setWybrany(0);
          }}
          onKeyDown={naKlawisz}
          placeholder="Szukaj stron, bloków, treningów i akcji…"
          className="h-12 min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-faint-foreground max-[799px]:text-base"
        />
        <Kbd>esc</Kbd>
      </div>
      <div id={listaId} role="listbox" aria-label="Wyniki" aria-busy={czeka} className="min-h-0 flex-1 overflow-y-auto p-1">
        {komunikat && <p className="m-0 px-2 py-3 text-center text-muted-foreground">{komunikat}</p>}
        {pozycje.map((p, i) => {
          const [znak, kolor] = IKONY[p.grupa] ?? ["", ""];
          return (
            <React.Fragment key={`${i}|${p.grupa}|${p.title}`}>
              {pozycje[i - 1]?.grupa !== p.grupa && (
                <div role="presentation" className={MENU_LABEL}>
                  {p.grupa}
                </div>
              )}
              <div
                id={`${listaId}-${i}`}
                role="option"
                aria-selected={i === sel}
                onMouseMove={() => setWybrany(i)}
                onClick={() => otworz(p)}
                className={cn("flex min-h-11 cursor-pointer items-center gap-2 rounded-sm px-2", i === sel && "bg-black/5")}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-6 flex-none items-center justify-center rounded-[7px] bg-black/5 text-xs font-semibold text-muted-foreground",
                    kolor,
                  )}
                >
                  {znak || Array.from(p.title)[0]?.toLocaleUpperCase("pl")}
                </span>
                <span className="min-w-0 flex-1 truncate">{tytul(p.title)}</span>
                {p.meta && <span className="max-w-[45%] truncate text-xs text-muted-foreground tabular-nums">{p.meta}</span>}
                {p.skrot && <Kbd>{p.skrot}</Kbd>}
                {i === sel && <Kbd>↵</Kbd>}
              </div>
            </React.Fragment>
          );
        })}
      </div>
      <div className="flex flex-none flex-wrap items-center gap-3 border-t border-border bg-black/[.025] px-4 py-2 text-xs text-muted-foreground">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> wybierz
        </span>
        <span>
          <Kbd>↵</Kbd> otwórz
        </span>
        <span className="ml-auto">hasła nie są przeszukiwane</span>
      </div>
    </>
  );
}
