"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button, FIELD, StatusBadge } from "@/components/controls";
import { cn } from "@/lib/utils";
import { createPageFromTemplate } from "./actions";
import { FIELD_TYPE_META } from "./fields";
import { BLAD_ZAPISU } from "./messages";
import { PageIcon } from "./page-icon";
import { TEMPLATE_KEYS, TEMPLATES, type TemplateKey } from "./templates";

// Wybór szablonu nowej strony (S2NewPage.dc.html): okno .dlg 920 px nad przyciemnionym tłem,
// po lewej karty szablonów, po prawej „Pola, które powstaną” z tej samej konfiguracji co strony.
export function NewPageView() {
  const router = useRouter();
  const [wybrany, setWybrany] = React.useState<TemplateKey>("empty");
  const [fraza, setFraza] = React.useState("");
  // Nazwa wpisana przez użytkownika; bez niej pole pokazuje nazwę szablonu
  const [nazwaWlasna, setNazwaWlasna] = React.useState<string | null>(null);
  const [trwa, setTrwa] = React.useState(false);

  const szablon = TEMPLATES[wybrany];
  const nazwa = nazwaWlasna ?? szablon.name;
  const szukane = fraza.trim().toLowerCase();
  const widoczne = TEMPLATE_KEYS.filter(
    (k) =>
      szukane === "" ||
      TEMPLATES[k].name.toLowerCase().includes(szukane) ||
      TEMPLATES[k].desc.toLowerCase().includes(szukane),
  );

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

  return (
    // .backdrop z coss.css na webie; telefon bez zmian
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/[.32] backdrop-blur-[4px] max-[799px]:bg-black/25 max-[799px]:backdrop-blur-none">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="np-title"
        aria-describedby="np-desc"
        // .dlg: promień 16 px, ramka border, cień pop; 64 px od góry jak w makiecie
        className="mx-auto mt-16 mb-8 flex w-[min(920px,calc(100%-32px))] flex-col rounded-xl border border-border bg-white bg-clip-padding text-sm text-foreground shadow-pop max-[799px]:mt-4"
      >
        {/* .dlg-h */}
        <div className="flex items-start justify-between gap-3 px-6 pt-6 pb-4">
          <div>
            <h2 id="np-title" className="m-0 text-lg leading-[1.3] font-semibold">
              Nowa strona
            </h2>
            {/* .dlg-d: opis okna, 14 px, kolor muted, 4 px od tytułu */}
            <p id="np-desc" className="mt-1 mb-0 text-sm text-muted-foreground">
              Szablon wstawia zwykłą stronę z gotową tabelą i kartami. Wszystko zmienisz później.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            icon
            aria-label="Zamknij"
            onClick={() => router.back()}
            className="max-[799px]:size-11"
          >
            <X aria-hidden="true" className="size-4" />
          </Button>
        </div>

        <div className="flex flex-wrap">
          <div className="flex min-w-0 flex-[999_1_380px] flex-col gap-3.5 px-6 pt-1 pb-5">
            {/* .igroup: 32 px, cień xs, fokus ring + halo na całej grupie */}
            <label className="flex h-8 items-center gap-2 rounded-md border border-input bg-white px-[11px] text-muted-foreground shadow-xs transition-[box-shadow,border-color] duration-150 focus-within:border-ring focus-within:shadow-halo max-[799px]:h-11">
              <Search size={16} aria-hidden="true" />
              <input
                type="text"
                value={fraza}
                onChange={(e) => setFraza(e.target.value)}
                placeholder="Szukaj szablonu…"
                aria-label="Szukaj szablonu"
                className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-faint-foreground max-[799px]:text-[15px]"
              />
            </label>
            <div className="text-xs font-medium text-muted-foreground">Szablony</div>
            <div className="grid grid-cols-2 gap-2.5">
              {widoczne.map((klucz) => {
                const t = TEMPLATES[klucz];
                const zaznaczony = klucz === wybrany;
                return (
                  <button
                    key={klucz}
                    type="button"
                    aria-pressed={zaznaczony}
                    onClick={() => setWybrany(klucz)}
                    // Zaznaczona: cień zaznaczenia w style, więc fokus jako obrys zamiast shadow-focus
                    style={zaznaczony ? { boxShadow: "0 0 0 3px rgba(38,38,38,.12)" } : undefined}
                    className={cn(
                      "flex min-h-[60px] cursor-pointer flex-col items-start gap-0.5 rounded-xl border bg-white px-3 py-2.5 text-left font-[inherit] text-sm text-foreground shadow-xs transition-[border-color,box-shadow,background-color] duration-150 hover:bg-panel",
                      zaznaczony
                        ? "border-primary outline-ring focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-solid"
                        : "border-border outline-none focus-visible:shadow-focus",
                    )}
                  >
                    <span className="flex items-center gap-2 font-medium">
                      <span className="grid size-[26px] place-items-center rounded-[7px] bg-black/[.04] text-foreground">
                        <PageIcon icon={t.icon} size={16} />
                      </span>
                      {t.name}
                      {/* Odznaka „szyfr.” przy szablonie z polem Sekret (makieta CNewPage) */}
                      {t.fields.some((f) => f.type === "secret") && (
                        <StatusBadge tone="green" className="ml-auto">
                          szyfr.
                        </StatusBadge>
                      )}
                    </span>
                    {/* Opis pod nazwą, wcięty o ikonę (26 px + 8 px odstępu) */}
                    <span className="pl-[34px] text-[13px] leading-[1.4] text-muted-foreground">{t.desc}</span>
                  </button>
                );
              })}
              {/* .empty: komunikat na całą szerokość siatki, gdy fraza nic nie znalazła */}
              {widoczne.length === 0 && (
                <div className="col-span-full flex flex-col items-center gap-2 p-6 text-center">
                  Brak szablonu „{fraza}”.
                </div>
              )}
            </div>
          </div>

          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 border-l border-border bg-panel px-6 pt-1 pb-5 max-[799px]:border-t max-[799px]:border-l-0">
            <div className="text-xs font-medium text-muted-foreground">Pola, które powstaną</div>
            <div className="text-lg font-semibold">{szablon.name}</div>
            {/* .frame > .inner: ramka 1,5 px, promień 12 px */}
            <div className="overflow-hidden rounded-xl border-[1.5px] border-black/[.14] bg-white">
              {wybrany !== "empty" &&
                szablon.fields.map((pole) => (
                  <div
                    key={pole.key}
                    className="flex items-center justify-between gap-2.5 border-b border-black/[.06] px-3 py-[9px] text-sm"
                  >
                    <span>{pole.name}</span>
                    {/* S2NewPage: zielona tylko Ocena; Termin w Projects to zwykła „Data” (o kalendarzu mówi opis pod listą) */}
                    <StatusBadge tone={pole.type === "rating" || pole.type === "secret" ? "green" : "outline"}>
                      {FIELD_TYPE_META[pole.type].label}
                    </StatusBadge>
                  </div>
                ))}
              {wybrany === "empty" && (
                <div className="px-3 py-3.5 text-[13px] text-muted-foreground">
                  Tylko kolumna „Nazwa”. Kolejne dodasz przyciskiem „+” w nagłówku tabeli.
                </div>
              )}
            </div>
            {/* .alert.info: osobna karta na każdą linię opisu szablonu */}
            {szablon.extra
              .split("\n")
              .filter((linia) => linia !== "")
              .map((linia) => (
                <div
                  key={linia}
                  className="flex items-start gap-2.5 rounded-xl border border-info-border bg-info/[.04] px-3.5 py-3 text-[13px]"
                >
                  <Info size={16} aria-hidden="true" className="mt-px flex-none" />
                  <span>{linia}</span>
                </div>
              ))}
            <div className="flex-1" />
            <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
              Nazwa strony
              <input
                type="text"
                value={nazwa}
                maxLength={200}
                onChange={(e) => setNazwaWlasna(e.target.value)}
                className={FIELD}
              />
            </label>
          </div>
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
