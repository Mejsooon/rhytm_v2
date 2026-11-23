"use client";

import * as React from "react";

import { Plus, Search, type LucideIcon } from "lucide-react";

import { ActionPopover, Button, Checkbox, Dropdown, FIELD, MENU_LABEL, StatusBadge } from "@/components/controls";
import { cn } from "@/lib/utils";
import { FIELD_TYPE_META, PALETA, type FieldConfig, type FieldOption, type FieldType } from "../fields";

// Typy z grupy „Podstawowe” z AddField.dc.html (Inteligentne dochodzą w Etapie 7)
const TYPY: { type: FieldType; Icon: LucideIcon; name: string; desc: string; defName: string }[] = [
  { type: "text", Icon: FIELD_TYPE_META.text.Icon, name: "Tekst", desc: "Zwykły tekst.", defName: "Notatka" },
  { type: "number", Icon: FIELD_TYPE_META.number.Icon, name: "Liczba", desc: "Liczba ze zwykłym formatem, w zł albo w %.", defName: "Liczba" },
  { type: "checkbox", Icon: FIELD_TYPE_META.checkbox.Icon, name: "Checkbox", desc: "Tak / nie. Może sterować widocznością dat w kalendarzu.", defName: "Aktywna" },
  { type: "url", Icon: FIELD_TYPE_META.url.Icon, name: "URL", desc: "Klikalny link.", defName: "Link" },
  { type: "select", Icon: FIELD_TYPE_META.select.Icon, name: "Select", desc: "Jedna opcja z listy, z kolorową etykietą.", defName: "Kategoria" },
  { type: "status", Icon: FIELD_TYPE_META.status.Icon, name: "Status", desc: "Select z gotowymi opcjami: Do zrobienia / W toku / Zrobione.", defName: "Status" },
  { type: "date", Icon: FIELD_TYPE_META.date.Icon, name: "Data", desc: "Data bez godziny. Może trafić do kalendarza głównego.", defName: "Termin" },
  { type: "rating", Icon: FIELD_TYPE_META.rating.Icon, name: "Ocena", desc: "Gwiazdki 1–5.", defName: "Ocena" },
];

// Grupa „Bezpieczne” z AddField.dc.html: Sekret (szyfrowany w przeglądarce), tylko na stronie Hasła
const TYP_SEKRET = {
  type: "secret" as const,
  Icon: FIELD_TYPE_META.secret.Icon,
  name: "Sekret",
  desc: "Zamaskowana wartość, np. hasło.",
  defName: "Hasło",
};

// Wybrany typ: biała pigułka z cieniem; fokus zostawia cień i dodaje obrys
const WYBRANY_TYP =
  "bg-white shadow-[0_0_0_1px_rgba(0,0,0,.1),0_1px_2px_rgba(0,0,0,.05)] hover:bg-white focus-visible:shadow-[0_0_0_1px_rgba(0,0,0,.1),0_1px_2px_rgba(0,0,0,.05)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid";

// Gotowe opcje Statusu (kolory jak w szablonach: szary, niebieski, zielony)
const OPCJE_STATUSU = [
  { label: "Do zrobienia", color: PALETA[7] },
  { label: "W toku", color: PALETA[0] },
  { label: "Zrobione", color: PALETA[1] },
];

