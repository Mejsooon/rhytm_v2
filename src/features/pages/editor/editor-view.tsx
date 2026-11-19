"use client";

import * as React from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

import { ActionPopover, Button, Chip } from "@/components/controls";
import { ModuleHeader } from "@/components/shell/module-header";
import { renamePage, setPageIcon } from "../actions";
import { IconGrid } from "../icon-grid";
import { QUICK_START } from "../blocks";
import type { LoadedPage } from "../load-page";
import { BLAD_ZAPISU } from "../messages";
import { CommandLine } from "./command-line";
import { TableBlock } from "./table-block";
import { TextBlock } from "./text-block";
import { TodoBlock } from "./todo-block";
import { useEditorStore } from "./use-editor-store";

// Edytor bloków strony bez szablonu (EmptyPage.dc.html): ikona, tytuł, bloki, linia poleceń,
// szybki start i link do szablonów. Telefon dostaje ten sam układ w jednej kolumnie.
export function EditorView({ data }: { data: LoadedPage }) {
  const { page } = data;
  const store = useEditorStore(page.id, data.blocks);

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
      <div className="box-border flex w-full max-w-[1160px] flex-col gap-3 px-6 pt-7 pb-40 max-[799px]:px-4 max-[799px]:pt-3">
        <div className="mb-2 flex items-center gap-3">
          <ActionPopover
            open={wyborIkony}
            onOpenChange={setWyborIkony}
            width={230}
            ariaLabel="Wybór ikony"
            trigger={
              <button
                type="button"
                aria-label="Zmień ikonę"
                className="size-10 cursor-pointer rounded-lg border border-dashed border-[#d4d4d4] bg-[#fafafa] font-[inherit] text-[#6b6b6b] max-[799px]:size-11"
              >
                {ikona}
              </button>
            }
          >
            <IconGrid current={ikona} onPick={zmienIkone} />
          </ActionPopover>
          <input
            type="text"
            value={tytul}
            onChange={(e) => setTytul(e.target.value)}
            onBlur={zapiszTytul}
            placeholder="Bez tytułu"
            aria-label="Nazwa strony"
            className="min-w-0 flex-1 border-0 bg-transparent font-[inherit] text-2xl font-semibold tracking-[-0.02em] text-[#171717] outline-none"
          />
        </div>

        {store.blocks.map((b) => (
          <div key={b.id} className="group relative pr-8">
            {b.type === "heading" && (
              <TextBlock
                variant="heading"
                text={typeof b.content.text === "string" ? b.content.text : ""}
                onSave={(text) => void store.update(b.id, { text })}
              />
            )}
            {b.type === "text" && (
              <TextBlock
                variant="text"
                text={typeof b.content.text === "string" ? b.content.text : ""}
                onSave={(text) => void store.update(b.id, { text })}
              />
            )}
            {b.type === "todo" && (
              <TodoBlock
                text={typeof b.content.text === "string" ? b.content.text : ""}
                done={b.content.done === true}
                onSave={(content) => void store.update(b.id, content)}
              />
            )}
            {b.type === "divider" && <hr className="my-3 border-0 border-t border-[#eaeaea]" />}
            {b.type === "table" && <TableBlock block={b} editable="cell" today={data.today} />}
            <button
              type="button"
              aria-label="Usuń blok"
              onClick={() => void store.remove(b.id)}
              className="absolute top-1 right-0 inline-flex cursor-pointer rounded-md border-0 bg-transparent p-[5px] text-[#b91c1c] opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 hover:bg-[#fef2f2] focus-visible:opacity-100 max-[799px]:size-11 max-[799px]:items-center max-[799px]:justify-center max-[799px]:opacity-100"
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </div>
        ))}

        <CommandLine onInsert={(typ, tekst) => void store.add(typ, tekst)} />

        {pusta && (
          <>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="mr-1 font-mono text-xs text-[#6b6b6b]">albo zacznij od:</span>
              {QUICK_START.map((q) => (
                <Chip key={q.type} onClick={() => void store.add(q.type)}>
                  <span aria-hidden="true" className="font-mono text-[#6b6b6b]">
                    {q.icon}
                  </span>
                  {q.label}
                </Chip>
              ))}
            </div>
            <p className="mt-6 mb-0 font-mono text-xs text-[#6b6b6b]">
              Wolisz gotowca?{" "}
              <Link href="/strony/nowa" className="text-[#404040]">
                Użyj szablonu →
              </Link>
            </p>
          </>
        )}
      </div>
    </>
  );
}
