"use client";

// Ekran Szukaj (CMSearch): jedno drzewo dla telefonu i webu, różnice załatwia CSS (800 px).
// Telefon: pole z lupą i „Anuluj” w nagłówku, pole dostaje fokus po wejściu. Web: samo pole (max 480 px)
// pod nagłówkiem modułu. Wyniki, „Ostatnio” i szybkie akcje wyglądają tak samo.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Clock,
  Moon,
  Pencil,
  Plus,
  Search,
  Table2,
} from "lucide-react";
import { toast } from "sonner";

import { Button, Card, Chip, EmptyState } from "@/components/controls";
import { searchAll, type SearchGroup } from "./actions";

const KLUCZ_OSTATNIO = "rhytm_szukaj_ostatnio";
const MAX_OSTATNICH = 5;
const MIN_ZNAKOW = 2;
const OPOZNIENIE_MS = 250;

// Szybkie akcje z makiety CMSearch; adresy otwierają odpowiednie okno w module
const SZYBKIE_AKCJE = [
  { href: "/dzis?szybko=blok", etykieta: "Nowe zadanie lub blok", ikona: Plus },
  { href: "/sport?nowy=bieg", etykieta: "Zapisz bieg", ikona: Pencil },
  { href: "/nawyki?nowy=sen", etykieta: "Wpis snu", ikona: Moon },
  { href: "/strony/nowa", etykieta: "Nowa strona", ikona: Table2 },
];

