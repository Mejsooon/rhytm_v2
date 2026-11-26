"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button, FIELD } from "@/components/controls";
import { cn } from "@/lib/utils";
import { createPageFromTemplate } from "./actions";
import { FIELD_TYPE_META, type FieldType } from "./fields";
import { BLAD_ZAPISU } from "./messages";
import { MNewPage } from "./mobile/m-new-page";
import { PageIcon } from "./page-icon";
import { TEMPLATES, type TemplateKey } from "./templates";

// Wybór szablonu nowej strony (S2NewPage.dc.html): okno .dlg 880 px nad przyciemnionym tłem,
// po lewej nazwa strony i karty szablonów, po prawej „Co powstanie” (pola, widoki, grupowanie, „Dodatkowo”)
// z tej samej konfiguracji co strony.
// Telefon (poniżej 800 px) według mediów; po stronie serwera (i przy hydratacji) układ jest nieustalony (null),
// więc przy twardym wejściu widać samo tło, a nie błysk niewłaściwego układu. W testach bez matchMedia: web
function subskrybujTelefon(wywolaj: () => void) {
  const mq = window.matchMedia("(max-width: 799px)");
  mq.addEventListener?.("change", wywolaj);
  return () => mq.removeEventListener?.("change", wywolaj);
}
function czyTelefon() {
  return typeof window.matchMedia === "function" && window.matchMedia("(max-width: 799px)").matches;
}

// Kolejność kart jak w makiecie: Pusta strona na całą szerokość, potem Subskrypcje, Książki, Projekty, Strony WWW
const KOLEJNOSC: TemplateKey[] = ["empty", "subscriptions", "books", "projects", "websites"];
// Znaki i nazwy typów pól z makiety (S2NewPage: IC i TN); reszta typów z FIELD_TYPE_META
const ZNAK_TYPU: Partial<Record<FieldType, string>> = {
  select: "◉",
  status: "◉",
  date: "31",
  renewal: "31",
  recurring: "zł",
};
const NAZWA_TYPU: Partial<Record<FieldType, string>> = { select: "Wybór", status: "Wybór", url: "Link" };

