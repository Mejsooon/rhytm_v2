"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronRight, Plus, Search, Settings } from "lucide-react";

import { MonoLabel } from "@/components/controls";
import { useCreateBlankPage } from "../use-create-blank-page";
import type { PageSummary } from "../load-pages";
import { rowsLabel } from "../rows-label";

// Telefon: lista stron (MPages.dc.html) — „Ulubione” tylko z ulubionymi, „Wszystkie strony” z resztą.
// Dopisek: „N wierszy” albo „pusta strona” (strona bez tabeli). Wiersze prowadzą do /strony/[id].
export function MPages({ pages }: { pages: PageSummary[] }) {
  const nowaStrona = useCreateBlankPage();
  const [fraza, setFraza] = React.useState("");

  const szukane = fraza.trim().toLowerCase();
  const pasujace = pages.filter((p) => {
    const tytul = p.title.trim() === "" ? "Bez tytułu" : p.title;
    return szukane === "" || tytul.toLowerCase().includes(szukane);
  });
  const ulubione = pasujace.filter((p) => p.favorite);
  const pozostale = pasujace.filter((p) => !p.favorite);

  // Dwie sekcje mają ten sam układ wierszy, więc budujemy je z jednej tablicy opisów
  const sekcje = [
    { nazwa: "Ulubione", lista: ulubione },
    { nazwa: "Wszystkie strony", lista: pozostale },
  ];

  return (
    <div className="flex flex-1 flex-col min-[800px]:hidden">
      <header className="flex min-h-[60px] items-center gap-1 pt-2 pr-2 pb-1 pl-4">
        <div className="min-w-0 flex-1">
          <MonoLabel className="block">Twoje tabele i notatki</MonoLabel>
          <h1 className="mt-0.5 text-[28px] font-semibold tracking-[-0.02em]">Strony</h1>
        </div>
        <Link
          href="/ustawienia"
          aria-label="Ustawienia"
          className="inline-flex size-11 flex-none items-center justify-center rounded-[10px] text-[#171717] hover:bg-[#f5f5f5]"
        >
          <Settings size={21} aria-hidden="true" />
        </Link>
        <button
          type="button"
          aria-label="Nowa strona"
          onClick={nowaStrona}
          className="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-[#171717] hover:bg-[#f5f5f5]"
        >
          <Plus size={22} aria-hidden="true" />
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-4 px-4 pt-1 pb-6">
        <label className="flex h-11 items-center gap-2.5 rounded-[10px] bg-[#f5f5f5] px-3 text-[#8a8a8a]">
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={fraza}
            onChange={(e) => setFraza(e.target.value)}
            placeholder="Szukaj stron i wierszy"
            aria-label="Szukaj stron"
            className="min-w-0 flex-1 border-0 bg-transparent text-[15px] text-[#171717] outline-none placeholder:text-[#8a8a8a]"
          />
        </label>

        {sekcje.map(
          ({ nazwa, lista }) =>
            lista.length > 0 && (
              <section key={nazwa}>
                <MonoLabel className="mb-2 block">{nazwa}</MonoLabel>
                <div className="overflow-hidden rounded-xl border border-[#eaeaea] bg-white">
                  {lista.map((strona) => (
                    <Link
                      key={strona.id}
                      href={`/strony/${strona.id}`}
                      className="flex min-h-[60px] items-center gap-3 border-b border-[#f0f0f0] px-3.5 text-[#171717] no-underline last:border-b-0 hover:bg-[#fafafa]"
                    >
                      <span
                        aria-hidden="true"
                        className="flex size-9 flex-none items-center justify-center rounded-[9px] bg-[#f5f5f5] font-mono text-lg text-[#666666]"
                      >
                        {strona.icon}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {strona.title.trim() === "" ? "Bez tytułu" : strona.title}
                        </span>
                        <span className="font-mono text-xs text-[#6b6b6b]">
                          {strona.templateKey === null && strona.rowCount === 0
                            ? "pusta strona"
                            : rowsLabel(strona.rowCount)}
                        </span>
                      </span>
                      <ChevronRight size={16} aria-hidden="true" className="flex-none text-[#a3a3a3]" />
                    </Link>
                  ))}
                </div>
              </section>
            ),
        )}

        {szukane !== "" && pasujace.length === 0 && (
          <p className="m-0 text-center text-[13px] text-[#666666]">Nic nie znaleziono.</p>
        )}

        <button
          type="button"
          onClick={nowaStrona}
          className="flex h-14 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#eaeaea] bg-white font-[inherit] text-[15px] text-[#404040] hover:bg-[#fafafa]"
        >
          <Plus size={18} aria-hidden="true" />
          Nowa strona
        </button>
      </div>
    </div>
  );
}
