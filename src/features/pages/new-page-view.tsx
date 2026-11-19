"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button, MonoLabel } from "@/components/controls";
import { createPageFromTemplate } from "./actions";
import { FIELD_TYPE_META } from "./fields";
import { TEMPLATE_KEYS, TEMPLATES, type TemplateKey } from "./templates";

const AKCENT = "#15803d";
const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// Wybór szablonu nowej strony (NewPage.dc.html): okno 920 px nad przyciemnionym tłem,
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/25">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="np-title"
        className="mx-auto mt-[72px] mb-8 flex w-[min(920px,calc(100%-32px))] flex-col rounded-xl border border-[#e0e0e0] bg-white text-sm text-[#171717] shadow-[0_24px_80px_rgba(0,0,0,.25)] max-[799px]:mt-4"
      >
        <div className="flex items-center justify-between border-b border-[#eaeaea] px-5 py-4">
          <h2 id="np-title" className="m-0 text-base font-semibold">
            Nowa strona
          </h2>
          <button
            type="button"
            aria-label="Zamknij"
            onClick={() => router.back()}
            className="flex size-11 cursor-pointer items-center justify-center rounded-md border-0 bg-transparent text-[#666666] hover:text-[#171717] min-[800px]:size-8"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-wrap">
          <div className="flex min-w-0 flex-[999_1_380px] flex-col gap-3.5 px-5 py-[18px]">
            <label className="flex items-center gap-2 rounded-md border border-[#eaeaea] bg-[#fafafa] px-2.5 py-[7px] text-[#666666]">
              <Search size={15} aria-hidden="true" />
              <input
                type="text"
                value={fraza}
                onChange={(e) => setFraza(e.target.value)}
                placeholder="Szukaj szablonu…"
                aria-label="Szukaj szablonu"
                className="min-w-0 flex-1 border-0 bg-transparent text-[#171717] outline-none"
              />
            </label>
            <MonoLabel>Szablony</MonoLabel>
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
                    style={{ borderColor: zaznaczony ? AKCENT : "#eaeaea" }}
                    className={`flex min-h-[92px] cursor-pointer flex-col items-start gap-1.5 rounded-lg border p-3.5 text-left font-[inherit] ${
                      zaznaczony ? "bg-[#f5f5f5]" : "bg-white"
                    }`}
                  >
                    <span className="flex items-center gap-2 font-medium text-[#171717]">
                      <span aria-hidden="true" className="font-mono text-[#6b6b6b]">
                        {t.icon}
                      </span>
                      {t.name}
                    </span>
                    <span className="text-xs leading-[1.4] text-[#666666]">{t.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-3 border-l border-[#eaeaea] bg-[#fafafa] px-5 py-[18px] max-[799px]:border-t max-[799px]:border-l-0">
            <MonoLabel>Pola, które powstaną</MonoLabel>
            <div className="text-lg font-semibold">{szablon.name}</div>
            <div className="overflow-hidden rounded-lg border border-[#eaeaea]">
              {wybrany !== "empty" &&
                szablon.fields.map((pole) => (
                  <div
                    key={pole.key}
                    className="flex items-center justify-between gap-2.5 border-b border-[#f0f0f0] px-3 py-[9px]"
                  >
                    <span>{pole.name}</span>
                    <span
                      className="rounded border border-[#e0e0e0] px-1.5 py-px font-mono text-[11px] whitespace-nowrap"
                      style={{
                        color:
                          pole.type === "rating" || pole.config?.show_in_calendar
                            ? AKCENT
                            : "#666666",
                      }}
                    >
                      {FIELD_TYPE_META[pole.type].label}
                      {pole.config?.show_in_calendar ? " · w kalendarzu" : ""}
                    </span>
                  </div>
                ))}
              {wybrany === "empty" && (
                <div className="px-3 py-3.5 text-[13px] text-[#666666]">
                  Tylko kolumna „Nazwa”. Pola dodajesz przyciskiem „+ Pole”.
                </div>
              )}
            </div>
            <div className="font-mono text-xs leading-normal whitespace-pre-line text-[#666666]">
              {szablon.extra}
            </div>
            <div className="flex-1" />
            <label className="flex flex-col gap-1.5 text-xs text-[#666666]">
              Nazwa strony
              <input
                type="text"
                value={nazwa}
                maxLength={200}
                onChange={(e) => setNazwaWlasna(e.target.value)}
                className="rounded-md border border-[#e0e0e0] bg-[#fafafa] px-2.5 py-2 text-sm text-[#171717] outline-none focus:border-[#171717]"
              />
            </label>
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-[#eaeaea] px-5 py-3.5">
          <Button onClick={() => router.back()}>Anuluj</Button>
          <Button variant="primary" onClick={utworz} disabled={trwa}>
            Utwórz stronę
          </Button>
        </div>
      </div>
    </div>
  );
}
