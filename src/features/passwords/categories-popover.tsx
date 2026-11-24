"use client";

import * as React from "react";

import { ActionPopover, Button, FIELD, MENU_LABEL } from "@/components/controls";
import type { FieldOption } from "@/features/pages/fields";
import { OptionBadge } from "@/features/pages/table/option-badge";

// Przycisk „Kategorie” z dymkiem „Opcje kategorii” (S2Passwords.dc.html): lista opcji pola Kategoria z „×”,
// pole „Nowa kategoria” i „Dodaj”. Sam nic nie zapisuje: dodawanie i usuwanie idzie przez funkcje magazynu
// tabeli (PageTable je podaje), więc lista jest ta sama co w okienku komórki. Zamknięty sejf: przycisk wyłączony.
// `phone` (CMPasswords): wyzwalacz to „Edytuj” (btng, nazwa „Opcje kategorii”) obok chipów kategorii.
export function CategoriesPopover({
  options,
  readOnly,
  onCreate,
  onRemove,
  phone = false,
}: {
  options: FieldOption[];
  readOnly: boolean;
  onCreate: (label: string) => Promise<unknown> | void;
  onRemove: (optionId: string) => Promise<unknown> | void;
  phone?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [nowa, setNowa] = React.useState("");

  return (
    <ActionPopover
      open={open && !readOnly}
      onOpenChange={setOpen}
      align="start"
      width={260}
      ariaLabel="Opcje kategorii"
      className="flex flex-col gap-2"
      trigger={
        phone ? (
          <Button
            variant="ghost"
            disabled={readOnly}
            aria-label="Opcje kategorii"
            aria-haspopup="dialog"
            aria-expanded={open && !readOnly}
            className="px-1.5"
          >
            Edytuj
          </Button>
        ) : (
          <Button size="sm" disabled={readOnly} aria-haspopup="dialog" aria-expanded={open && !readOnly}>
            Kategorie
          </Button>
        )
      }
    >
      <div className={`${MENU_LABEL} p-0`}>Opcje kategorii</div>
      <ul aria-label="Kategorie haseł" className="m-0 flex list-none flex-wrap gap-1 p-0">
        {options.map((o) => (
          <li key={o.id}>
            <OptionBadge option={o}>
              <button
                type="button"
                aria-label={`Usuń kategorię ${o.label}`}
                onClick={() => void onRemove(o.id)}
                className="relative cursor-pointer border-0 bg-transparent p-0 pl-0.5 font-[inherit] text-inherit opacity-60 max-[799px]:before:absolute max-[799px]:before:-inset-3.5 max-[799px]:before:content-[''] hover:opacity-100"
              >
                ×
              </button>
            </OptionBadge>
          </li>
        ))}
      </ul>
      <form
        className="flex gap-1.5"
        onSubmit={(e) => {
          e.preventDefault();
          const etykieta = nowa.trim();
          if (etykieta === "") return;
          // Pole czyścimy od razu; duplikat albo błąd zapisu magazyn zgłosi sam (null / toast)
          setNowa("");
          void onCreate(etykieta);
        }}
      >
        <input
          type="text"
          value={nowa}
          onChange={(e) => setNowa(e.target.value)}
          placeholder="Nowa kategoria…"
          aria-label="Nowa kategoria"
          className={FIELD}
        />
        <Button size="sm" type="submit" className="flex-none max-[799px]:h-11">
          Dodaj
        </Button>
      </form>
    </ActionPopover>
  );
}
