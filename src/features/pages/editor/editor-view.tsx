"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutGrid, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ActionPopover, Button, Chip } from "@/components/controls";
import { ModuleHeader } from "@/components/shell/module-header";
import { renamePage, setPageIcon } from "../actions";
import { usePagesStore } from "../use-pages-store";
import { IconPicker } from "../icon-picker";
import { PageIcon } from "../page-icon";
import { PageMenu } from "../page-menu";
import { QUICK_START } from "../blocks";
import type { LoadedPage } from "../load-page";
import type { PageSummary } from "../load-pages";
import { BLAD_ZAPISU } from "../messages";
import { rowsLabel } from "../rows-label";
import { CommandLine } from "./command-line";
import { PageTable } from "../table/page-table";
import { MSubs } from "../table/mobile/m-subs";
import { MEditor } from "./mobile/m-editor";
import { TextBlock } from "./text-block";
import { TodoBlock } from "./todo-block";
import { useEditorStore } from "./use-editor-store";

// Edytor bloków każdej strony poza Hasłami (S2Books / S2EmptyPage.dc.html): okruszki z menu strony „⋯”,
// ikona, tytuł, bloki (tabela to PageTable), linia poleceń, szybki start i link do szablonów.
// Telefon dostaje ten sam układ w jednej kolumnie.
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
  // Strona z magazynu (ulubione, ikona i nazwa zmienione w menu strony)
  const stronaWMenu = pagesStore.pages.find((p) => p.id === page.id) ?? page;
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
  // Subscriptions na telefonie (CMSubs, T16): strona z szablonu Subscriptions, której tabela ma pola Kwota cykliczna
  // i Data odnowienia, dostaje własny ekran zamiast edytora; inne strony zostają przy edytorze (CMEditor)
  const blokSubs =
    page.templateKey === "subscriptions"
      ? store.blocks.find(
          (b) =>
            b.type === "table" &&
            b.fields.some((f) => f.type === "recurring") &&
            b.fields.some((f) => f.type === "renewal"),
        )
      : undefined;

  return (
    <>
      {/* Telefon ma własny nagłówek w MEditor */}
      <div className="max-[799px]:hidden">
        <ModuleHeader
          title={sciezka}
          webParent="Strony"
          phoneLabel="Strony"
          webAction={
            <>
              {/* S2EmptyPage.dc.html: pusta strona ma w nagłówku „Szablony” (.btn) przed menu strony */}
              {pusta && (
                <Button asChild>
                  <Link href="/strony/nowa">
                    <LayoutGrid size={16} aria-hidden="true" />
                    Szablony
                  </Link>
                </Button>
              )}
              {/* .btn.ic z S2Books.dc.html: kwadratowy przycisk 32 px z „⋯” (S2PageMenu.dc.html) */}
              <PageMenu
                page={stronaWMenu}
                pages={pagesStore.pages}
                store={pagesStore}
                // „Zmień nazwę” przenosi fokus na tytuł; dymek oddaje fokus przyciskowi, więc chwilę później
                onRename={() => setTimeout(() => tytulRef.current?.focus(), 50)}
                triggerLabel="Menu strony"
                // Przycisk stoi przy prawej krawędzi okna, więc dymek wyrównany do jego końca
                align="end"
                triggerClassName="relative inline-flex size-8 flex-none cursor-pointer items-center justify-center rounded-md border border-input bg-white bg-clip-padding text-foreground shadow-btn outline-none transition-[box-shadow,background-color] duration-150 hover:bg-panel focus-visible:shadow-focus aria-expanded:bg-accent [&_svg]:opacity-80"
              />
            </>
          }
        />
      </div>
      <MEditor
        store={store}
        page={stronaWMenu}
        pages={pagesStore.pages}
        pagesStore={pagesStore}
        ownScreen={blokSubs !== undefined}
        // Fokus wraca na przycisk menu dopiero po zamknięciu arkusza, więc przenosimy go chwilę później
        onRename={() => setTimeout(() => tytulRef.current?.focus(), 50)}
      >
        <div className="box-border flex w-full min-w-0 flex-col gap-3 px-6 pt-7 pb-40 max-[799px]:gap-2.5 max-[799px]:px-4 max-[799px]:pt-2 max-[799px]:pb-0">
          {/* Telefon Subscriptions: tytuł strony rysuje MSubs */}
          <div className={`mb-2 flex items-center gap-3 ${blokSubs ? "max-[799px]:hidden" : ""}`}>
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
                      ? "border border-dashed border-border-strong bg-panel text-muted-foreground"
                      : "border border-transparent bg-transparent text-foreground"
                  }`}
                >
                  <PageIcon icon={ikona} size={22} />
                </button>
              }
            >
              <IconPicker value={ikona} onPick={zmienIkone} />
            </ActionPopover>
            <input
              ref={tytulRef}
              type="text"
              value={tytul}
              onChange={(e) => setTytul(e.target.value)}
              onBlur={zapiszTytul}
              placeholder="Bez tytułu"
              aria-label="Nazwa strony"
              className="min-w-0 flex-1 border-0 bg-transparent font-[inherit] text-2xl font-semibold tracking-[-0.02em] text-foreground outline-none"
            />
          </div>

          {store.blocks.map((b) => (
            <div
              key={b.id}
              // Telefon, Subscriptions: CMSubs to sama tabela, więc inne bloki (np. intro szablonu) chowamy
              className={`group relative pr-9 ${blokSubs ? (b === blokSubs ? "max-[799px]:pr-0" : "max-[799px]:hidden") : ""}`}
            >
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
                <PageTable
                  block={b}
                  today={data.today}
                  templateKey={page.templateKey}
                  // „Usuń tabelę” w menu „⋯” tabeli (S2TableMenu) usuwa blok jak kosz obok
                  onRemove={() => void store.remove(b.id)}
                  // Telefon, strona Subscriptions: ekran CMSubs z tego samego magazynu co tabela
                  renderPhone={
                    b === blokSubs
                      ? (api) => (
                          <MSubs
                            title={sciezka}
                            fields={api.fields}
                            rows={api.rows}
                            today={data.today}
                            menu={
                              <PageMenu
                                page={stronaWMenu}
                                pages={pagesStore.pages}
                                store={pagesStore}
                                onRename={() => setTimeout(() => tytulRef.current?.focus(), 50)}
                                sheet
                                triggerLabel="Więcej"
                                meta={rowsLabel(api.rows.length)}
                                triggerClassName="inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-md border border-transparent bg-transparent p-0 font-[inherit] text-foreground hover:bg-accent"
                              />
                            }
                            onNewRow={api.newRow}
                            onEditRow={api.editRow}
                          />
                        )
                      : undefined
                  }
                />
              )}
              {/* .blk-act.btng.ic.xs: pojawia się po najechaniu lub fokusie; na telefonie zawsze, 44 px */}
              <Button
                variant="ghost"
                size="xs"
                icon
                aria-label="Usuń blok"
                onClick={() => void store.remove(b.id)}
                className={`absolute top-1 right-0 text-destructive-foreground opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 hover:text-destructive-foreground focus-visible:opacity-100 max-[799px]:size-11 max-[799px]:opacity-100 ${b === blokSubs ? "max-[799px]:hidden" : ""}`}
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
