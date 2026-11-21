"use client";

// Karta „Kategorie kalendarza” (Ustawienia → Kategorie kalendarza): kolejność, ukrywanie,
// edycja nazwy i koloru oraz usuwanie. Makiety karty nie ma, więc styl jak karty Profil i Cele
// z CSettings.dc.html (.card, wiersze z separatorem, stopka .foot).
import * as React from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  FormDialog,
  StatusBadge,
} from "@/components/controls";
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
    <Card>
      <CardHeader>
        <div>
          <CardTitle as="h2">Kategorie kalendarza</CardTitle>
          <CardDescription>
            Kolory i kolejność kategorii w kalendarzu.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <ul className="m-0 flex list-none flex-col p-0">
          {lista.map((k, i) => (
            <li
              key={k.id}
              aria-label={k.name}
              className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border py-2.5 first:border-t-0"
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
                  <StatusBadge tone="gray" className="flex-none">
                    systemowa
                  </StatusBadge>
                )}
              </span>

              <span className="flex flex-none items-center gap-1.5 max-[799px]:w-full max-[799px]:justify-end">
                {/* Stałe sloty: strzałki, „Ukryj”/„Pokaż” i „Usuń” w tych samych kolumnach w każdym wierszu */}
                <span
                  data-slot="kolejnosc"
                  className="flex w-[68px] flex-none items-center gap-1 max-[799px]:w-[92px]"
                >
                  {/* Dwa podsloty o stałej szerokości: ↑ zawsze po lewej, ↓ zawsze po prawej */}
                  <span
                    data-slot="w-gore"
                    className="flex w-8 flex-none max-[799px]:w-11"
                  >
                    {i > 0 && (
                      <Button
                        icon
                        aria-label="W górę"
                        onClick={() => przesun(k.id, -1)}
                      >
                        ↑
                      </Button>
                    )}
                  </span>
                  <span
                    data-slot="w-dol"
                    className="flex w-8 flex-none max-[799px]:w-11"
                  >
                    {i < lista.length - 1 && (
                      <Button
                        icon
                        aria-label="W dół"
                        onClick={() => przesun(k.id, 1)}
                      >
                        ↓
                      </Button>
                    )}
                  </span>
                </span>
                <span data-slot="ukryj" className="flex w-16 flex-none">
                  <Button
                    className="w-full"
                    onClick={() => przelaczUkrycie(k)}
                  >
                    {k.hidden ? "Pokaż" : "Ukryj"}
                  </Button>
                </span>
                <span data-slot="usun" className="flex w-16 flex-none">
                  {!k.is_system && (
                    <Button
                      variant="destructive-outline"
                      className="w-full"
                      onClick={() => {
                        setBladUsuwania("");
                        setDialog({ typ: "usun", category: k });
                      }}
                    >
                      Usuń
                    </Button>
                  )}
                </span>
              </span>
            </li>
          ))}
        </ul>

        {blad && (
          <p role="alert" className="mt-3 mb-0 text-[13px] text-destructive-foreground">
            {blad}
          </p>
        )}
      </CardContent>

      <CardFooter className="max-[799px]:flex-col max-[799px]:items-stretch">
        <span className="text-[13px] text-muted-foreground">
          Ukryte kategorie znikają z kalendarza, ale zostają tutaj.
        </span>
        <Button
          onClick={() => setDialog({ typ: "nowa" })}
          className="max-[799px]:h-12"
        >
          + Kategoria
        </Button>
      </CardFooter>

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
    </Card>
  );
}