export function NewPageView() {
  const router = useRouter();
  // Telefon dostaje arkusz CMNewPage (MNewPage) ze wspólnym stanem i zapisem; web zostaje oknem 920 px
  const telefon = React.useSyncExternalStore(
    (wywolaj) => (typeof window.matchMedia === "function" ? subskrybujTelefon(wywolaj) : () => {}),
    czyTelefon,
    (): boolean | null => null,
  );
  const [wybrany, setWybrany] = React.useState<TemplateKey>("empty");
  const [fraza, setFraza] = React.useState("");
  // Nazwa wpisana przez użytkownika; bez niej pole pokazuje nazwę szablonu (pusta strona: bez nazwy, „Bez tytułu”)
  const [nazwaWlasna, setNazwaWlasna] = React.useState<string | null>(null);
  const [trwa, setTrwa] = React.useState(false);

  const szablon = TEMPLATES[wybrany];
  const nazwa = nazwaWlasna ?? (wybrany === "empty" ? "" : szablon.name);
  const szukane = fraza.trim().toLowerCase();
  const widoczne = KOLEJNOSC.filter(
    (k) => szukane === "" || `${TEMPLATES[k].name} ${TEMPLATES[k].hint}`.toLowerCase().includes(szukane),
  );
  // „Grupowanie: Status” — pole grupowania „Wszystkich” z szablonu
  const poleGrupy = szablon.fields.find((f) => f.key === szablon.group);
  const dodatkowo = szablon.extra.split("\n").filter((linia) => linia !== "");

  React.useEffect(() => {
    function przyKlawiszu(e: KeyboardEvent) {
      if (e.key === "Escape") router.back();
    }
    window.addEventListener("keydown", przyKlawiszu);
    return () => window.removeEventListener("keydown", przyKlawiszu);
  }, [router]);

  async function utworz() {
    setTrwa(true);
    let wynik: Awaited<ReturnType<typeof createPageFromTemplate>> | null = null;
    try {
      wynik = await createPageFromTemplate(wybrany, nazwa.trim());
    } catch {
      wynik = null;
    }
    if (!wynik || !wynik.ok) {
      setTrwa(false);
      toast.error(wynik && !wynik.ok ? wynik.message : BLAD_ZAPISU);
      return;
    }
    router.push(`/strony/${wynik.id}`);
  }

  if (telefon === null) {
    return <div className="fixed inset-0 z-50 bg-black/[.32]" />;
  }

  if (telefon) {
    return (
      <MNewPage
        selected={wybrany}
        onSelect={setWybrany}
        name={nazwa}
        onNameChange={setNazwaWlasna}
        busy={trwa}
        onCreate={utworz}
        onCancel={() => router.back()}
      />
    );
  }

  return (
    // .backdrop z coss.css na webie; telefon bez zmian
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/[.32] backdrop-blur-[4px] max-[799px]:bg-black/25 max-[799px]:backdrop-blur-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="np-title"
        aria-describedby="np-desc"
        // .dlg 880 px: promień 16 px, ramka border, cień pop; 64 px od góry jak w makiecie
        className="mx-auto mt-16 mb-8 flex w-[min(880px,calc(100%-32px))] flex-col rounded-xl border border-border bg-white bg-clip-padding text-sm text-foreground shadow-pop max-[799px]:mt-4"
      >
        {/* .dlg-h */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
          <div>
            <h2 id="np-title" className="m-0 text-lg leading-[1.3] font-semibold">
              Nowa strona
            </h2>
            {/* .dlg-d: opis okna, 14 px, kolor muted, 4 px od tytułu */}
            <p id="np-desc" className="mt-1 mb-0 text-sm text-muted-foreground">
              Szablon tworzy stronę z gotową tabelą. Pola, widoki i karty zmienisz później.
            </p>
          </div>
          <Button variant="ghost" size="sm" icon aria-label="Zamknij" onClick={() => router.back()}>
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>

        {/* Dwie kolumny: wybór (reszta szerokości) i podgląd „Co powstanie” 320 px */}
        <div className="grid grid-cols-[minmax(0,1fr)_320px] border-t border-black/[.08]">
          <div className="flex min-w-0 flex-col gap-4 px-6 py-5">
            {/* .fld: etykieta nad polem; ikona szablonu w kwadracie 38 px przed polem */}
            <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
              Nazwa strony
              <span className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="grid size-[38px] flex-none place-items-center rounded-[8px] bg-black/5 text-foreground"
                >
                  <PageIcon icon={szablon.icon} size={18} />
                </span>
                <input
                  type="text"
                  value={nazwa}
                  maxLength={200}
                  placeholder="Bez tytułu"
                  onChange={(e) => setNazwaWlasna(e.target.value)}
                  className={FIELD}
                />
              </span>
            </label>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium text-muted-foreground">Szablony</span>
              {/* .igroup 220 × 32 px */}
              <label className="flex h-8 w-[220px] items-center gap-2 rounded-md border border-input bg-white px-[11px] text-muted-foreground shadow-xs transition-[box-shadow,border-color] duration-150 focus-within:border-ring focus-within:shadow-halo">
                <Search size={14} aria-hidden="true" />
                <input
                  type="text"
                  value={fraza}
                  onChange={(e) => setFraza(e.target.value)}
                  placeholder="Szukaj szablonu…"
                  aria-label="Szukaj szablonu"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-faint-foreground"
                />
              </label>
            </div>
            <div role="radiogroup" aria-label="Szablon" className="grid grid-cols-2 gap-2.5">
              {widoczne.map((klucz) => {
                const t = TEMPLATES[klucz];
                const zaznaczony = klucz === wybrany;
                return (
                  <button
                    key={klucz}
                    type="button"
                    role="radio"
                    aria-checked={zaznaczony}
                    onClick={() => {
                      setWybrany(klucz);
                      // Nowy szablon podpowiada własną nazwę
                      setNazwaWlasna(null);
                    }}
                    // .tpl: 56 px, promień 12 px; zaznaczona — ramka i obwódka 1 px w kolorze primary
                    className={cn(
                      "flex min-h-14 w-full cursor-pointer items-center gap-2.5 rounded-xl border bg-white px-3 py-2.5 text-left font-[inherit] text-sm text-foreground shadow-xs outline-none transition-[border-color,box-shadow,background-color] duration-150 hover:bg-panel focus-visible:shadow-focus",
                      zaznaczony ? "border-primary shadow-[0_0_0_1px_var(--primary)]" : "border-border",
                      klucz === "empty" && "col-span-full",
                    )}
                  >
                    {/* .tic 30 px */}
                    <span aria-hidden="true" className="grid size-[30px] flex-none place-items-center rounded-[8px] bg-black/5">
                      <PageIcon icon={t.icon} size={16} />
                    </span>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium">{t.name}</span>
                      <span className="text-[13px] text-muted-foreground">{t.hint}</span>
                    </span>
                  </button>
                );
              })}
              {widoczne.length === 0 && (
                <div className="col-span-full rounded-xl border border-dashed border-black/[.16] p-5 text-center text-muted-foreground">
                  Brak szablonu „{fraza}”.{" "}
                  <Button variant="ghost" size="xs" onClick={() => setFraza("")}>
                    Pokaż wszystkie
                  </Button>
                </div>
              )}
            </div>
          </div>

          <aside
            aria-label="Co powstanie"
            className="flex min-w-0 flex-col gap-4 border-l border-black/[.08] bg-panel px-6 py-5"
          >
            <div className="flex items-center gap-2">
              <PageIcon icon={szablon.icon} size={18} />
              <b className="truncate text-base font-semibold">{nazwa.trim() === "" ? "Bez tytułu" : nazwa}</b>
            </div>
            {wybrany === "empty" ? (
              <p className="m-0 text-[13px] leading-normal text-muted-foreground">
                Pusta strona bez tabeli. Tabelę, listę albo nagłówek wstawisz, wpisując „/”.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Pola · {szablon.fields.length}</span>
                  {/* .frame: biała ramka z wierszami .nprow */}
                  <div className="overflow-hidden rounded-xl border border-border bg-white">
                    {szablon.fields.map((pole) => (
                      <div
                        key={pole.key}
                        data-testid="pole-szablonu"
                        className="flex items-center gap-2.5 border-b border-black/[.06] px-3 py-2 text-sm last:border-b-0"
                      >
                        {/* .ftype 22 px: znak typu pola */}
                        <span
                          aria-hidden="true"
                          className="grid size-[22px] flex-none place-items-center rounded-[6px] bg-black/5 text-[11px] font-semibold text-[#404040]"
                        >
                          {ZNAK_TYPU[pole.type] ?? FIELD_TYPE_META[pole.type].icon}
                        </span>
                        <span className="flex-1">{pole.name}</span>
                        <span className="text-[13px] text-muted-foreground">
                          {NAZWA_TYPU[pole.type] ?? FIELD_TYPE_META[pole.type].label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-muted-foreground">Widoki</span>
                  <span className="flex flex-wrap gap-1.5">
                    {["Wszystkie", ...szablon.views.map((w) => w.name.replace("{year}", String(new Date().getFullYear())))].map(
                      (w) => (
                        // .vchip
                        <span
                          key={w}
                          data-testid="widok-szablonu"
                          className="inline-flex h-6 items-center rounded-full border border-black/[.12] bg-white px-2.5 text-xs font-medium text-[#404040]"
                        >
                          {w}
                        </span>
                      ),
                    )}
                  </span>
                  {poleGrupy && <span className="text-[13px] text-muted-foreground">Grupowanie: {poleGrupy.name}</span>}
                </div>
              </>
            )}
            {dodatkowo.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Dodatkowo</span>
                {dodatkowo.map((linia) => (
                  <span key={linia} className="flex items-start gap-2 text-[13px] leading-[1.45]">
                    <Check size={14} strokeWidth={2.5} aria-hidden="true" className="mt-0.5 flex-none text-[#15803d]" />
                    {linia}
                  </span>
                ))}
              </div>
            )}
          </aside>
        </div>

        {/* .dlg-f: szara stopka */}
        <div className="flex flex-wrap items-center justify-end gap-2 rounded-b-[15px] border-t border-border bg-black/[.025] px-6 py-4">
          <Button variant="ghost" onClick={() => router.back()}>Anuluj</Button>
          <Button variant="primary" onClick={utworz} disabled={trwa}>
            Utwórz stronę
          </Button>
        </div>
      </div>
    </div>
  );
}
