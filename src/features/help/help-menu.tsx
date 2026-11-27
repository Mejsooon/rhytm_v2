"use client";

// „Pomoc i opinie” w pasku bocznym wg S2Help: menu, okna pomocy i skróty „?” oraz ⌘⇧K.
import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CircleHelp } from "lucide-react";
import { toast } from "sonner";

import {
  ActionPopover,
  Button,
  FormDialog,
  Kbd,
  MENU_ITEM,
  MENU_LABEL,
  MENU_SEPARATOR,
  StatusBadge,
} from "@/components/controls";
import { setFirstStepsHidden } from "@/features/today/actions";
import { quickHref } from "@/features/today/quick-request";
import { cn } from "@/lib/utils";
import { firstStepsCount } from "./actions";
import { FeedbackDialog, type FeedbackKind } from "./feedback-dialog";
import { WERSJA } from "./version";

const SKROTY: [string, string][] = [
  ["Szukaj", "⌘K"],
  ["Szybkie dodawanie", "⌘⇧K"],
  ["Schowaj pasek boczny", "⌘\\"],
  ["Wstaw blok na stronie", "/"],
  ["Zmień nazwę strony", "F2"],
  ["Ta lista", "?"],
];

// „Co nowego”: dopisuj na górze przy większych zmianach
const NOWOSCI = [
  { data: "27.11.2026", tytul: "Kosz i nowe Ustawienia", opis: "Przywracanie usuniętych stron i wierszy, ustawienia sejfu." },
  { data: "24.11.2026", tytul: "Subskrypcje z odnowieniami w kalendarzu", opis: "Nowy szablon strony. Przypomnienie dzień przed odnowieniem." },
  { data: "22.11.2026", tytul: "Strony 2.0", opis: "Filtr, sortowanie, karty i podsumowania w każdej tabeli." },
  { data: "16.11.2026", tytul: "Hasła w zaszyfrowanym sejfie", opis: "Szyfrowanie w przeglądarce hasłem głównym." },
];
const KLUCZ_NOWOSCI = "rhytm_nowosci";

const wPolu = (cel: EventTarget | null) =>
  cel instanceof HTMLElement && cel.closest("input, textarea, select, [contenteditable='true']") !== null;

type Okno = "skroty" | "nowosci" | FeedbackKind | null;

