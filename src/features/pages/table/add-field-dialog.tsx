"use client";

import * as React from "react";

import { ActionPopover, Checkbox, Dropdown } from "@/components/controls";
import { PALETA, type FieldConfig, type FieldOption, type FieldType } from "../fields";

// Typy z grupy „Podstawowe” z AddField.dc.html (Inteligentne i Bezpieczne dochodzą w Etapach 7 i 8)
const TYPY: { type: FieldType; icon: string; name: string; desc: string; defName: string }[] = [
  { type: "text", icon: "Aa", name: "Tekst", desc: "Zwykły tekst.", defName: "Notatka" },
  { type: "number", icon: "#", name: "Liczba", desc: "Liczba ze zwykłym formatem, w zł albo w %.", defName: "Liczba" },
  { type: "checkbox", icon: "✓", name: "Checkbox", desc: "Tak / nie. Może sterować widocznością dat w kalendarzu.", defName: "Aktywna" },
  { type: "url", icon: "↗", name: "URL", desc: "Klikalny link.", defName: "Link" },
  { type: "select", icon: "◉", name: "Select", desc: "Jedna opcja z listy, z kolorową etykietą.", defName: "Kategoria" },
  { type: "status", icon: "◐", name: "Status", desc: "Select z gotowymi opcjami: Do zrobienia / W toku / Zrobione.", defName: "Status" },
  { type: "date", icon: "▦", name: "Data", desc: "Data bez godziny. Może trafić do kalendarza głównego.", defName: "Termin" },
  { type: "rating", icon: "★", name: "Ocena", desc: "Gwiazdki 1–5.", defName: "Ocena" },
];

// Gotowe opcje Statusu (kolory jak w szablonach: szary, niebieski, zielony)
const OPCJE_STATUSU = [
  { label: "Do zrobienia", color: PALETA[7] },
  { label: "W toku", color: PALETA[0] },
  { label: "Zrobione", color: PALETA[1] },
];

// Okno „Nowe pole” (AddField.dc.html) przy przycisku „+ Pole”: lista typów z wyszukiwarką
// po lewej, po prawej nazwa pola (domyślna z typu), opis i ustawienia typu.
export function AddFieldDialog({
  onAdd,
}: {
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

  const wybrany = TYPY.find((t) => t.type === typ) ?? TYPY[0];
  const widoczne = TYPY.filter((t) => t.name.toLowerCase().includes(szukaj.trim().toLowerCase()));

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

  function wybierzTyp(t: (typeof TYPY)[number]) {
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

  const pole =
    "w-full rounded-md border border-[#e0e0e0] bg-white px-2.5 py-2 font-[inherit] text-sm text-[#171717] outline-none focus:border-[#171717] max-[799px]:h-11";

  return (
    <ActionPopover
      open={open}
      onOpenChange={otworz}
      align="end"
      ariaLabel="Nowe pole"
      trigger={
        <button
          type="button"
          aria-expanded={open}
          className={`cursor-pointer rounded-md border border-[#e0e0e0] px-3 py-[7px] font-[inherit] text-sm text-[#171717] max-[799px]:min-h-11 ${open ? "bg-[#f0f0f0]" : "bg-white"}`}
        >
          + Pole
        </button>
      }
    >
      <div className="-m-2.5 flex w-[min(640px,calc(100vw-48px))] flex-wrap overflow-hidden rounded-[10px]">
        <div className="flex flex-[1_1_230px] flex-col gap-0.5 border-r border-[#eaeaea] bg-[#fafafa] p-3">
          <input
            type="text"
            value={szukaj}
            onChange={(e) => setSzukaj(e.target.value)}
            placeholder="Szukaj typu…"
            aria-label="Szukaj typu"
            className={`${pole} mb-2`}
          />
          <div className="px-2 pt-2 pb-1 font-mono text-[11px] tracking-[0.06em] text-[#6b6b6b] uppercase">
            Podstawowe
          </div>
          {widoczne.map((t) => (
            <button
              key={t.type}
              type="button"
              aria-pressed={t.type === typ}
              onClick={() => wybierzTyp(t)}
              className={`flex w-full cursor-pointer items-center gap-1.5 rounded-md border-0 px-2 py-[7px] font-[inherit] text-[13px] text-[#171717] max-[799px]:min-h-11 ${
                t.type === typ ? "bg-white shadow-[0_0_0_1px_#e0e0e0]" : "bg-transparent"
              }`}
            >
              <span aria-hidden="true" className="w-[22px] text-left font-mono text-[#6b6b6b]">
                {t.icon}
              </span>
              <span className="flex-1 text-left">{t.name}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-[999_1_300px] flex-col gap-3 p-4">
          <label className="flex flex-col gap-1.5 text-[13px] font-medium">
            Nazwa pola
            <input
              type="text"
              value={nazwa}
              onChange={(e) => {
                setNazwa(e.target.value);
                setNazwaWlasna(true);
              }}
              className={`${pole} font-normal`}
            />
          </label>
          <div>
            <div className="font-semibold">{wybrany.name}</div>
            <p className="mt-1 mb-0 text-[13px] leading-normal text-[#666666]">{wybrany.desc}</p>
          </div>

          {typ === "date" && (
            <div>
              <div className="flex items-center justify-between gap-2.5 border-b border-[#f0f0f0] py-2 text-[13px]">
                <span>Pokaż w kalendarzu</span>
                <Checkbox checked={wKalendarzu} ariaLabel="Pokaż w kalendarzu" onChange={setWKalendarzu} />
              </div>
              {/* Warunek z pola Checkbox dochodzi w Etapie 7 — na razie jedyna opcja „— zawsze —” */}
              <div className="flex items-center justify-between gap-2.5 py-2 text-[13px]">
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
                <span
                  key={o}
                  className="inline-flex items-center gap-1 rounded-[4px] border border-[#e0e0e0] py-[3px] pr-1 pl-2 font-mono text-xs"
                >
                  {o}
                  <button
                    type="button"
                    aria-label={`Usuń opcję ${o}`}
                    onClick={() => setOpcje((l) => l.filter((x) => x !== o))}
                    className="cursor-pointer border-0 bg-transparent px-0.5 font-[inherit] text-[#6b6b6b] hover:text-[#171717] max-[799px]:min-h-11 max-[799px]:min-w-11"
                  >
                    ×
                  </button>
                </span>
              ))}
              {nowaOpcja === null ? (
                <button
                  type="button"
                  onClick={() => setNowaOpcja("")}
                  className="cursor-pointer rounded-md border border-[#e0e0e0] bg-white px-2 py-[3px] font-[inherit] text-xs text-[#171717] max-[799px]:min-h-11"
                >
                  + Opcja
                </button>
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
                  className="w-[130px] rounded-[4px] border border-[#171717] bg-white px-2 py-[3px] font-mono text-xs text-[#171717] outline-none max-[799px]:min-h-11"
                />
              )}
            </div>
          )}

          <div className="flex-1" />
          <div className="flex justify-end gap-2 border-t border-[#eaeaea] pt-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="cursor-pointer rounded-md border border-[#e0e0e0] bg-white px-3 py-[7px] font-[inherit] text-sm text-[#171717] max-[799px]:min-h-11"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={dodaj}
              className="cursor-pointer rounded-md border border-[#171717] bg-[#171717] px-3 py-[7px] font-[inherit] text-sm font-medium text-white max-[799px]:min-h-11"
            >
              Dodaj pole
            </button>
          </div>
        </div>
      </div>
    </ActionPopover>
  );
}
