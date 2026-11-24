"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Lock, Plus, Search, Settings } from "lucide-react";

import { Button, Card } from "@/components/controls";
import { useVault } from "@/features/vault/vault-provider";
import type { PageSummary } from "../load-pages";
import { PageIcon } from "../page-icon";
import { rowsLabel } from "../rows-label";

// Telefon: lista stron według CMPages — „Ulubione” tylko z ulubionymi, „Wszystkie strony” z resztą,
// „Hasła” (stały moduł) na górze. Dopisek: „N wierszy” albo „pusta strona” (strona bez tabeli).
// „Nowa strona” prowadzi do wyboru szablonu (/strony/nowa). Szukajka zostaje lokalnym filtrem stron (T15).
const IKONA_WIERSZA =
  "grid size-10 flex-none place-items-center rounded-[10px] border border-border bg-white shadow-xs";

export function MPages({ pages }: { pages: PageSummary[] }) {
  const sejf = useVault();
  const [fraza, setFraza] = React.useState("");

  const szukane = fraza.trim().toLowerCase();
  const pasujace = pages.filter((p) => {
    const tytul = p.title.trim() === "" ? "Bez tytułu" : p.title;
    return szukane === "" || tytul.toLowerCase().includes(szukane);
  });
  // Moduł Hasła zawsze na górze listy (poza sekcjami stron); fraza „has…” go zostawia
  const pokazHasla = szukane === "" || "hasła".includes(szukane);
  const ulubione = pasujace.filter((p) => p.favorite);
  const pozostale = pasujace.filter((p) => !p.favorite);

  // Dopisek przy Hasłach: stan sejfu z VaultProvider
  const stanSejfu =
    sejf.status === "odblokowany"
      ? "sejf · odblokowany"
      : sejf.status === "zablokowany"
        ? "sejf · zablokowany"
        : sejf.status === "brak"
          ? "sejf · nieustawiony"
          : sejf.status === "nieobslugiwany"
            ? "sejf · niedostępny"
            : "sejf";

  // Dwie sekcje mają ten sam układ wierszy, więc budujemy je z jednej tablicy opisów
  const sekcje = [
    { nazwa: "Ulubione", lista: ulubione },
    { nazwa: "Wszystkie strony", lista: pozostale },
  ];

  return (
    <div className="flex flex-1 flex-col min-[800px]:hidden">
      <header className="m-head py-1">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground">Twoje tabele i notatki</div>
          <h1 className="m-title truncate">Strony</h1>
        </div>
        <Button variant="ghost" icon asChild>
          <Link href="/ustawienia" aria-label="Ustawienia">
            <Settings size={20} aria-hidden="true" />
          </Link>
        </Button>
        <Button variant="ghost" icon asChild>
          <Link href="/strony/nowa" aria-label="Nowa strona">
            <Plus size={20} aria-hidden="true" />
          </Link>
        </Button>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 pt-3 pb-6">
        {/* .igroup 44 px: ikona + pole 16 px */}
        <label className="flex h-11 items-center gap-2 rounded-md border border-input bg-white px-[11px] text-muted-foreground shadow-xs transition-[box-shadow,border-color] duration-150 focus-within:border-ring focus-within:shadow-halo">
          <Search size={18} aria-hidden="true" className="flex-none" />
          <input
            type="search"
            value={fraza}
            onChange={(e) => setFraza(e.target.value)}
            placeholder="Szukaj stron i wierszy"
            aria-label="Szukaj stron"
            className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>

        {pokazHasla && (
          <Card className="overflow-hidden">
            <Link href="/hasla" className="m-row py-2 hover:bg-panel">
              <span aria-hidden="true" className={`${IKONA_WIERSZA} text-warning-foreground`}>
                <Lock size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">Hasła</span>
                <span className="text-xs text-muted-foreground tabular-nums">{stanSejfu}</span>
              </span>
              <ChevronRight size={16} aria-hidden="true" className="flex-none text-faint-foreground" />
            </Link>
          </Card>
        )}

        {sekcje.map(
          ({ nazwa, lista }) =>
            lista.length > 0 && (
              <section key={nazwa}>
                <div className="mb-2 text-xs font-medium text-muted-foreground">{nazwa}</div>
                <Card className="overflow-hidden">
                  {lista.map((strona) => (
                    <Link key={strona.id} href={`/strony/${strona.id}`} className="m-row py-2 hover:bg-panel">
                      <span
                        aria-hidden="true"
                        className={`${IKONA_WIERSZA} ${strona.templateKey === "subscriptions" ? "text-success" : "text-muted-foreground"}`}
                      >
                        <PageIcon icon={strona.icon} size={18} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {strona.title.trim() === "" ? "Bez tytułu" : strona.title}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          {(strona.templateKey === null || strona.templateKey === "empty") && strona.rowCount === 0
                            ? "pusta strona"
                            : rowsLabel(strona.rowCount)}
                        </span>
                      </span>
                      <ChevronRight size={16} aria-hidden="true" className="flex-none text-faint-foreground" />
                    </Link>
                  ))}
                </Card>
              </section>
            ),
        )}

        {szukane !== "" && pasujace.length === 0 && !pokazHasla && (
          <p className="m-0 text-center text-[13px] text-muted-foreground">Nic nie znaleziono.</p>
        )}

        {/* Przycisk przerywany 56 px: .btn z border-dashed i bez cienia */}
        <Button variant="secondary" asChild className="h-14 w-full border-dashed shadow-none max-[799px]:h-14">
          <Link href="/strony/nowa">
            <Plus size={18} aria-hidden="true" />
            Nowa strona
          </Link>
        </Button>
      </div>
    </div>
  );
}