export function HelpMenu({ email, compact = false }: { email: string; compact?: boolean }) {
  const router = useRouter();
  const sciezka = usePathname();
  const [menu, setMenu] = React.useState(false);
  const [okno, setOkno] = React.useState<Okno>(null);
  const [kroki, setKroki] = React.useState<number | null>(null);
  // Plakietka „Nowe” do pierwszego otwarcia „Co nowego” w tej przeglądarce
  const [nowe, setNowe] = React.useState(false);

  React.useEffect(() => {
    function klawisz(e: KeyboardEvent) {
      if (wPolu(e.target)) return;
      if (e.key === "?" && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setOkno("skroty");
      }
      // Na Dziś ⌘⇧K obsługuje sam ekran
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === "k" && sciezka !== "/dzis") {
        e.preventDefault();
        router.push(quickHref("dodaj"));
      }
    }
    window.addEventListener("keydown", klawisz);
    return () => window.removeEventListener("keydown", klawisz);
  }, [router, sciezka]);

  function przelaczMenu(otwarte: boolean) {
    setMenu(otwarte);
    if (!otwarte) return;
    try {
      setNowe(localStorage.getItem(KLUCZ_NOWOSCI) !== NOWOSCI[0].data);
    } catch {
      setNowe(false);
    }
    void firstStepsCount()
      .then(setKroki)
      .catch(() => setKroki(null));
  }

  function otworz(co: Exclude<Okno, null>) {
    setMenu(false);
    setOkno(co);
    if (co !== "nowosci") return;
    try {
      localStorage.setItem(KLUCZ_NOWOSCI, NOWOSCI[0].data);
    } catch {
      // Bez magazynu plakietka zostaje
    }
  }

  // Pokazuje schowaną kartę na Dziś i tam prowadzi
  async function pierwszeKroki() {
    setMenu(false);
    const wynik = await setFirstStepsHidden(false).catch(() => null);
    if (!wynik?.ok) toast.error("Nie udało się zapisać. Spróbuj ponownie.");
    router.push("/dzis");
    router.refresh();
  }

  const zamknij = () => setOkno(null);
  const stopka = (
    <Button variant="primary" onClick={zamknij}>
      Zamknij
    </Button>
  );

  return (
    <>
      <ActionPopover
        open={menu}
        onOpenChange={przelaczMenu}
        side="top"
        width={240}
        className="p-1"
        ariaLabel="Pomoc i opinie"
        trigger={
          compact ? (
            <button
              type="button"
              aria-label="Pomoc i opinie"
              title="Pomoc i opinie"
              className="grid size-9 flex-none cursor-pointer place-items-center rounded-[8px] border-0 bg-transparent text-[rgba(38,38,38,.68)] outline-none hover:bg-black/[.04] hover:text-foreground focus-visible:shadow-focus"
            >
              <CircleHelp size={16} aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="flex h-8 flex-none cursor-pointer items-center gap-2 rounded-[8px] border-0 bg-transparent px-2 text-left text-sm font-medium text-[rgba(38,38,38,.72)] outline-none hover:bg-black/[.04] hover:text-foreground focus-visible:shadow-focus"
            >
              <CircleHelp size={16} aria-hidden="true" />
              Pomoc i opinie
            </button>
          )
        }
      >
        <div className="flex flex-col">
          <button type="button" className={MENU_ITEM} onClick={() => otworz("skroty")}>
            Skróty klawiszowe<Kbd className="ml-auto">?</Kbd>
          </button>
          <button type="button" className={MENU_ITEM} onClick={() => otworz("nowosci")}>
            Co nowego
            {nowe && (
              <StatusBadge tone="green" className="ml-auto">
                Nowe
              </StatusBadge>
            )}
          </button>
          <button type="button" className={MENU_ITEM} onClick={() => void pierwszeKroki()}>
            Pierwsze kroki
            {kroki !== null && (
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">{kroki} / 6</span>
            )}
          </button>
          <div className={MENU_SEPARATOR} />
          <button type="button" className={MENU_ITEM} onClick={() => otworz("idea")}>
            Wyślij opinię
          </button>
          <button type="button" className={MENU_ITEM} onClick={() => otworz("bug")}>
            Zgłoś błąd
          </button>
          <div className={MENU_SEPARATOR} />
          <div className={cn(MENU_LABEL, "font-normal")}>
            rhytm · wersja {WERSJA} ·{" "}
            <Link href="/regulamin" className="underline">
              Regulamin
            </Link>{" "}
            ·{" "}
            <Link href="/prywatnosc" className="underline">
              Prywatność
            </Link>
          </div>
        </div>
      </ActionPopover>

      {okno === "skroty" && (
        <FormDialog
          open
          onOpenChange={(o) => !o && zamknij()}
          title="Skróty klawiszowe"
          description="Na Windows i Linux zamiast ⌘ użyj Ctrl."
          footer={stopka}
        >
          <dl className="m-0">
            {SKROTY.map(([nazwa, klawisze]) => (
              <div key={nazwa} className="flex items-center justify-between border-t border-border-soft py-2.5 first:border-t-0">
                <dt>{nazwa}</dt>
                <dd className="m-0">
                  <Kbd>{klawisze}</Kbd>
                </dd>
              </div>
            ))}
          </dl>
        </FormDialog>
      )}
      {okno === "nowosci" && (
        <FormDialog
          open
          onOpenChange={(o) => !o && zamknij()}
          title="Co nowego"
          description="Zmiany w rhytm z ostatnich tygodni."
          footer={stopka}
        >
          {NOWOSCI.map((n) => (
            <div key={n.data} className="flex flex-col">
              <span className="text-xs text-muted-foreground tabular-nums">{n.data}</span>
              <span className="font-medium">{n.tytul}</span>
              <span className="text-xs text-muted-foreground">{n.opis}</span>
            </div>
          ))}
        </FormDialog>
      )}
      {(okno === "idea" || okno === "bug" || okno === "other") && (
        <FeedbackDialog kind={okno} email={email} onClose={zamknij} />
      )}
    </>
  );
}