// Okno „Nowe pole” (AddField.dc.html) przy przycisku „+ Pole”: lista typów z wyszukiwarką
// po lewej, po prawej nazwa pola (domyślna z typu), opis i ustawienia typu.
// iconTrigger: wyzwalaczem jest sam „+” w ostatnim nagłówku tabeli (.addcol z S2Books.dc.html).
export function AddFieldDialog({
  allowSecret = false,
  iconTrigger = false,
  onAdd,
}: {
  // Typ Sekret tylko na stronie z szablonu (nie na „Pustej stronie”)
  allowSecret?: boolean;
  iconTrigger?: boolean;
  onAdd: (input: { name: string; type: FieldType; config: FieldConfig }) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [typ, setTyp] = React.useState<FieldType>("text");
  const [nazwa, setNazwa] = React.useState("Notatka");
  // Nazwa wpisana ręcznie nie zmienia się przy wyborze innego typu
  const [nazwaWlasna, setNazwaWlasna] = React.useState(false);
  const [szukaj, setSzukaj] = React.useState("");
  const [opcje, setOpcje] = React.useState<string[]>([]);
  const [nowaOpcja, setNowaOpcja] = React.useState<string | null>(null);
  const [wKalendarzu, setWKalendarzu] = React.useState(false);

  const wybrany = [...TYPY, TYP_SEKRET].find((t) => t.type === typ) ?? TYPY[0];
  const fraza = szukaj.trim().toLowerCase();
  const widoczne = TYPY.filter((t) => t.name.toLowerCase().includes(fraza));
  const sekretWidoczny = allowSecret && TYP_SEKRET.name.toLowerCase().includes(fraza);

  function otworz(o: boolean) {
    if (o) {
      // Każde otwarcie zaczyna od czystego formularza
      setTyp("text");
      setNazwa("Notatka");
      setNazwaWlasna(false);
      setSzukaj("");
      setOpcje([]);
      setNowaOpcja(null);
      setWKalendarzu(false);
    }
    setOpen(o);
  }

  function wybierzTyp(t: (typeof TYPY)[number] | typeof TYP_SEKRET) {
    setTyp(t.type);
    if (!nazwaWlasna) setNazwa(t.defName);
    setOpcje(t.type === "status" ? OPCJE_STATUSU.map((o) => o.label) : []);
    setNowaOpcja(null);
  }

  function dopiszOpcje() {
    const etykieta = (nowaOpcja ?? "").trim();
    if (etykieta !== "" && !opcje.some((o) => o.toLowerCase() === etykieta.toLowerCase())) {
      setOpcje((l) => [...l, etykieta]);
    }
    setNowaOpcja(null);
  }

  function dodaj() {
    const config: FieldConfig = {};
    if (typ === "select" || typ === "status") {
      config.options = opcje.map(
        (label, i): FieldOption => ({
          id: crypto.randomUUID(),
          label,
          color:
            OPCJE_STATUSU.find((o) => o.label === label && typ === "status")?.color ??
            PALETA[i % PALETA.length],
        }),
      );
    }
    if (typ === "date" && wKalendarzu) config.show_in_calendar = true;
    onAdd({ name: nazwa.trim() === "" ? wybrany.defName : nazwa.trim(), type: typ, config });
    setOpen(false);
  }

  return (
    <ActionPopover
      open={open}
      onOpenChange={otworz}
      align="end"
      ariaLabel="Nowe pole"
      // .pop bez paddingu: lewa kolumna z listą typów sięga krawędzi okna
      className="overflow-hidden p-0"
      trigger={
        iconTrigger ? (
          // .addcol: na całą szerokość komórki, min. 38 px, jasnoszary „+”, tło 4 % przy najechaniu
          <button
            type="button"
            aria-label="Dodaj kolumnę"
            aria-expanded={open}
            className="grid min-h-[38px] w-full cursor-pointer place-items-center rounded-md border-0 bg-transparent text-faint-foreground outline-none hover:bg-black/[.04] hover:text-foreground focus-visible:shadow-focus aria-expanded:bg-black/[.04] max-[799px]:min-h-11"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        ) : (
          <Button aria-expanded={open} className="aria-expanded:bg-accent">
            + Pole
          </Button>
        )
      }
    >
      <div className="flex w-[min(660px,calc(100vw-48px))] flex-wrap">
        <div className="flex flex-[1_1_230px] flex-col gap-px border-r border-black/[.08] bg-panel p-2">
          {/* .igroup: pole z ikoną lupy */}
          <div className="mb-1 flex h-8 items-center gap-2 rounded-md border border-input bg-white px-[11px] text-muted-foreground shadow-xs focus-within:border-ring focus-within:shadow-halo max-[799px]:h-11">
            <Search size={16} aria-hidden="true" className="flex-none" />
            <input
              type="text"
              value={szukaj}
              onChange={(e) => setSzukaj(e.target.value)}
              placeholder="Szukaj typu…"
              aria-label="Szukaj typu"
              className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-faint-foreground"
            />
          </div>
          {widoczne.length > 0 && <div className={MENU_LABEL}>Podstawowe</div>}
          {widoczne.map((t) => (
            <button
              key={t.type}
              type="button"
              aria-pressed={t.type === typ}
              onClick={() => wybierzTyp(t)}
              // Wybrany typ: biała pigułka z cieniem; fokus na nim to obrys (cień zaznaczenia zajmuje shadow)
              className={cn(
                "flex min-h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-sm border-0 px-2 text-left text-sm text-foreground outline-none hover:bg-accent focus-visible:shadow-focus max-[799px]:min-h-11",
                t.type === typ
                  ? WYBRANY_TYP
                  : "bg-transparent",
              )}
            >
              <span className="flex items-center gap-2">
                <t.Icon size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
                {t.name}
              </span>
            </button>
          ))}
          {sekretWidoczny && (
            <>
              <div className={MENU_LABEL}>Bezpieczne</div>
              <button
                type="button"
                aria-pressed={typ === "secret"}
                onClick={() => wybierzTyp(TYP_SEKRET)}
                className={cn(
                  "flex min-h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-sm border-0 px-2 text-left text-sm text-foreground outline-none hover:bg-accent focus-visible:shadow-focus max-[799px]:min-h-11",
                  typ === "secret" ? WYBRANY_TYP : "bg-transparent",
                )}
              >
                <span className="flex items-center gap-2">
                  <TYP_SEKRET.Icon size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
                  {TYP_SEKRET.name}
                </span>
                {/* .bdg.ok z makiety: odznaka „szyfr.” */}
                <StatusBadge tone="green">szyfr.</StatusBadge>
              </button>
            </>
          )}
        </div>

        <div className="flex flex-[999_1_320px] flex-col gap-3.5 p-4">
          <label className="flex flex-col gap-2 text-sm font-medium">
            Nazwa pola
            <input
              type="text"
              value={nazwa}
              onChange={(e) => {
                setNazwa(e.target.value);
                setNazwaWlasna(true);
              }}
              className={FIELD}
            />
          </label>
          <div>
            <div className="flex items-center gap-2 font-semibold">{wybrany.name}</div>
            <p className="mt-1 mb-0 text-[13px] leading-normal text-muted-foreground">{wybrany.desc}</p>
          </div>

          {typ === "date" && (
            // .frame > .inner: ramka 1,5 px, promień 12 px, wiersze .srow z cienką linią
            <div className="rounded-xl border-[1.5px] border-black/[.14] bg-white px-3">
              <div className="flex items-center justify-between gap-2.5 border-b border-black/[.06] py-[9px] text-sm">
                <span>Pokaż w kalendarzu</span>
                <Checkbox checked={wKalendarzu} ariaLabel="Pokaż w kalendarzu" onChange={setWKalendarzu} />
              </div>
              {/* Warunek z pola Checkbox dochodzi w Etapie 7 — na razie jedyna opcja „— zawsze —” */}
              <div className="flex items-center justify-between gap-2.5 py-[9px] text-sm">
                <span>Tylko gdy zaznaczone</span>
                <div>
                  <Dropdown
                    compact
                    ariaLabel="Tylko gdy zaznaczone"
                    width={160}
                    value="zawsze"
                    onChange={() => {}}
                    options={[{ value: "zawsze", label: "— zawsze —" }]}
                  />
                </div>
              </div>
            </div>
          )}

          {(typ === "select" || typ === "status") && (
            <div className="flex flex-wrap items-center gap-1.5">
              {opcje.map((o) => (
                // .bdg.out.lg: biała odznaka z ramką, 22 px
                <span
                  key={o}
                  className="inline-flex h-[22px] items-center justify-center gap-1 rounded-sm border border-input bg-white pr-1 pl-[7px] text-[13px] leading-none font-medium whitespace-nowrap text-foreground"
                >
                  {o}
                  <button
                    type="button"
                    aria-label={`Usuń opcję ${o}`}
                    onClick={() => setOpcje((l) => l.filter((x) => x !== o))}
                    className="cursor-pointer border-0 bg-transparent px-0.5 font-[inherit] text-muted-foreground outline-none hover:text-foreground focus-visible:shadow-focus max-[799px]:min-h-11 max-[799px]:min-w-11"
                  >
                    ×
                  </button>
                </span>
              ))}
              {nowaOpcja === null ? (
                <Button variant="ghost" size="xs" onClick={() => setNowaOpcja("")} className="max-[799px]:h-11">
                  + Opcja
                </Button>
              ) : (
                <input
                  type="text"
                  value={nowaOpcja}
                  onChange={(e) => setNowaOpcja(e.target.value)}
                  onBlur={dopiszOpcje}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      dopiszOpcje();
                    }
                  }}
                  placeholder="Nowa opcja"
                  aria-label="Nowa opcja"
                  // Pole pojawia się po kliknięciu „+ Opcja”
                  autoFocus
                  className={cn(FIELD, "w-[130px]")}
                />
              )}
            </div>
          )}

          <div className="flex-1" />
          <div className="flex justify-end gap-2 border-t border-black/[.08] pt-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Anuluj
            </Button>
            <Button variant="primary" onClick={dodaj}>
              Dodaj pole
            </Button>
          </div>
        </div>
      </div>
    </ActionPopover>
  );
}
