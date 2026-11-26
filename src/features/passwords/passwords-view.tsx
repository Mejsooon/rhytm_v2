"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Lock, LockOpen, Plus } from "lucide-react";

import { Button, StatusBadge } from "@/components/controls";
import { EmptyModule, ModuleHeader } from "@/components/shell/module-header";
import type { LoadedPage } from "@/features/pages/load-page";
import { PageTable } from "@/features/pages/table/page-table";
import { BLOKADA_MS } from "@/features/vault/lock-timeout";
import { VaultBanner } from "@/features/vault/vault-banner";
import { useVault } from "@/features/vault/vault-provider";
import { VaultSetup } from "@/features/vault/vault-setup";
import { VaultUnlockCard } from "@/features/vault/vault-unlock-card";
import { cn } from "@/lib/utils";
import { MPasswords } from "./mobile/m-passwords";

// Ekran modułu Hasła (S2Passwords / S2Vault / S2VaultSetup.dc.html — warianty S2Table kind="passwords"):
// nagłówek z okruszkami „Moduły / Hasła”, „Zablokuj teraz” (tylko odblokowany) i „Nowe hasło”; pod nim tytuł
// „Hasła” z plakietką „Odblokowany · blokada po 5 min” i opis. Dalej zwykła tabela strony (zakładki widoków
// Praca / Studia / Prywatne, pasek z szukajką, grupowanie po Kategorii) w trybie modułu: stałe kolumny,
// w menu „⋯” „Zresetuj sejf…”, stopka „N haseł · sekrety nie są przeszukiwane”. Stan sejfu:
// - brak: tabela tylko do odczytu, a nad nią przyciemnienie i okno ustawiania hasła głównego (treść pod nim `inert`,
//   fokus w „Hasło główne”, Esc z dowolnego miejsca zamyka; po „Anuluj” przycisk „Ustaw hasło główne”);
//   telefon (CMVaultSetup): pełny ekran poza opakowaniem treści, a „Anuluj” prowadzi do listy stron,
// - ladowanie: sama głowa strony, bez tabeli i bez nakładki (nie mignie tabela przed sprawdzeniem sejfu),
// - telefon (CMVault, CMPasswords): przy „ladowanie” sam nagłówek z linkiem „Strony”, przy zablokowanym sejfie pełny
//   ekran „Sejf jest zablokowany” (bez tabeli pod rozmyciem), przy odblokowanym lista-akordeon `MPasswords` z tego samego
//   magazynu co tabela (prop `renderPhone`). Układy webu i telefonu są oba w DOM, przełącza je CSS (800 px),
// - zablokowany (S2Vault): tabela tylko do odczytu (sekrety jako „zablokowane”) pod rozmyciem, a na środku okno
//   „Odblokuj sejf”; treść pod nakładką jest `inert` i `aria-hidden`, a wiersza tytułu nie ma (decyzja C1),
// - odblokowany: tabela edytowalna,
// - nieobslugiwany: baner z komunikatem i tabela tylko do odczytu.
// Szukajka i chipy Kategorii telefonu to tymczasowy stan klienta (nie jest zapisywany); zawężają tylko listę telefonu,
// po jawnych kolumnach Serwis, Login i URL (sekretów nie przeszukują). Web szuka szukajką paska tabeli.
export function PasswordsView({ data }: { data: LoadedPage }) {
  const vault = useVault();
  const blok = data.blocks.find((b) => b.type === "table");
  // „Anuluj” w ustawianiu hasła głównego chowa okno; po resecie (status wraca do „brak”) wraca ono samo
  const [anulowano, setAnulowano] = React.useState(false);
  const [poprzedniStatus, setPoprzedniStatus] = React.useState(vault.status);
  if (poprzedniStatus !== vault.status) {
    setPoprzedniStatus(vault.status);
    if (vault.status !== "brak") setAnulowano(false);
  }

  // Telefon: tymczasowe zawężanie listy — fraza i id wybranej opcji Kategorii (null = „Wszystkie”)
  const [fraza, setFraza] = React.useState("");
  const [kategoriaId, setKategoriaId] = React.useState<string | null>(null);
  // „Nowe hasło” w nagłówku webu dodaje wiersz tą samą drogą co „Nowy wiersz” tabeli
  const nowyWierszRef = React.useRef<(() => void) | null>(null);

  const odblokowany = vault.status === "odblokowany";
  const ustawianie = vault.status === "brak" && !anulowano;
  const zablokowany = vault.status === "zablokowany";
  // Jeszcze nieznany stan sejfu: tabela ukryta (`hidden`), ale zamontowana, żeby po sprawdzeniu nie mignęła;
  // przy zamkniętym sejfie tabela jest widoczna (tylko do odczytu), a sekrety czyści sama tabela
  const bezTabeli = vault.status === "ladowanie";
  // Telefon bez tabeli: sam nagłówek (ładowanie) albo ekran blokady (zablokowany)
  const telefonBezTresci = vault.status === "ladowanie" || zablokowany;
  // Treść pod oknem (zamknięty sejf albo ustawianie hasła głównego) jest `inert` i `aria-hidden`
  const podOknem = zablokowany || ustawianie;

  // Esc zamyka okno ustawiania na webie z dowolnego miejsca (treść pod spodem jest inert, więc fokus bywa na body);
  // telefon ma pełny ekran z linkiem „Anuluj”, więc tam Esc nic nie robi
  React.useEffect(() => {
    if (!ustawianie) return;
    const naKlawisz = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (typeof window.matchMedia === "function" && !window.matchMedia("(min-width: 800px)").matches) return;
      setAnulowano(true);
    };
    document.addEventListener("keydown", naKlawisz);
    return () => document.removeEventListener("keydown", naKlawisz);
  }, [ustawianie]);
  const minuty = BLOKADA_MS / 60_000;

  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      {/* Telefon (CMVault): nagłówek z linkiem „Strony” bez tytułu i, przy zablokowanym sejfie, pełny ekran odblokowania */}
      {telefonBezTresci && (
        <div className="flex min-h-0 flex-1 flex-col min-[800px]:hidden">
          <header className="m-head px-2">
            <Button variant="ghost" icon asChild>
              <Link href="/strony" aria-label="Strony">
                <ChevronLeft size={20} aria-hidden="true" />
              </Link>
            </Button>
            <div className="flex-1" />
            <span aria-hidden="true" className="w-11 flex-none" />
          </header>
          {zablokowany && <VaultUnlockCard ekran />}
        </div>
      )}
      {/* Telefon, ustawianie hasła głównego (CMVaultSetup): nagłówek „Hasła” z linkiem „Strony” i pełny ekran,
          poza opakowaniem, które jest wtedy `inert` pod oknem webu */}
      {ustawianie && (
        <div className="flex min-h-0 flex-1 flex-col min-[800px]:hidden">
          <ModuleHeader title="Hasła" phoneOnly phoneBack={{ href: "/strony", label: "Strony" }} phoneCenterTitle />
          <div className="px-4 py-4">
            <VaultSetup ekran onCancel={() => setAnulowano(true)} />
          </div>
        </div>
      )}
      {/* Opakowanie zawsze to samo (tabela się nie przemontowuje po odblokowaniu); pod oknem (zamknięty sejf,
          ustawianie hasła głównego) `inert`. Telefon przy ładowaniu, zablokowanym sejfie i ustawianiu ma własny
          ekran powyżej, więc to opakowanie chowa */}
      <div
        inert={podOknem}
        aria-hidden={podOknem ? "true" : undefined}
        className={cn("flex min-w-0 flex-1 flex-col", (telefonBezTresci || ustawianie) && "max-[799px]:hidden")}
      >
        {/* Telefon ma własny nagłówek: w MPasswords (odblokowany: „Zablokuj sejf”, „Nowe hasło”) albo na ekranie
            ładowania i blokady powyżej. Web (S2Passwords .topbar): „Zablokuj teraz” i główny „Nowe hasło” */}
        <ModuleHeader
          title="Hasła"
          webParent="Moduły"
          webOnly={odblokowany || telefonBezTresci || ustawianie}
          phoneBack={{ href: "/strony", label: "Strony" }}
          phoneCenterTitle
          webAction={
            <>
              {odblokowany && (
                <Button onClick={vault.lock}>
                  <Lock aria-hidden="true" className="size-4" />
                  Zablokuj teraz
                </Button>
              )}
              <Button variant="primary" disabled={!odblokowany} onClick={() => nowyWierszRef.current?.()}>
                <Plus aria-hidden="true" className="size-4" />
                Nowe hasło
              </Button>
            </>
          }
        />
        {/* Treść na całą szerokość jak S2Table: 24 px dookoła, 16 px między sekcjami */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div
            className={cn(
              "flex w-full min-w-0 flex-col gap-4 px-6 pt-6 pb-10 max-[799px]:gap-5 max-[799px]:px-4 max-[799px]:py-4",
              // Lista telefonu (MPasswords) ma własne odstępy i nagłówek na całą szerokość
              odblokowany && "max-[799px]:p-0",
            )}
          >
            {/* Tytuł i opis tylko na webie (telefon ma tytuł w nagłówku albo w MPasswords); przy zamkniętym sejfie
                bez tytułu (C1, S2Vault) */}
            {!zablokowany && (
              <div className="max-[799px]:hidden">
                <div className="flex flex-wrap items-center gap-2.5">
                  <p className="m-0 text-2xl font-semibold tracking-[-0.02em]">Hasła</p>
                  {odblokowany && (
                    <StatusBadge tone="green">
                      <LockOpen aria-hidden="true" className="size-3" />
                      Odblokowany · blokada po {minuty} min
                    </StatusBadge>
                  )}
                </div>
                <p className="mt-1 mb-0 text-sm text-muted-foreground">
                  Zaszyfrowane w przeglądarce Twoim hasłem głównym.
                </p>
              </div>
            )}

            {vault.status === "nieobslugiwany" && <VaultBanner />}

            {!blok && (
              <EmptyModule>
                Nie udało się wczytać tabeli haseł. Odśwież stronę.
              </EmptyModule>
            )}

            {blok && (
              <div
                hidden={bezTabeli}
                className={cn("flex min-w-0 flex-col gap-4", bezTabeli && "hidden")}
              >
                {vault.status === "brak" && !ustawianie && (
                  <div>
                    <Button variant="primary" onClick={() => setAnulowano(false)}>
                      Ustaw hasło główne
                    </Button>
                  </div>
                )}
                <PageTable
                  block={blok}
                  today={data.today}
                  module="passwords"
                  templateKey="passwords"
                  title="Hasła"
                  newRowRef={nowyWierszRef}
                  // Telefon (CMPasswords): lista z tego samego magazynu co tabela, zawężona szukajką i chipami
                  // Kategorii telefonu (tylko jawne kolumny); poza odblokowanym sejfem nic
                  renderPhone={(api) => {
                    if (!odblokowany) return null;
                    const kategoria = api.fields.find((f) => f.name === "Kategoria" && f.type === "select");
                    // Wybrana opcja usunięta: chipy wracają do „Wszystkie”
                    const wybrana = kategoria?.config.options?.some((o) => o.id === kategoriaId) ? kategoriaId : null;
                    const szukana = fraza.trim().toLowerCase();
                    const jawne = ["Serwis", "Login", "URL"]
                      .map((nazwa) => api.fields.find((f) => f.name === nazwa && f.type !== "secret"))
                      .filter((f) => f !== undefined);
                    const wiersze = api.rows.filter((w) => {
                      if (wybrana && kategoria && w.values[kategoria.id] !== wybrana) return false;
                      if (szukana === "") return true;
                      return jawne.some((pole) => {
                        const wartosc = w.values[pole.id];
                        return typeof wartosc === "string" && wartosc.toLowerCase().includes(szukana);
                      });
                    });
                    return (
                      <MPasswords
                        fields={api.fields}
                        rows={wiersze}
                        fraza={fraza}
                        onFraza={setFraza}
                        kategoriaId={kategoriaId}
                        onKategoria={setKategoriaId}
                        onNewRow={api.newRow}
                        onEditRow={api.editRow}
                        onCreateOption={api.createOption}
                        onRemoveOption={api.removeOption}
                        planClipboardClear={api.planClipboardClear}
                      />
                    );
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ustawianie hasła głównego na webie (S2VaultSetup): przyciemnienie na całym oknie i okno 460 px, 96 px od góry
          modułu, nad tabelą tylko do odczytu */}
      {ustawianie && (
        <>
          <div aria-hidden="true" className="fixed inset-0 z-40 bg-black/[.32] max-[799px]:hidden" />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Ustaw hasło główne sejfu"
            className="absolute top-24 left-1/2 z-50 w-[min(460px,calc(100%-32px))] -translate-x-1/2 max-[799px]:hidden"
          >
            <VaultSetup onCancel={() => setAnulowano(true)} />
          </div>
        </>
      )}

      {zablokowany && (
        <>
          {/* Rozmycie jak S2Vault: biała zasłona 60% i blur 3 px na całym ekranie modułu */}
          <div
            aria-hidden="true"
            className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[3px] max-[799px]:hidden"
          />
          {/* Okno „Odblokuj sejf”: poza `inert`, pozycję nadaje rodzic */}
          <div className="absolute top-[160px] left-1/2 z-20 w-[min(400px,calc(100%-32px))] -translate-x-1/2 max-[799px]:hidden">
            <VaultUnlockCard />
          </div>
        </>
      )}
    </div>
  );
}