export function SearchView() {
  const router = useRouter();
  const poleRef = useRef<HTMLInputElement>(null);
  const [fraza, setFraza] = useState("");
  // Wynik razem z frazą, dla której powstał (stary wynik nie udaje nowego)
  const [wynik, setWynik] = useState<{ fraza: string; grupy: SearchGroup[] } | null>(null);
  const [ostatnio, setOstatnio] = useState<string[]>([]);
  // Ostatnia fraza wysłana do wyszukiwania; odpowiedź na starszą jest odrzucana
  const ostatniaFraza = useRef("");

  const przyciete = fraza.trim();
  const aktywna = przyciete.length >= MIN_ZNAKOW;

  // „Ostatnio” z localStorage czytamy po montażu (serwer go nie ma, więc pierwszy render jest pusty)
  useEffect(() => {
    try {
      const zapis: unknown = JSON.parse(localStorage.getItem(KLUCZ_OSTATNIO) ?? "[]");
      if (Array.isArray(zapis)) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- odczyt zewnętrznego magazynu po montażu
        setOstatnio(zapis.filter((x): x is string => typeof x === "string").slice(0, MAX_OSTATNICH));
      }
    } catch {
      // Uszkodzony zapis albo zablokowany magazyn: „Ostatnio” zostaje puste
    }
  }, []);

  // Fokus tylko na telefonie (szerokość sprawdzamy po montażu, nie w renderze — bez migania po hydratacji)
  useEffect(() => {
    if (
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 799px)").matches
    ) {
      poleRef.current?.focus();
    }
  }, []);

  // Wpisywanie: po 250 ms ciszy pytamy serwer; zmiana frazy anuluje poprzedni timer
  useEffect(() => {
    if (przyciete.length < MIN_ZNAKOW) {
      ostatniaFraza.current = "";
      return;
    }
    const timer = window.setTimeout(async () => {
      ostatniaFraza.current = przyciete;
      let odpowiedz: Awaited<ReturnType<typeof searchAll>>;
      try {
        odpowiedz = await searchAll(przyciete);
      } catch {
        if (ostatniaFraza.current === przyciete) toast.error("Nie udało się wyszukać");
        return;
      }
      // Odpowiedź na nieaktualną frazę (użytkownik pisał dalej albo wyczyścił pole) wyrzucamy
      if (ostatniaFraza.current !== przyciete) return;
      if (!odpowiedz.ok) {
        toast.error("Nie udało się wyszukać");
        return;
      }
      setWynik({ fraza: przyciete, grupy: odpowiedz.groups });
      // Do „Ostatnio” trafiają tylko frazy, które coś znalazły; bez duplikatów, najnowsza pierwsza
      if (odpowiedz.groups.length > 0) {
        setOstatnio((poprzednie) => {
          const nowe = [
            przyciete,
            ...poprzednie.filter((f) => f.toLowerCase() !== przyciete.toLowerCase()),
          ].slice(0, MAX_OSTATNICH);
          try {
            localStorage.setItem(KLUCZ_OSTATNIO, JSON.stringify(nowe));
          } catch {
            // Brak miejsca albo tryb prywatny: lista żyje tylko w pamięci
          }
          return nowe;
        });
      }
    }, OPOZNIENIE_MS);
    return () => window.clearTimeout(timer);
  }, [przyciete]);

  // „Anuluj”: wstecz, a bez historii (nowa karta) na Dziś
  function anuluj() {
    if (window.history.length > 1) router.back();
    else router.push("/dzis");
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col bg-[#fafafa] min-[800px]:bg-transparent">
      {/* Nagłówek telefonu: m-head bez ramki; web: samo pole z odstępem */}
      <header className="m-head gap-2 border-b-0 bg-transparent pr-2 pl-4 min-[800px]:min-h-0 min-[800px]:justify-start min-[800px]:px-6 min-[800px]:pt-4">
        {/* .igroup 44 px: lupa + pole 16 px */}
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-white px-[11px] text-muted-foreground shadow-xs transition-[box-shadow,border-color] duration-150 focus-within:border-ring focus-within:shadow-halo min-[800px]:max-w-[480px] min-[800px]:flex-none min-[800px]:basis-full">
          <Search size={18} aria-hidden="true" className="flex-none" />
          <input
            ref={poleRef}
            type="search"
            value={fraza}
            maxLength={80}
            onChange={(e) => setFraza(e.target.value)}
            placeholder="Szukaj w rhytm"
            aria-label="Szukaj"
            className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <Button variant="ghost" onClick={anuluj} className="min-[800px]:hidden">
          Anuluj
        </Button>
      </header>

      <div
        aria-busy={aktywna && wynik?.fraza !== przyciete}
        className="flex flex-col gap-4 px-4 pt-2 pb-6 min-[800px]:max-w-[640px] min-[800px]:px-6"
      >
        {!aktywna && (
          <>
            {ostatnio.length > 0 && (
              <section className="flex flex-col gap-2">
                <span className="text-xs font-medium text-muted-foreground">Ostatnio</span>
                <div className="flex flex-wrap gap-2">
                  {ostatnio.map((f) => (
                    <Chip key={f} onClick={() => setFraza(f)}>
                      <Clock size={14} aria-hidden="true" className="text-muted-foreground" />
                      {f}
                    </Chip>
                  ))}
                </div>
              </section>
            )}
            <section className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">Szybkie akcje</span>
              <Card className="overflow-hidden">
                {SZYBKIE_AKCJE.map((a) => (
                  <Link key={a.href} href={a.href} className="m-row hover:bg-panel">
                    <a.ikona size={18} aria-hidden="true" className="flex-none text-muted-foreground" />
                    <span className="flex-1">{a.etykieta}</span>
                  </Link>
                ))}
              </Card>
            </section>
          </>
        )}

        {aktywna &&
          wynik?.grupy.map((g) => (
            <section key={g.title} className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">{g.title}</span>
              <Card className="overflow-hidden">
                {g.items.map((it) => (
                  <Link key={`${it.href}|${it.title}|${it.meta}`} href={it.href} className="m-row min-h-[52px] hover:bg-panel">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{it.title}</span>
                      <span className="block truncate text-xs text-muted-foreground tabular-nums">{it.meta}</span>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" className="flex-none text-faint-foreground" />
                  </Link>
                ))}
              </Card>
            </section>
          ))}

        {/* Pusty stan tylko dla wyniku aktualnej frazy (stary wynik nie miga komunikatem) */}
        {aktywna && wynik?.fraza === przyciete && wynik.grupy.length === 0 && (
          <EmptyState
            icon={<Search size={20} aria-hidden="true" />}
            title={`Nic nie znaleziono dla „${przyciete}”`}
            titleClassName="text-sm font-normal text-muted-foreground"
          />
        )}
      </div>
    </div>
  );
}
