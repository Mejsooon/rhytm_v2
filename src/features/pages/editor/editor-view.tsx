"use client";

import * as React from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ActionPopover, Button, Chip } from "@/components/controls";
import { ModuleHeader } from "@/components/shell/module-header";
import { renamePage, setPageIcon } from "../actions";
import { usePagesStore } from "../use-pages-store";
import { IconPicker } from "../icon-picker";
import { PageIcon } from "../page-icon";
import { QUICK_START } from "../blocks";
import type { LoadedPage } from "../load-page";
import type { PageSummary } from "../load-pages";
import { BLAD_ZAPISU } from "../messages";
import { CommandLine } from "./command-line";
import { MEditor } from "./mobile/m-editor";
import { TableBlock } from "./table-block";
import { TextBlock } from "./text-block";
import { TodoBlock } from "./todo-block";
import { useEditorStore } from "./use-editor-store";

// Edytor bloków strony bez szablonu (CEmptyPage.dc.html): ikona, tytuł, bloki, linia poleceń,
// szybki start i link do szablonów. Telefon dostaje ten sam układ w jednej kolumnie.
// `pages` — cała lista stron dla „Przenieś wyżej / niżej” w menu strony na telefonie.
export function EditorView({ data, pages }: { data: LoadedPage; pages?: PageSummary[] }) {
  const { page } = data;
  const store = useEditorStore(page.id, data.blocks);
  // Menu strony na telefonie działa na całej liście stron (bez niej — tylko na tej stronie)
  const listaStron = React.useMemo(
    () => (pages?.some((p) => p.id === page.id) ? pages : [page]),
    [pages, page],
  );
  const pagesStore = usePagesStore(listaStron);
  const tytulRef = React.useRef<HTMLInputElement>(null);

  // Tytuł i ikona: lokalny szkic + ostatnia zapisana wartość (resync przy nowych danych z serwera)
  const [tytul, setTytul] = React.useState(page.title);
  const [zapisanyTytul, setZapisanyTytul] = React.useState(page.title);
  const [tytulZrodlo, setTytulZrodlo] = React.useState(page.title);
  if (tytulZrodlo !== page.title) {
    setTytulZrodlo(page.title);
    setTytul(page.title);
    setZapisanyTytul(page.title);
  }
  const [ikona, setIkona] = React.useState(page.icon);
  const [ikonaZrodlo, setIkonaZrodlo] = React.useState(page.icon);
  if (ikonaZrodlo !== page.icon) {
    setIkonaZrodlo(page.icon);
    setIkona(page.icon);
  }
  const [wyborIkony, setWyborIkony] = React.useState(false);

  async function zapiszTytul() {
    if (tytul === zapisanyTytul) return;
    const poprzedni = zapisanyTytul;
    setZapisanyTytul(tytul);
    let udane = false;
    try {
      udane = (await renamePage(page.id, tytul)).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setTytul(poprzedni);
      setZapisanyTytul(poprzedni);
      toast.error(BLAD_ZAPISU);
    }
  }

  async function zmienIkone(nowa: string) {
    const poprzednia = ikona;
    setWyborIkony(false);
    if (nowa === poprzednia) return;
    setIkona(nowa);
    let udane = false;
    try {
      udane = (await setPageIcon(page.id, nowa)).ok;
    } catch {
      udane = false;
    }
    if (!udane) {
      setIkona(poprzednia);
      toast.error(BLAD_ZAPISU);
    }
  }

  const sciezka = tytul.trim() === "" ? "Bez tytułu" : tytul;
  const pusta = store.blocks.length === 0;

  return (
    <>
      {/* Telefon ma własny nagłówek w MEditor */}
      <div className="max-[799px]:hidden">
        <ModuleHeader
          title={sciezka}
          webParent="Strony"
          phoneLabel="Strony"
          webAction={
            <Button asChild size="sm">
              <Link href="/strony/nowa">Szablony</Link>
            </Button>
          }
        />
      </div>
      <MEditor
        store={store}
        page={pagesStore.pages.find((p) => p.id === page.id) ?? page}
        pages={pagesStore.pages}
        pagesStore={pagesStore}
        // Fokus wraca na przycisk menu dopiero po zamknięciu arkusza, więc przenosimy go chwilę później
        onRename={() => setTimeout(() => tytulRef.current?.focus(), 50)}
      >
        <div className="box-border flex w-full max-w-[1160px] flex-col gap-3 px-6 pt-7 pb-40 max-[799px]:px-4 max-[799px]:pt-0 max-[799px]:pb-0">
          <div className="mb-2 flex items-center gap-3">
            <ActionPopover
              open={wyborIkony}
              onOpenChange={setWyborIkony}
              width={300}
              ariaLabel="Wybór ikony"
              trigger={
                <button
                  type="button"
                  aria-label="Zmień ikonę"
                  className={`flex size-10 cursor-pointer items-center justify-center rounded-[10px] p-0 font-[inherit] max-[799px]:hidden ${
                    ikona === ""
                      ? "border border-dashed border-black/[.18] bg-panel text-muted-foreground"
                      : "border border-transparent bg-transparent text-foreground"
                  }`}
                >
                  <PageIcon icon={ikona} size={22} />
                </button>
              }
            >
              <IconPicker value={ikona} onPick={zmienIkone} />
            </ActionPopover>
            {/* Telefon: sama ikona przy tytule; zmienia się ją w menu strony („Zmień ikonę”), więc z pagesStore */}
            <span className="text-foreground min-[800px]:hidden">
              <PageIcon icon={(pagesStore.pages.find((p) => p.id === page.id) ?? page).icon} size={28} />
            </span>
            <input
              ref={tytulRef}
              type="text"
              value={tytul}
              onChange={(e) => setTytul(e.target.value)}
              onBlur={zapiszTytul}
              placeholder="Bez tytułu"
              aria-label="Nazwa strony"
              className="min-w-0 flex-1 border-0 bg-transparent font-[inherit] text-2xl font-semibold tracking-[-0.02em] text-foreground outline-none max-[799px]:text-[28px]"
            />
          </div>

          {store.blocks.map((b) => (
            <div key={b.id} className="group relative pr-9">
              {b.type === "heading" && (
                <TextBlock
                  variant="heading"
                  text={
                    typeof b.content.text === "string" ? b.content.text : ""
                  }
                  onSave={(text) => void store.update(b.id, { text })}
                />
              )}
              {b.type === "text" && (
                <TextBlock
                  variant="text"
                  text={
                    typeof b.content.text === "string" ? b.content.text : ""
                  }
                  onSave={(text) => void store.update(b.id, { text })}
                />
              )}
              {b.type === "todo" && (
                <TodoBlock
                  text={
                    typeof b.content.text === "string" ? b.content.text : ""
                  }
                  done={b.content.done === true}
                  onSave={(content) => void store.update(b.id, content)}
                />
              )}
              {b.type === "divider" && (
                <hr className="my-3 h-px border-0 bg-border" />
              )}
              {b.type === "table" && (
                <TableBlock block={b} editable="cell" today={data.today} />
              )}
              {/* .blk-act.btng.ic.xs: pojawia się po najechaniu lub fokusie; na telefonie zawsze, 44 px */}
              <Button
                variant="ghost"
                size="xs"
                icon
                aria-label="Usuń blok"
                onClick={() => void store.remove(b.id)}
                className="absolute top-1 right-0 text-destructive-foreground opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 hover:text-destructive-foreground focus-visible:opacity-100 max-[799px]:size-11 max-[799px]:opacity-100"
              >
                <Trash2 size={14} aria-hidden="true" />
              </Button>
            </div>
          ))}

          <div className="max-[799px]:hidden">
            <CommandLine
              onInsert={(typ, tekst) => void store.add(typ, tekst)}
            />
          </div>

          {pusta && (
            <div className="flex flex-col gap-3 max-[799px]:hidden">
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-[13px] text-muted-foreground">
                  albo zacznij od:
                </span>
                {QUICK_START.map((q) => (
                  <Chip key={q.type} onClick={() => void store.add(q.type)}>
                    <span
                      aria-hidden="true"
                      className="text-xs font-semibold text-muted-foreground"
                    >
                      {q.icon}
                    </span>
                    {q.label}
                  </Chip>
                ))}
              </div>
              <p className="mt-6 mb-0 text-[13px] text-muted-foreground">
                Wolisz gotowca?{" "}
                <Link href="/strony/nowa" className="font-medium text-foreground underline-offset-[3px]">
                  Użyj szablonu →
                </Link>
              </p>
            </div>
          )}
        </div>
      </MEditor>
    </>
  );
}
