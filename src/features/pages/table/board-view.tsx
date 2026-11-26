"use client";

import * as React from "react";
import { Ellipsis, Plus } from "lucide-react";

import { ActionPopover, Button, MENU_ITEM, type IsoDate } from "@/components/controls";
import { cn } from "@/lib/utils";

import {
  formatValue,
  nextRenewal,
  normalizeValue,
  relativeDue,
  rowActive,
  rowCycle,
  type PageField,
} from "../fields";
import type { PageRow } from "../table-model";
import { groupRows } from "../table-views";
import { OptionBadge } from "./option-badge";
import { PRZYCISK_PASKA } from "./table-toolbar";
import { PREFIKS_TYMCZASOWY } from "./use-table-store";

// Tablica (S2Table.dc.html, bcols): kolumna na każdą opcję pola tablicy (w kolejności pola, także pusta),
// „Bez wartości” na końcu tylko z wierszami. Nagłówek kolumny: odznaka opcji, liczba kart i podsumowanie grupy.
// Karta: tytuł i pola jak r.meta (Wybór jako plakietka, data z „za N dni”, kwota, gwiazdki, tekst) — bez pola
// tablicy, ukrytych pól i nigdy bez wartości Sekretu (w module Hasła karta ma tylko serwis i login).
// Przeciąganie (HTML5) albo menu karty „Przenieś do…” (klawiatura) zmienia wartość pola tablicy; zapis
// i cofnięcie po błędzie robi store (updateCell). „Dodaj” w kolumnie tworzy wiersz z wartością tej kolumny.
export function BoardView({
  fields,
  visibleFields,
  rows,
  boardField,
  today,
  readOnly,
  passwords,
  summaries,
  adding,
  addField,
  onMove,
  onAdd,
  onOpen,
}: {
  // Wszystkie pola (cykl i aktywność Daty odnowienia) i widoczne pola widoku (kolejność pól na karcie)
  fields: PageField[];
  visibleFields: PageField[];
  // Wiersze bieżącego widoku w jego kolejności
  rows: PageRow[];
  // Pole kolumn (Wybór albo Status); null = komunikat z przyciskiem dodania pola
  boardField: PageField | null;
  today: IsoDate;
  readOnly: boolean;
  // Moduł Hasła: na karcie tylko login
  passwords: boolean;
  // Podsumowanie kolumny (klucz opcji → tekst), jak w nagłówku grupy tabeli
  summaries: Map<string, string>;
  // „Dodaj” czeka na serwer
  adding: boolean;
  // Okno „Nowe pole” (pusty stan bez pola Wyboru i Statusu); brak = bez przycisku
  addField?: React.ReactNode;
  // Nowa wartość pola tablicy: id opcji albo null („Bez wartości”)
  onMove: (row: PageRow, value: string | null) => void;
  onAdd: (value: string | null) => void;
  onOpen: (row: PageRow) => void;
}) {
  // Przeciągana karta (id) i kolumna pod kursorem (klucz) — obrys kolumny i przygaszenie karty
  const [przeciagana, setPrzeciagana] = React.useState<string | null>(null);
  const [nadKolumna, setNadKolumna] = React.useState<string | null>(null);
  // Otwarte menu karty „Przenieś do…” (id wiersza)
  const [menuKarty, setMenuKarty] = React.useState<string | null>(null);

  if (!boardField) {
    return (
      <div className="flex min-h-[120px] flex-col items-center justify-center gap-2 rounded-xl bg-[#fafafa] p-6 text-center text-sm text-muted-foreground">
        <p className="m-0">Tablica potrzebuje pola Wybór albo Status.</p>
        {addField}
      </div>
    );
  }
  const pole = boardField;

  // Kolumny: wszystkie opcje pola; groupRows pomija puste grupy, więc puste opcje dokładamy tutaj
  const grupy = groupRows(fields, rows, pole.id);
  const kolumny = (pole.config.options ?? []).map(
    (o) => grupy.find((g) => g.key === o.id) ?? { key: o.id, label: o.label, color: o.color, rows: [] },
  );
  const bezWartosci = grupy.find((g) => g.key === "");
  if (bezWartosci) kolumny.push(bezWartosci);

  const tytulowe = fields.find((f) => f.isTitle);
  // Pola na karcie: widoczne, bez tytułu, pola tablicy i Sekretu; w module Hasła tylko login
  const polaKarty = visibleFields.filter(
    (f) => !f.isTitle && f.id !== pole.id && f.type !== "secret" && (!passwords || f.name === "Login"),
  );
  const przeciaganyWiersz = przeciagana ? rows.find((r) => r.id === przeciagana) : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {/* .kboard: kolumny po 260 px, odstęp 12 px, poziome przewijanie */}
      <div className="grid auto-cols-[260px] grid-flow-col items-start gap-3 overflow-x-auto pb-2">
        {kolumny.map((k) => {
          const wartosc = k.key === "" ? null : k.key;
          const suma = summaries.get(k.key) ?? "";
          return (
            <section
              key={k.key}
              aria-label={k.label}
              // .kcol; kolumna pod przeciąganą kartą dostaje obrys 2 px
              className="flex min-h-[120px] min-w-0 flex-col gap-2 rounded-xl bg-[#fafafa] p-2.5"
              style={nadKolumna === k.key ? { boxShadow: "inset 0 0 0 2px #262626" } : undefined}
              onDragOver={(e) => {
                if (!przeciagana) return;
                e.preventDefault();
                if (nadKolumna !== k.key) setNadKolumna(k.key);
              }}
              onDragLeave={() => {
                if (nadKolumna === k.key) setNadKolumna(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const wiersz = przeciaganyWiersz;
                setPrzeciagana(null);
                setNadKolumna(null);
                if (!wiersz) return;
                // Ta sama kolumna: nic do zapisu
                const obecna = normalizeValue(pole, wiersz.values[pole.id]);
                const obecnyKlucz = typeof obecna === "string" && kolumny.some((x) => x.key === obecna) ? obecna : "";
                if (obecnyKlucz !== k.key) onMove(wiersz, wartosc);
              }}
            >
              <div className="flex items-center gap-2 px-0.5 pt-0.5 pb-1">
                {/* Odznaka i liczba się nie ściskają; długie podsumowanie łamie się w swoim miejscu */}
                <span className="flex-none">
                  <OptionBadge option={{ id: k.key, label: k.label, color: k.color ?? "" }} />
                </span>
                <span className="flex-none text-xs text-muted-foreground tabular-nums">{k.rows.length}</span>
                <span className="ml-auto min-w-0 text-xs text-muted-foreground tabular-nums">{suma}</span>
              </div>
              {k.rows.map((r) => {
                const tytul =
                  tytulowe && typeof r.values[tytulowe.id] === "string" && r.values[tytulowe.id] !== ""
                    ? (r.values[tytulowe.id] as string)
                    : (tytulowe?.config.empty_label ?? "Bez nazwy");
                // Subskrypcja nieaktywna (odznaczona „Aktywna” wskazana przez Datę odnowienia) jest przygaszona
                const nieaktywna = fields.some(
                  (f) => f.type === "renewal" && f.config.active_field_id !== undefined && !rowActive(f, fields, r.values),
                );
                const zapisywana = r.id.startsWith(PREFIKS_TYMCZASOWY);
                const moznaPrzenosic = !readOnly && !zapisywana;
                // r.meta z makiety: pola karty w kolejności widoku
                const meta: React.ReactNode[] = [];
                for (const f of polaKarty) {
                  const v = normalizeValue(f, r.values[f.id]);
                  if (v === null || v === "") continue;
                  if (f.type === "select" || f.type === "status") {
                    const o = (f.config.options ?? []).find((x) => x.id === v);
                    if (o) meta.push(<OptionBadge key={f.id} option={o} />);
                  } else if (f.type === "date" || f.type === "renewal") {
                    // Data odnowienia: najbliższe odnowienie; termin w kalendarzu i odnowienie z „za N dni”
                    const d = f.type === "renewal" ? nextRenewal(v as string, rowCycle(f, fields, r.values), today) : (v as string);
                    const zWzgledna = f.type === "renewal" || f.config.show_in_calendar === true;
                    const wzgledna = zWzgledna ? relativeDue(d, today) : null;
                    const [rok, mies, dzien] = d.split("-");
                    meta.push(
                      <span
                        key={f.id}
                        className="text-xs text-muted-foreground tabular-nums"
                        // Termin w ciągu 7 dni: pomarańczowy (#c2410c)
                        style={wzgledna && wzgledna.days >= 0 && wzgledna.days <= 7 ? { color: "#c2410c" } : undefined}
                      >
                        {`${dzien}.${mies}.${rok}${wzgledna ? ` · ${wzgledna.text}` : ""}`}
                      </span>,
                    );
                  } else if (f.type === "recurring") {
                    meta.push(
                      <span key={f.id} className="text-xs text-foreground tabular-nums">
                        {formatValue(f, v)}
                      </span>,
                    );
                  } else if (f.type === "rating") {
                    meta.push(
                      <span key={f.id} className="text-xs text-[#f59e0b]">
                        {"★".repeat(v as number)}
                      </span>,
                    );
                  } else if (f.type === "text" || f.type === "url" || f.type === "number") {
                    meta.push(
                      <span
                        key={f.id}
                        className={cn("text-xs text-muted-foreground", f.type === "url" && "font-mono")}
                      >
                        {formatValue(f, v)}
                      </span>,
                    );
                  }
                }
                return (
                  <article
                    key={r.id}
                    aria-label={tytul}
                    draggable={moznaPrzenosic}
                    onDragStart={(e) => {
                      if (!moznaPrzenosic) return;
                      if (e.dataTransfer) {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", r.id);
                      }
                      setPrzeciagana(r.id);
                    }}
                    onDragEnd={() => {
                      setPrzeciagana(null);
                      setNadKolumna(null);
                    }}
                    // Kliknięcie karty otwiera arkusz wiersza; kliknięcia z menu (portal) nie liczą się
                    onClick={(e) => {
                      if (readOnly || zapisywana) return;
                      if (!(e.target instanceof Node) || !e.currentTarget.contains(e.target)) return;
                      if (e.target instanceof Element && e.target.closest("[data-menu-karty]")) return;
                      onOpen(r);
                    }}
                    // .kcard
                    className={cn(
                      "group/karta relative flex flex-col gap-2 rounded-[10px] border border-black/10 bg-white px-3 py-2.5 text-sm shadow-[0_1px_2px_rgba(0,0,0,.04)]",
                      moznaPrzenosic && "cursor-grab",
                    )}
                    style={{ opacity: przeciagana === r.id ? 0.45 : nieaktywna ? 0.6 : undefined }}
                  >
                    <button
                      type="button"
                      disabled={readOnly}
                      className="block w-full cursor-pointer border-0 bg-transparent p-0 text-left font-medium whitespace-normal text-foreground outline-none focus-visible:shadow-focus disabled:cursor-default"
                    >
                      {tytul}
                    </button>
                    {/* r.meta: pola karty w kolejności widoku */}
                    {meta.length > 0 && <span className="flex flex-wrap items-center gap-1.5">{meta}</span>}
                    {/* .kact: menu karty (klawiatura i czytniki ekranu) — „Przenieś do…” innej kolumny */}
                    {moznaPrzenosic && (
                      <span data-menu-karty="" className="absolute top-2 right-2">
                        <ActionPopover
                          open={menuKarty === r.id}
                          onOpenChange={(o) => setMenuKarty(o ? r.id : null)}
                          align="end"
                          width={200}
                          className="p-1"
                          trigger={
                            <Button
                              variant="ghost"
                              size="xs"
                              icon
                              aria-label={`Przenieś: ${tytul}`}
                              aria-haspopup="menu"
                              aria-expanded={menuKarty === r.id}
                              className="opacity-0 group-hover/karta:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 max-[799px]:opacity-100"
                            >
                              <Ellipsis aria-hidden="true" className="size-4" />
                            </Button>
                          }
                        >
                          <div role="menu" aria-label="Przenieś do…">
                            <p className="mx-2 mt-1 mb-1.5 text-xs text-muted-foreground">Przenieś do…</p>
                            {kolumny
                              .filter((x) => x.key !== k.key)
                              .map((x) => (
                                <button
                                  key={x.key}
                                  type="button"
                                  role="menuitem"
                                  className={MENU_ITEM}
                                  onClick={() => {
                                    setMenuKarty(null);
                                    onMove(r, x.key === "" ? null : x.key);
                                  }}
                                >
                                  {x.label}
                                </button>
                              ))}
                          </div>
                        </ActionPopover>
                      </span>
                    )}
                  </article>
                );
              })}
              {!readOnly && (
                <button
                  type="button"
                  disabled={adding}
                  onClick={() => onAdd(wartosc)}
                  className={cn(PRZYCISK_PASKA, "justify-start disabled:cursor-not-allowed disabled:opacity-[.64]")}
                >
                  <Plus aria-hidden="true" className="size-3.5" />
                  Dodaj
                </button>
              )}
            </section>
          );
        })}
      </div>
      <p className="m-0 text-xs text-muted-foreground">
        Przeciągnij kartę do innej kolumny, żeby zmienić {pole.name.toLowerCase()}.
      </p>
    </div>
  );
}
