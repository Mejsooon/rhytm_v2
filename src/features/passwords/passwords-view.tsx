"use client";

import * as React from "react";
import { Lock } from "lucide-react";

import { Button, StatusBadge } from "@/components/controls";
import { EmptyModule, ModuleHeader } from "@/components/shell/module-header";
import type { LoadedPage } from "@/features/pages/load-page";
import { PageTable } from "@/features/pages/table/page-table";
import { VaultBanner } from "@/features/vault/vault-banner";
import { useVault } from "@/features/vault/vault-provider";
import { VaultSetup } from "@/features/vault/vault-setup";
import { VaultUnlockCard } from "@/features/vault/vault-unlock-card";
import { CategoriesPopover } from "./categories-popover";

// Ekran modułu Hasła (S2Passwords / S2Vault / S2VaultSetup.dc.html): nagłówek z okruszkami „Moduły / Hasła”
// i „Zablokuj teraz”, plakietka „Szyfrowane” i tabela modułu. Stan sejfu:
// - brak: karta ustawiania hasła głównego zamiast tabeli (po „Anuluj” tabela tylko do odczytu i przycisk powrotu),
// - zablokowany: tabela tylko do odczytu pod rozmytą warstwą z kartą „Odblokuj sejf”,
// - odblokowany: tabela edytowalna i baner z odliczaniem,
// - nieobslugiwany: baner z komunikatem i tabela tylko do odczytu.
// Podpis „Kolumny modułu są stałe” i „Kategorie” leżą na pasku tabeli (`moduleTools`), bo opcje Kategorii
// muszą iść przez ten sam magazyn co komórki tabeli.
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

  const odblokowany = vault.status === "odblokowany";
  const ustawianie = vault.status === "brak" && !anulowano;

  return (
    <>
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
      {/* Treść: max 1160 px; warstwa blokady zakrywa całą treść, karta stoi 160 px od góry (S2Vault) */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex w-full max-w-[1160px] min-w-0 flex-col gap-5 px-6 py-7 max-[799px]:px-4 max-[799px]:py-4">
          <div>
            {/* Tytuł z ikoną tylko na webie: telefon ma duży tytuł w nagłówku */}
            <div className="flex items-center gap-2.5 max-[799px]:hidden">
              <Lock aria-hidden="true" className="size-[26px]" />
              <p className="m-0 text-2xl font-semibold tracking-[-0.02em]">Hasła</p>
            </div>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <StatusBadge tone="green" size="lg">
                <Lock aria-hidden="true" className="size-3" />
                Szyfrowane
              </StatusBadge>
            </div>
          </div>

          {(odblokowany || vault.status === "nieobslugiwany") && <VaultBanner />}

          {ustawianie && <VaultSetup onCancel={() => setAnulowano(true)} />}

          {!ustawianie && !blok && <EmptyModule>Nie udało się wczytać tabeli haseł. Odśwież stronę.</EmptyModule>}

          {!ustawianie && blok && (
            <>
              {vault.status === "brak" && (
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
                moduleTools={({ fields, readOnly, createOption, removeOption }) => {
                  const kategoria = fields.find((f) => f.name === "Kategoria" && f.type === "select");
                  return (
                    <>
                      <span className="text-[13px] text-muted-foreground">Kolumny modułu są stałe</span>
                      {kategoria && (
                        <CategoriesPopover
                          options={kategoria.config.options ?? []}
                          readOnly={readOnly}
                          onCreate={(etykieta) => createOption(kategoria, etykieta)}
                          onRemove={(id) => removeOption(kategoria, id)}
                        />
                      )}
                    </>
                  );
                }}
              />
            </>
          )}
        </div>

        {vault.status === "zablokowany" && (
          <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/60 px-4 pt-40 backdrop-blur-[3px] max-[799px]:pt-16">
            <VaultUnlockCard />
          </div>
        )}
      </div>
    </>
  );
}
