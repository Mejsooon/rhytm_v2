"use client";

import * as React from "react";
import Link from "next/link";
import { LayoutGrid, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ActionPopover, Button } from "@/components/controls";
import { cn } from "@/lib/utils";
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
import { LEGACY_TEMPLATE_INTROS, TEMPLATES } from "../templates";
import { CommandLine } from "./command-line";
import { PageTable } from "../table/page-table";
import { MSubs } from "../table/mobile/m-subs";
import { MEditor } from "./mobile/m-editor";
import { TextBlock } from "./text-block";
import { TodoBlock } from "./todo-block";
import { useEditorStore } from "./use-editor-store";

// Edytor bloków każdej strony poza Hasłami. Dwa układy webu według makiet:
// - strona z szablonu (S2Table): okruszki i przycisk główny w nagłówku, tytuł 24 px bez ikony, opis szablonu;
// - strona edytora (S2EmptyPage): „Szablony” w nagłówku, „Dodaj ikonę” nad tytułem 32 px, bloki, linia poleceń,
//   szybki start „albo zacznij od:” i karta „Wolisz gotowca?”.
// Menu strony „⋯” jest w pasku bocznym (S2PageMenu), nie w nagłówku. Telefon dostaje ten sam układ w jednej kolumnie.
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
  // Przycisk główny nagłówka (S2Books: „Nowa książka”) dodaje wiersz do pierwszej tabeli strony;
  // etykieta z szablonu strony, bez szablonu „Nowy wiersz”
  const pierwszaTabela = store.blocks.find((b) => b.type === "table");
  const nowyWierszRef = React.useRef<(() => void) | null>(null);
  const etykietaNowego = TEMPLATES[page.templateKey ?? "empty"].newLabel;
  // Strona z szablonu (Książki, Projekty…) ma układ S2Table, pozostałe — układ edytora S2EmptyPage
  const zSzablonu = page.templateKey !== null && page.templateKey !== "empty";
  const opis = zSzablonu ? TEMPLATES[page.templateKey ?? "empty"].desc : "";
  // Dawny blok opisu na początku strony z szablonu: niezmieniony nie jest rysowany (opis stoi pod tytułem)
  const pierwszy = store.blocks[0];
  const staryOpis =
    page.templateKey !== null &&
    page.templateKey !== "empty" &&
    pierwszy?.type === "text" &&
    pierwszy.content.text === LEGACY_TEMPLATE_INTROS[page.templateKey]
      ? pierwszy
      : undefined;
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
              {/* S2EmptyPage.dc.html: strona edytora ma w nagłówku „Szablony” (.btn) */}
              {!zSzablonu && (
                <Button asChild>
                  <Link href="/strony/nowa">
                    <LayoutGrid size={16} aria-hidden="true" />
                    Szablony
                  </Link>
                </Button>
              )}
              {pierwszaTabela && (
                <Button variant="primary" onClick={() => nowyWierszRef.current?.()}>
                  <Plus size={16} aria-hidden="true" />
                  {etykietaNowego}
                </Button>
              )}
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
        <div
          className={cn(
            "box-border flex w-full min-w-0 flex-col gap-3 px-6 pb-40 max-[799px]:gap-2.5 max-[799px]:px-4 max-[799px]:pt-2 max-[799px]:pb-0",
            // S2Table: 24 px dookoła, 16 px między sekcjami; S2EmptyPage: 48 px od góry, 72 px z lewej, do 1080 px
            zSzablonu ? "pt-6 min-[800px]:gap-4" : "pt-12 min-[800px]:max-w-[1080px] min-[800px]:pl-[72px]",
          )}
        >
          {/* Tytuł; grupa „tytul” pokazuje po najechaniu przycisk ikony. Telefon Subscriptions: tytuł strony rysuje MSubs */}
          <div className={cn("group/tytul relative flex flex-col", !zSzablonu && "gap-1.5 min-[800px]:mb-2", blokSubs && "max-[799px]:hidden")}>
            <div
              className={
                zSzablonu
                  ? // Nad tytułem, w odstępie od nagłówka — bez przesuwania układu S2Table
                    "absolute -top-6 left-0 max-[799px]:hidden"
                  : "flex min-h-6 items-center max-[799px]:hidden"
              }
            >
              <ActionPopover
                open={wyborIkony}
                onOpenChange={setWyborIkony}
                width={300}
                ariaLabel="Wybór ikony"
                trigger={
                  ikona !== "" && !zSzablonu ? (
                    // S2EmptyPage: wybrana ikona jako .btng 44 px z ikoną 28 px
                    <Button variant="ghost" icon aria-label="Zmień ikonę strony" className="size-11 p-0">
                      <PageIcon icon={ikona} size={28} />
                    </Button>
                  ) : (
                    // .btng.xs w kolorze #686868: „Dodaj ikonę” (zawsze widoczne, sam tekst jak w S2EmptyPage) albo
                    // (strona z szablonu z ikoną) mała ikona i „Zmień ikonę” po najechaniu na tytuł
                    <Button
                      variant="ghost"
                      size="xs"
                      aria-label={ikona === "" ? undefined : "Zmień ikonę strony"}
                      className={cn(
                        "text-muted-foreground",
                        ikona !== "" &&
                          "opacity-0 transition-opacity duration-[120ms] group-hover/tytul:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100",
                      )}
                    >
                      {ikona !== "" && <PageIcon icon={ikona} size={14} />}
                      {ikona === "" ? "Dodaj ikonę" : "Zmień ikonę"}
                    </Button>
                  )
                }
              >
                <IconPicker value={ikona} onPick={zmienIkone} />
              </ActionPopover>
            </div>
            <input
              ref={tytulRef}
              type="text"
              value={tytul}
              onChange={(e) => setTytul(e.target.value)}
              onBlur={zapiszTytul}
              placeholder="Bez tytułu"
              aria-label="Nazwa strony"
              className={cn(
                "w-full min-w-0 border-0 bg-transparent p-0 font-[inherit] text-2xl font-semibold tracking-[-0.02em] text-foreground outline-none",
                // .ttl z S2EmptyPage: 32 px, jasny placeholder
                !zSzablonu && "placeholder:text-[#d4d4d4] min-[800px]:text-[32px]",
              )}
            />
            {/* Opis szablonu pod tytułem (S2Table, .muted) */}
            {opis !== "" && <p className="mt-1 mb-0 text-sm text-muted-foreground">{opis}</p>}
          </div>

          {store.blocks.filter((b) => b !== staryOpis).map((b) => (
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
                  title={sciezka}
                  newRowRef={b === pierwszaTabela ? nowyWierszRef : undefined}
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
            <div className="mt-5 flex flex-col gap-3 max-[799px]:hidden">
              <span className="text-[13px] text-muted-foreground">albo zacznij od:</span>
              <div className="flex flex-wrap gap-2">
                {QUICK_START.map((q) => (
                  // .qchip: pigułka 34 px, znak bloku w kwadracie .sic 22 px
                  <button
                    key={q.type}
                    type="button"
                    onClick={() => void store.add(q.type)}
                    className="inline-flex h-[34px] cursor-pointer items-center gap-2 rounded-full border border-black/[.12] bg-white px-3 font-[inherit] text-sm font-medium text-foreground shadow-xs outline-none hover:bg-panel focus-visible:shadow-focus"
                  >
                    <span
                      aria-hidden="true"
                      className="grid size-[22px] flex-none place-items-center rounded-[6px] border border-black/10 bg-white text-[11px] font-semibold text-[#404040]"
                    >
                      {q.icon}
                    </span>
                    {q.label}
                  </button>
                ))}
              </div>
              {/* Karta „Wolisz gotowca?”: przerywana ramka, do 560 px, „Użyj szablonu →” jako .btn.xs */}
              <div className="mt-4 flex max-w-[560px] items-center gap-2.5 rounded-xl border border-dashed border-black/[.16] px-4 py-3.5">
                <span className="flex-1">
                  <b className="block font-medium">Wolisz gotowca?</b>
                  <span className="text-[13px] text-muted-foreground">
                    Subskrypcje, Książki, Projekty albo Strony WWW z gotową tabelą i widokami.
                  </span>
                </span>
                <Button size="xs" asChild>
                  <Link href="/strony/nowa">Użyj szablonu →</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </MEditor>
    </>
  );
}
