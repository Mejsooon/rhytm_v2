"use client";

// Stan bloków edytora z optymistycznymi zmianami (dodanie, edycja, usunięcie z „Cofnij”).
// Błąd zapisu cofa zmianę i pokazuje toast. Nowe dane z serwera zastępują kopię — wzorzec
// „poprzednie props”, jak w use-today-store.ts (Next 16 Activity nie montuje trasy od nowa).
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  addBlock,
  deleteBlock,
  restoreBlock,
  updateBlockContent,
} from "../actions";
import type { BlockType, LoadedBlock } from "../load-page";
import { BLAD_ZAPISU } from "../messages";

export type EditorStore = ReturnType<typeof useEditorStore>;

// Blok czekający na odpowiedź serwera ma tymczasowe id z tym prefiksem
const PREFIKS_TYMCZASOWY = "tmp-";

export function useEditorStore(pageId: string, initial: LoadedBlock[]) {
  const router = useRouter();
  const [zrodlo, setZrodlo] = useState(initial);
  const [blocks, setBlocks] = useState(initial);
  // Treść zmieniona, zanim blok dostał prawdziwe id: tymczasowe id → ostatnia treść do zapisu
  const oczekujaceTresci = useRef(new Map<string, Record<string, unknown>>());
  // Zapisy treści w toku: id bloku → treść wysyłana na serwer
  const zapisyWToku = useRef(new Map<string, Record<string, unknown>>());
  const licznik = useRef(0);
  // Id bloków dodanych w tej sesji, dopóki dane z serwera ich nie dogonią
  const [dodaneLokalnie, setDodaneLokalnie] = useState<ReadonlySet<string>>(
    new Set(),
  );

  // Nowe dane z serwera (np. po renamePage) nie mogą zgubić bloków tymczasowych, treści z zapisem
  // w toku ani świeżo dodanych bloków: odpowiedź odświeżenia mogła zostać odczytana przed wstawieniem
  // bloku (brak go) albo między wstawieniem bloku a jego pól (mniej pól / wierszy niż lokalnie)
  if (zrodlo !== initial) {
    setZrodlo(initial);
    // Lokalna kopia jest nowsza od serwerowej, gdy serwer ma mniej pól albo wierszy
    const nowszaLokalnie = (b: LoadedBlock, lokalny: LoadedBlock | undefined) =>
      lokalny !== undefined &&
      (b.fields.length < lokalny.fields.length ||
        b.rows.length < lokalny.rows.length);
    // Serwer dogonił bloki dodane lokalnie, więc przestajemy je pilnować
    const dogonione = initial
      .filter(
        (b) =>
          dodaneLokalnie.has(b.id) &&
          !nowszaLokalnie(
            b,
            blocks.find((x) => x.id === b.id),
          ),
      )
      .map((b) => b.id);
    setBlocks((l) => {
      const idSerwera = new Set(initial.map((b) => b.id));
      return [
        ...initial.map((b) => {
          const wToku = zapisyWToku.current.get(b.id);
          const serwerowy = wToku ? { ...b, content: wToku } : b;
          const lokalny = l.find((x) => x.id === b.id);
          return dodaneLokalnie.has(b.id) && nowszaLokalnie(b, lokalny)
            ? { ...lokalny!, content: serwerowy.content }
            : serwerowy;
        }),
        ...l.filter(
          (b) =>
            b.id.startsWith(PREFIKS_TYMCZASOWY) ||
            (dodaneLokalnie.has(b.id) && !idSerwera.has(b.id)),
        ),
      ];
    });
    if (dogonione.length > 0)
      setDodaneLokalnie(
        new Set([...dodaneLokalnie].filter((id) => !dogonione.includes(id))),
      );
  }

  const posortowane = [...blocks].sort((a, b) => a.position - b.position);

  // Dodaje blok na końcu strony; do czasu odpowiedzi serwera ma tymczasowe id
  async function add(type: BlockType, text?: string): Promise<boolean> {
    const tymczasoweId = `${PREFIKS_TYMCZASOWY}${++licznik.current}`;
    const pozycja = blocks.reduce((m, b) => Math.max(m, b.position), -1) + 1;
    let content: Record<string, unknown> = {};
    if (type === "text" || type === "heading") content = { text: text ?? "" };
    if (type === "todo") content = { text: text ?? "", done: false };
    if (type === "table") content = { name: "" };
    const tymczasowy: LoadedBlock = {
      id: tymczasoweId,
      type,
      position: pozycja,
      content,
      fields: [],
      rows: [],
    };
    setBlocks((l) => [...l, tymczasowy]);

    let wynik: Awaited<ReturnType<typeof addBlock>> | null = null;
    try {
      wynik = await addBlock(pageId, type, text);
    } catch {
      wynik = null;
    }
    if (!wynik || !wynik.ok) {
      setBlocks((l) => l.filter((b) => b.id !== tymczasoweId));
      oczekujaceTresci.current.delete(tymczasoweId);
      toast.error(BLAD_ZAPISU);
      return false;
    }

    const prawdziwy = wynik.block;
    // Zachowujemy treść, którą użytkownik zdążył zmienić przed odpowiedzią serwera
    const zmieniona = oczekujaceTresci.current.get(tymczasoweId);
    oczekujaceTresci.current.delete(tymczasoweId);
    const gotowy = { ...prawdziwy, content: zmieniona ?? prawdziwy.content };
    setDodaneLokalnie((z) => new Set(z).add(prawdziwy.id));
    setBlocks((l) => {
      // Odświeżenie danych mogło już usunąć blok tymczasowy albo dodać prawdziwy — bez duplikatów
      const bezDuplikatu = l.filter((b) => b.id !== prawdziwy.id);
      return bezDuplikatu.some((b) => b.id === tymczasoweId)
        ? bezDuplikatu.map((b) => (b.id === tymczasoweId ? gotowy : b))
        : [...bezDuplikatu, gotowy];
    });
    if (zmieniona) {
      let zapisano = false;
      try {
        zapisano = (await updateBlockContent(prawdziwy.id, zmieniona)).ok;
      } catch {
        zapisano = false;
      }
      if (!zapisano) {
        setBlocks((l) =>
          l.map((b) =>
            b.id === prawdziwy.id ? { ...b, content: prawdziwy.content } : b,
          ),
        );
        toast.error(BLAD_ZAPISU);
      }
    }
    return true;
  }

  // Zmiana treści bloku; błąd przywraca poprzednią treść
  async function update(
    id: string,
    content: Record<string, unknown>,
  ): Promise<boolean> {
    const poprzednia = blocks.find((b) => b.id === id)?.content;
    if (poprzednia === undefined) return false;
    setBlocks((l) => l.map((b) => (b.id === id ? { ...b, content } : b)));

    // Blok jeszcze bez prawdziwego id: treść zapisze się zaraz po odpowiedzi serwera
    if (id.startsWith(PREFIKS_TYMCZASOWY)) {
      oczekujaceTresci.current.set(id, content);
      return true;
    }

    zapisyWToku.current.set(id, content);
    let udane = false;
    try {
      udane = (await updateBlockContent(id, content)).ok;
    } catch {
      udane = false;
    }
    if (zapisyWToku.current.get(id) === content) zapisyWToku.current.delete(id);
    if (!udane) {
      setBlocks((l) =>
        l.map((b) => (b.id === id ? { ...b, content: poprzednia } : b)),
      );
      toast.error(BLAD_ZAPISU);
    }
    return udane;
  }

  // Usunięcie: od razu znika, toast „Usunięto” z akcją „Cofnij” (restoreBlock + powrót na swoją pozycję)
  async function remove(id: string): Promise<boolean> {
    const usuwany = blocks.find((b) => b.id === id);
    if (!usuwany) return false;
    // Tymczasowego bloku nie da się jeszcze usunąć na serwerze
    if (id.startsWith(PREFIKS_TYMCZASOWY)) return false;
    setBlocks((l) => l.filter((b) => b.id !== id));
    setDodaneLokalnie((z) => new Set([...z].filter((x) => x !== id)));

    let udane = false;
    try {
      udane = (await deleteBlock(id)).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setBlocks((l) => (l.some((b) => b.id === id) ? l : [...l, usuwany]));
      toast.error(BLAD_ZAPISU);
      return false;
    }

    toast("Usunięto", {
      action: {
        label: "Cofnij",
        onClick: async () => {
          // Blok wraca od razu na swoją pozycję (lista jest sortowana po position)
          setBlocks((l) =>
            l.some((b) => b.id === usuwany.id) ? l : [...l, usuwany],
          );
          let przywrocono = false;
          try {
            przywrocono = (await restoreBlock(id)).ok;
          } catch {
            przywrocono = false;
          }
          if (!przywrocono) {
            setBlocks((l) => l.filter((b) => b.id !== usuwany.id));
            toast.error(BLAD_ZAPISU);
            return;
          }
          // Kopia tabeli w magazynie edytora pamięta stan z wczytania strony (zmiany wierszy i kolumn
          // żyły tylko w TableBlock), więc pobieramy świeże dane — resync podmieni wiersze i kolumny
          if (usuwany.type === "table") router.refresh();
        },
      },
    });
    return true;
  }

  return { blocks: posortowane, add, update, remove };
}
