"use client";

// Karta „Kategorie kalendarza” (Ustawienia → Kategorie kalendarza): kolejność, ukrywanie,
// edycja nazwy i koloru oraz usuwanie. Układ i styl jak pozostałe karty z Settings.dc.html
// (makiety samej karty nie ma, więc wiersze są po mojemu w tej samej estetyce).
import * as React from "react";

import { Button, FormDialog } from "@/components/controls";
import {
  deleteCategory,
  moveCategory,
  setCategoryHidden,
} from "@/features/categories/actions";
import {
  CategoryDialog,
  type NewCategory,
} from "@/features/categories/category-dialog";
import { cn } from "@/lib/utils";

export type SettingsCategory = {
  id: string;
  name: string;
  color: string;
  position: number;
  is_system: boolean;
  hidden: boolean;
};

// Wygląd 36 px; 44 px pola dotyku dzięki ::after wystającemu o 5 px nad i pod
const PRZYCISK =
  "relative inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-input bg-white px-2.5 text-[13px] text-foreground outline-none hover:bg-panel focus-visible:shadow-focus disabled:cursor-default disabled:opacity-40 after:absolute after:-inset-y-[5px] after:inset-x-0 after:content-['']";

export function CategoriesCard({
  categories,
}: {
  categories: SettingsCategory[];
}) {
  const [lista, setLista] = React.useState(categories);
  // Next 16 zachowuje stan trasy (Activity), więc po nowych danych z serwera stan lokalny trzeba zsynchronizować
  const [poprzednie, setPoprzednie] = React.useState(categories);
  if (poprzednie !== categories) {
    setPoprzednie(categories);
    setLista(categories);
  }

  const [blad, setBlad] = React.useState("");
  const [dialog, setDialog] = React.useState<
    | { typ: "nowa" }
    | { typ: "edycja"; category: SettingsCategory }
    | { typ: "usun"; category: SettingsCategory }
    | null
  >(null);
  const [usuwa, setUsuwa] = React.useState(false);
  const [bladUsuwania, setBladUsuwania] = React.useState("");

  // Zamiana z sąsiadem od razu na ekranie; przy błędzie wraca poprzednia kolejność
  async function przesun(id: string, dir: -1 | 1) {
    const przed = lista;
    const i = przed.findIndex((k) => k.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= przed.length) return;
    const po = [...przed];
    [po[i], po[j]] = [po[j], po[i]];
    setBlad("");
    setLista(po);
    let wynik;
    try {
      wynik = await moveCategory({ id, dir });
    } catch {
      wynik = {
        ok: false as const,
        message: "Nie udało się zapisać. Spróbuj ponownie.",
      };
    }
    if (!wynik.ok) {
      setLista(przed);
      setBlad(wynik.message);
    }
  }

  // Ukrycie też od razu, z cofnięciem przy błędzie
  async function przelaczUkrycie(k: SettingsCategory) {
    const przed = lista;
    setBlad("");
    setLista(
      przed.map((x) => (x.id === k.id ? { ...x, hidden: !k.hidden } : x)),
    );
    let wynik;
    try {
      wynik = await setCategoryHidden({ id: k.id, hidden: !k.hidden });
    } catch {
      wynik = {
        ok: false as const,
        message: "Nie udało się zapisać. Spróbuj ponownie.",
      };
    }
    if (!wynik.ok) {
      setLista(przed);
      setBlad(wynik.message);
    }
  }

  // Usuwanie nie jest optymistyczne: wiersz znika dopiero po potwierdzeniu przez serwer
  async function usun(k: SettingsCategory) {
    if (usuwa) return;
    setUsuwa(true);
    setBladUsuwania("");
    let wynik;
    try {
      wynik = await deleteCategory({ id: k.id });
    } catch {
      wynik = {
        ok: false as const,
        message: "Nie udało się zapisać. Spróbuj ponownie.",
      };
    }
    setUsuwa(false);
    if (!wynik.ok) {
      setBladUsuwania(wynik.message);
      return;
    }
    setLista((l) => l.filter((x) => x.id !== k.id));
    setDialog(null);
  }

  function zapisano(zapisana: NewCategory) {
    setLista((l) =>
      l.some((k) => k.id === zapisana.id)
        ? l.map((k) =>
            k.id === zapisana.id
              ? { ...k, name: zapisana.name, color: zapisana.color }
              : k,
          )
        : [
            ...l,
            {
              ...zapisana,
              position: Math.max(0, ...l.map((k) => k.position)) + 1,
              is_system: false,
              hidden: false,
            },
          ],
    );
    setDialog(null);
  }

  return (
    <section className="rounded-lg border border-border bg-white">
      <div className="p-5">
        <h2 className="m-0 text-base font-semibold">Kategorie kalendarza</h2>
        <p className="mt-1 mb-4 text-muted-foreground">
          Kolory i kolejność kategorii w kalendarzu.
        </p>

        <ul className="m-0 flex list-none flex-col p-0">
          {lista.map((k, i) => (
            <li
              key={k.id}
              aria-label={k.name}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-2 first:border-t-0 max-[799px]:py-2.5"
            >
              <span
                aria-hidden="true"
                className="size-2.5 flex-none rounded-full"
                style={{ background: k.color }}
              />
              <span
                className={cn(
                  "flex min-w-0 flex-1 items-center gap-2",
                  k.hidden && "opacity-50",
                )}
              >
                {k.is_system ? (
                  <span className="truncate font-medium">{k.name}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDialog({ typ: "edycja", category: k })}
                    className="relative cursor-pointer truncate border-0 bg-transparent p-0 text-left text-sm font-medium text-foreground outline-none hover:underline focus-visible:shadow-focus after:absolute after:-inset-y-[13px] after:inset-x-0 after:content-['']"
                  >
                    {k.name}
                  </button>
                )}
                {k.is_system && (
                  <span className="flex-none rounded-[4px] border border-input bg-muted px-[7px] py-0.5 font-mono text-[11px] text-muted-foreground">
                    systemowa
                  </span>
                )}
              </span>

              <span className="flex flex-none items-center gap-1.5 max-[799px]:w-full max-[799px]:justify-end max-[799px]:pb-[5px]">
                {i > 0 ? (
                  <button
                    type="button"
                    aria-label="W górę"
                    className={cn(PRZYCISK, "w-9 px-0")}
                    onClick={() => przesun(k.id, -1)}
                  >
                    ↑
                  </button>
                ) : (
                  <span aria-hidden="true" className="w-9" />
                )}
                {i < lista.length - 1 ? (
                  <button
                    type="button"
                    aria-label="W dół"
                    className={cn(PRZYCISK, "w-9 px-0")}
                    onClick={() => przesun(k.id, 1)}
                  >
                    ↓
                  </button>
                ) : (
                  <span aria-hidden="true" className="w-9" />
                )}
                <button
                  type="button"
                  className={PRZYCISK}
                  onClick={() => przelaczUkrycie(k)}
                >
                  {k.hidden ? "Pokaż" : "Ukryj"}
                </button>
                {!k.is_system && (
                  <button
                    type="button"
                    className={cn(PRZYCISK, "text-destructive-foreground")}
                    onClick={() => {
                      setBladUsuwania("");
                      setDialog({ typ: "usun", category: k });
                    }}
                  >
                    Usuń
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>

        {blad && (
          <p role="alert" className="mt-3 mb-0 text-[13px] text-destructive-foreground">
            {blad}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2.5 rounded-b-lg border-t border-border bg-panel px-5 py-3 max-[799px]:flex-col max-[799px]:items-stretch">
        <span className="text-[13px] text-muted-foreground">
          Ukryte kategorie znikają z kalendarza, ale zostają tutaj.
        </span>
        <Button
          onClick={() => setDialog({ typ: "nowa" })}
          className="max-[799px]:h-12"
        >
          + Kategoria
        </Button>
      </div>

      {(dialog?.typ === "nowa" || dialog?.typ === "edycja") && (
        <CategoryDialog
          // Nowy klucz przy zmianie kategorii, żeby formularz startował z jej wartościami
          key={dialog.typ === "edycja" ? dialog.category.id : "nowa"}
          category={dialog.typ === "edycja" ? dialog.category : undefined}
          usedColors={lista.map((k) => k.color)}
          onSaved={zapisano}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog?.typ === "usun" && (
        <FormDialog
          open
          onOpenChange={(otwarte) => !otwarte && setDialog(null)}
          title={`Usunąć kategorię „${dialog.category.name}”?`}
          footer={
            <>
              {bladUsuwania && (
                <p role="alert" className="mr-auto text-xs text-destructive-foreground">
                  {bladUsuwania}
                </p>
              )}
              <Button variant="ghost" onClick={() => setDialog(null)}>Anuluj</Button>
              <Button
                variant="destructive"
                disabled={usuwa}
                onClick={() => usun(dialog.category)}
              >
                Usuń
              </Button>
            </>
          }
        >
          <p className="m-0 text-[13px] text-muted-foreground">
            Bloki zostaną bez kategorii.
          </p>
        </FormDialog>
      )}
    </section>
  );
}
