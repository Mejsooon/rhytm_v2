"use client";

import { Check } from "lucide-react";

import { Button, Card, StatusBadge } from "@/components/controls";
import { cn } from "@/lib/utils";
import { TEMPLATE_KEYS, TEMPLATES, type TemplateKey } from "../templates";

// Telefon: „Nowa strona” według CMNewPage.dc.html — nagłówek „Strony” (m-head z .lbl) przyciemniony pod
// arkuszem 88% z paskiem „Anuluj · Nowa strona · Utwórz” (44 px), polem nazwy, listą szablonów (m-row z opisem),
// chipami „Pól, które powstaną” i dopiskiem szablonu. Stan i zapis trzyma NewPageView (to samo co na webie).
export function MNewPage({
  selected,
  onSelect,
  name,
  onNameChange,
  busy,
  onCreate,
  onCancel,
}: {
  selected: TemplateKey;
  onSelect: (key: TemplateKey) => void;
  name: string;
  onNameChange: (name: string) => void;
  busy: boolean;
  onCreate: () => void;
  onCancel: () => void;
}) {
  const szablon = TEMPLATES[selected];
  const liniePodpisu = szablon.extra.split("\n").filter((linia) => linia !== "");

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="m-head py-1" aria-hidden="true">
        <div className="min-w-0 flex-1">
          <div className="text-xs font-medium text-muted-foreground">Twoje tabele i notatki</div>
          <h1 className="m-title">Strony</h1>
        </div>
      </header>
      <div aria-hidden="true" className="p-4 opacity-45">
        <div className="h-[420px] rounded-xl border border-border" />
      </div>
      <button
        type="button"
        aria-label="Zamknij"
        onClick={onCancel}
        className="absolute inset-0 cursor-pointer border-0 bg-black/[.32]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Nowa strona"
        className="absolute inset-x-0 bottom-0 flex h-[88%] flex-col rounded-t-2xl border border-b-0 border-border bg-white text-sm text-foreground shadow-[0_-8px_30px_rgba(0,0,0,.12)]"
      >
        <div aria-hidden="true" className="m-grab flex-none" />
        <div className="flex flex-none items-center gap-1 border-b border-border px-3 pt-1 pb-2">
          <Button variant="ghost" onClick={onCancel} className="text-muted-foreground">
            Anuluj
          </Button>
          <h2 className="m-0 flex-1 text-center text-lg leading-[1.3] font-semibold">Nowa strona</h2>
          <Button variant="primary" onClick={onCreate} disabled={busy}>
            Utwórz
          </Button>
        </div>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 pt-4 pb-[max(20px,env(safe-area-inset-bottom))]">
          <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
            Nazwa strony
            <input
              type="text"
              value={name}
              maxLength={200}
              placeholder="Bez tytułu"
              onChange={(e) => onNameChange(e.target.value)}
              className="block h-11 w-full min-w-0 rounded-md border border-input bg-white bg-clip-padding px-[11px] text-base font-normal text-foreground shadow-xs outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-faint-foreground focus:border-ring focus:shadow-halo"
            />
          </label>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Szablon</span>
            <span className="-mt-0.5 text-xs text-muted-foreground">
              Szablon wstawia zwykłą stronę z gotową tabelą i kartami. Wszystko zmienisz później.
            </span>
            <Card role="group" aria-label="Szablon" className="mt-1.5 overflow-hidden">
              {TEMPLATE_KEYS.map((klucz) => {
                const t = TEMPLATES[klucz];
                const zaznaczony = klucz === selected;
                return (
                  <button
                    key={klucz}
                    type="button"
                    aria-pressed={zaznaczony}
                    onClick={() => onSelect(klucz)}
                    className={cn(
                      "m-row w-full cursor-pointer border-x-0 border-t-0 bg-transparent text-left font-[inherit] text-sm text-foreground",
                      zaznaczony && "bg-black/[.03]",
                    )}
                  >
                    <span className="min-w-0 flex-1 py-2.5">
                      <span className="block font-medium">{t.name}</span>
                      <span className="text-xs text-muted-foreground">{t.desc}</span>
                    </span>
                    {zaznaczony && <Check size={16} aria-hidden="true" className="flex-none" />}
                  </button>
                );
              })}
            </Card>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Pola, które powstaną</span>
            <div className="flex flex-wrap gap-1.5">
              {selected === "empty" ? (
                <StatusBadge tone="gray">bez pól</StatusBadge>
              ) : (
                szablon.fields.map((pole) => (
                  <StatusBadge key={pole.key} tone="gray">
                    {pole.name}
                  </StatusBadge>
                ))
              )}
            </div>
            {liniePodpisu.map((linia) => (
              <span key={linia} className="text-xs text-muted-foreground">
                {linia}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
