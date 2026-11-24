"use client";

import * as React from "react";
import { Lock, Search } from "lucide-react";

import { Button, StatusBadge } from "@/components/controls";
import { EmptyModule, ModuleHeader } from "@/components/shell/module-header";
import { SidebarToggle } from "@/components/shell/sidebar-toggle";
import type { LoadedPage } from "@/features/pages/load-page";
import { rowsForm } from "@/features/pages/rows-label";
import { PageTable } from "@/features/pages/table/page-table";
import { VaultBanner } from "@/features/vault/vault-banner";
import { useVault } from "@/features/vault/vault-provider";
import { VaultSetup } from "@/features/vault/vault-setup";
import { VaultUnlockCard } from "@/features/vault/vault-unlock-card";
import { cn } from "@/lib/utils";
import { CategoriesPopover } from "./categories-popover";

// Ekran modułu Hasła (S2Passwords / S2Vault / S2VaultSetup.dc.html): nagłówek z okruszkami „Moduły / Hasła”
// i „Zablokuj teraz”, plakietka „Szyfrowane” i tabela modułu. Stan sejfu:
// - brak: karta ustawiania hasła głównego zamiast tabeli (po „Anuluj” tabela tylko do odczytu i przycisk powrotu),
// - ladowanie: sama głowa strony, bez tabeli i bez nakładki (nie mignie tabela przed sprawdzeniem sejfu),
// - zablokowany (S2Vault): tabela tylko do odczytu (sekrety jako „zablokowane”) pod rozmyciem, a na środku okno
//   „Odblokuj sejf”; treść pod nakładką jest `inert` i `aria-hidden`, a wiersza tytułu z ikoną i „Hasła” nie ma
//   (decyzja C1: tytuł przeszkadzał Mejsonowi; okruszki w nagłówku zostają pod rozmyciem jak na makiecie),
// - odblokowany: tabela edytowalna i baner z odliczaniem,
// - nieobslugiwany: baner z komunikatem i tabela tylko do odczytu.
// Pasek nad tabelą (`moduleTools`): wyszukiwarka „Szukaj”, segment „Kategoria”, podpis „Kolumny modułu są stałe”
// i „Kategorie” (opcje Kategorii muszą iść przez ten sam magazyn co komórki tabeli). Wyszukiwanie i segment to
// tymczasowy stan klienta (nie jest zapisywany), a tabela stosuje go przez `moduleRowFilter`; działa po jawnych
// kolumnach Serwis, Login, URL i Kategoria (sekretów nie przeszukuje).
export function PasswordsView({ data }: { data: LoadedPage }) {
  const vault = useVault();
  const blok = data.blocks.find((b) => b.type === "table");
  // „Anuluj” w ustawianiu hasła głównego chowa formularz; po resecie (status wraca do „brak”) wraca on sam
  const [anulowano, setAnulowano] = React.useState(false);
  const [poprzedniStatus, setPoprzedniStatus] = React.useState(vault.status);
  if (poprzedniStatus !== vault.status) {
    setPoprzedniStatus(vault.status);
    if (vault.status !== "brak") setAnulowano(false);
  }

  // Tymczasowe zawężanie wierszy: fraza i id wybranej opcji Kategorii (null = „Wszystkie”)
  const [fraza, setFraza] = React.useState("");
  const [kategoriaId, setKategoriaId] = React.useState<string | null>(null);
  // Liczba haseł w tabeli (bez zawężania) do plakietki w nagłówku; start z danych serwera
  const [liczbaHasel, setLiczbaHasel] = React.useState(
    () => (blok?.rows ?? []).filter((r) => r.deletedAt === null).length,
  );

  const odblokowany = vault.status === "odblokowany";
  const ustawianie = vault.status === "brak" && !anulowano;
  const zablokowany = vault.status === "zablokowany";
  // Jeszcze nieznany stan sejfu: tabela ukryta (`hidden`), ale zamontowana, żeby po sprawdzeniu nie mignęła;
  // przy zamkniętym sejfie tabela jest widoczna (tylko do odczytu), a sekrety czyści sama tabela
  const bezTabeli = vault.status === "ladowanie";

  return (
    <div className="relative flex min-w-0 flex-1 flex-col">
      {/* Opakowanie zawsze to samo (tabela się nie przemontowuje po odblokowaniu); przy zamkniętym sejfie `inert` */}
      <div
        inert={zablokowany}
        aria-hidden={zablokowany ? "true" : undefined}
        className="flex min-w-0 flex-1 flex-col"
      >
        <ModuleHeader
          title="Hasła"
          webParent="Moduły"
          webAction={
            odblokowany && (
              <Button onClick={vault.lock}>
                <Lock aria-hidden="true" className="size-4" />
                Zablokuj teraz
              </Button>
            )
          }
        />
        {/* Treść na całą szerokość (decyzja Mejsona, jak S2Books) */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex w-full min-w-0 flex-col gap-5 px-6 py-7 max-[799px]:px-4 max-[799px]:py-4">
            <div>
              {/* Tytuł z ikoną tylko na webie (telefon ma duży tytuł w nagłówku) i tylko przy otwartym sejfie (C1) */}
              {!zablokowany && (
                <div className="mb-2.5 flex items-center gap-2.5 max-[799px]:hidden">
                  <Lock aria-hidden="true" className="size-[26px]" />
                  <p className="m-0 text-2xl font-semibold tracking-[-0.02em]">
                    Hasła
                  </p>
                </div>
              )}
              <div className="flex flex-wrap gap-1.5">
                {/* Odmiana: 1 hasło, 2–4 hasła, 5+ haseł (12–14 → haseł) */}
                <StatusBadge tone="gray" size="lg">
                  {liczbaHasel}{" "}
                  {
                    { one: "hasło", few: "hasła", many: "haseł" }[
                      rowsForm(liczbaHasel)
                    ]
                  }
                </StatusBadge>
                <StatusBadge tone="green" size="lg">
                  <Lock aria-hidden="true" className="size-3" />
                  Szyfrowane
                </StatusBadge>
              </div>
            </div>

            {(odblokowany || vault.status === "nieobslugiwany") && (
              <VaultBanner />
            )}

            {ustawianie && <VaultSetup onCancel={() => setAnulowano(true)} />}

            {!ustawianie && !blok && (
              <EmptyModule>
                Nie udało się wczytać tabeli haseł. Odśwież stronę.
              </EmptyModule>
            )}

            {!ustawianie && blok && (
              <div
                hidden={bezTabeli}
                className={cn(
                  "flex min-w-0 flex-col gap-5",
                  bezTabeli && "hidden",
                )}
              >
                {vault.status === "brak" && (
                  <div>
                    <Button
                      variant="primary"
                      onClick={() => setAnulowano(false)}
                    >
                      Ustaw hasło główne
                    </Button>
                  </div>
                )}
                <PageTable
                  block={blok}
                  today={data.today}
                  module="passwords"
                  onLiveRowCount={setLiczbaHasel}
                  moduleRowFilter={(wiersz, pola) => {
                    const nazwy = new Map(pola.map((f) => [f.name, f]));
                    const kategoria = nazwy.get("Kategoria");
                    // Wybrana opcja usunięta w „Kategorie”: segment wraca do „Wszystkie”
                    const istnieje =
                      kategoria?.config.options?.some(
                        (o) => o.id === kategoriaId,
                      ) ?? false;
                    if (
                      kategoriaId &&
                      istnieje &&
                      kategoria &&
                      wiersz.values[kategoria.id] !== kategoriaId
                    )
                      return false;
                    const szukana = fraza.trim().toLowerCase();
                    if (szukana === "") return true;
                    // Tylko jawne kolumny; sekretów (Hasło, Notatka) nie ruszamy
                    return ["Serwis", "Login", "URL"].some((nazwa) => {
                      const pole = nazwy.get(nazwa);
                      const wartosc = pole ? wiersz.values[pole.id] : null;
                      return (
                        typeof wartosc === "string" &&
                        wartosc.toLowerCase().includes(szukana)
                      );
                    });
                  }}
                  moduleTools={({
                    fields,
                    readOnly,
                    createOption,
                    removeOption,
                  }) => {
                    const kategoria = fields.find(
                      (f) => f.name === "Kategoria" && f.type === "select",
                    );
                    const opcje = kategoria?.config.options ?? [];
                    const wybrana = opcje.some((o) => o.id === kategoriaId)
                      ? kategoriaId
                      : null;
                    return (
                      <>
                        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                          <div className="flex h-8 w-[240px] max-w-full items-center gap-2 rounded-md border border-input bg-white px-[11px] text-muted-foreground shadow-xs focus-within:border-ring focus-within:shadow-halo max-[799px]:h-11 max-[799px]:w-full">
                            <Search
                              aria-hidden="true"
                              className="size-4 shrink-0"
                            />
                            <input
                              type="text"
                              value={fraza}
                              onChange={(e) => setFraza(e.target.value)}
                              placeholder="Szukaj serwisu lub loginu"
                              aria-label="Szukaj"
                              className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-faint-foreground"
                            />
                          </div>
                          <div
                            role="group"
                            aria-label="Kategoria"
                            className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-md bg-muted p-0.5 text-sm"
                          >
                            {[
                              { id: null, label: "Wszystkie" },
                              ...opcje.map((o) => ({
                                id: o.id as string | null,
                                label: o.label,
                              })),
                            ].map((o) => (
                              <button
                                key={o.id ?? "wszystkie"}
                                type="button"
                                aria-pressed={wybrana === o.id}
                                onClick={() => setKategoriaId(o.id)}
                                className={cn(
                                  "inline-flex h-7 cursor-pointer items-center justify-center rounded-[8px] border-0 px-2.5 font-medium whitespace-nowrap outline-none focus-visible:shadow-focus",
                                  wybrana === o.id
                                    ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.05)]"
                                    : "bg-transparent text-muted-foreground hover:text-foreground",
                                )}
                              >
                                {o.label}
                              </button>
                            ))}
                          </div>
                        </div>
                        <span className="text-[13px] text-muted-foreground">
                          Kolumny modułu są stałe
                        </span>
                        {kategoria && (
                          <CategoriesPopover
                            options={kategoria.config.options ?? []}
                            readOnly={readOnly}
                            onCreate={(etykieta) =>
                              createOption(kategoria, etykieta)
                            }
                            onRemove={(id) => removeOption(kategoria, id)}
                          />
                        )}
                      </>
                    );
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {zablokowany && (
        <>
          {/* Rozmycie jak S2Vault: biała zasłona 60% i blur 3 px na całym ekranie modułu */}
          <div
            aria-hidden="true"
            className="absolute inset-0 z-10 bg-white/60 backdrop-blur-[3px]"
          />
          {/* „Pokaż pasek boczny” nad zasłoną, w miejscu przycisku z nagłówka (ten jest pod `inert`): bez niego przy
              schowanym pasku i zamkniętym sejfie nie dałoby się wyjść z Haseł. Nagłówek: padding 10 px + (36 − 28) / 2 */}
          <div className="absolute top-3.5 left-6 z-20">
            <SidebarToggle placement="header" />
          </div>
          {/* Okno „Odblokuj sejf”: poza `inert`, pozycję nadaje rodzic */}
          <div className="absolute top-[160px] left-1/2 z-20 w-[min(400px,calc(100%-32px))] -translate-x-1/2 max-[799px]:top-6">
            <VaultUnlockCard />
          </div>
        </>
      )}
    </div>
  );
}
