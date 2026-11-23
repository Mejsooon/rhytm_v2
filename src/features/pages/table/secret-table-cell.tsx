"use client";

import * as React from "react";
import { toast } from "sonner";

import { isSecretValue, type SecretValue } from "@/features/vault/crypto";
import { useVault } from "@/features/vault/vault-provider";
import { cn } from "@/lib/utils";
import type { PageField } from "../fields";
import { SEJF_ZABLOKOWANY } from "../messages";
import type { PageRow } from "../table-model";

const MASKA = "••••••••••••";

// Komórka Sekret w tabeli (S2Passwords.dc.html): maska albo „—”, przy zamkniętym sejfie „zablokowane”.
// Klik (odblokowany sejf) odszyfrowuje wartość lokalnie i daje pole bez autouzupełniania menedżerów haseł.
// Enter albo wyjście szyfruje tekst (pusty → null) i dopiero szyfrogram idzie do onSave; Esc kończy bez zapisu.
// Tekst jawny żyje tylko w stanie tej komórki: znika po zapisie, przy blokadzie sejfu i przy odmontowaniu.
// `revealed` (oczko wiersza) pokazuje odszyfrowany tekst zamiast maski. Komórka renderuje treść <td>, nie sam <td>.
export function SecretTableCell({
  row,
  field,
  readOnly,
  revealed = false,
  onSave,
}: {
  row: PageRow;
  field: PageField;
  readOnly: boolean;
  revealed?: boolean;
  onSave: (value: SecretValue | null) => void;
}) {
  const vault = useVault();
  const decrypt = vault.decrypt;
  const odblokowany = vault.status === "odblokowany";
  const v = row.values[field.id];
  const pusta = v === null || v === undefined;

  // Edycja: tekst jawny w polu i ten sam tekst z chwili otwarcia (do sprawdzenia, czy coś się zmieniło)
  const [edycja, setEdycja] = React.useState(false);
  const [tekst, setTekst] = React.useState("");
  const oryginal = React.useRef("");
  // Edycja widziana przez handlery i efekty (blur po Esc nie zapisuje, blokada wie, że coś było otwarte)
  const edycjaRef = React.useRef(false);
  // Odsłonięty tekst (oczko) i wynik odszyfrowania: null = jeszcze nie ma, false = nie da się odczytać
  const [jawny, setJawny] = React.useState<string | false | null>(null);
  // Status widziany po await (po blokadzie nic nie trafia do stanu)
  const statusRef = React.useRef(vault.status);
  React.useEffect(() => {
    statusRef.current = vault.status;
  }, [vault.status]);

  // Blokada, nowa wartość albo schowanie oczkiem zrzucają tekst jawny; blokada zamyka też edycję
  const [poprzednie, setPoprzednie] = React.useState({ status: vault.status, v, revealed });
  if (poprzednie.status !== vault.status || poprzednie.v !== v || poprzednie.revealed !== revealed) {
    setPoprzednie({ status: vault.status, v, revealed });
    setJawny(null);
    if (vault.status !== "odblokowany") {
      setEdycja(false);
      setTekst("");
    }
  }

  // Blokada w trakcie edycji: bez zapisu, z komunikatem (stan pola czyści się wyżej, w renderze)
  React.useEffect(() => {
    if (vault.status === "odblokowany" || !edycjaRef.current) return;
    edycjaRef.current = false;
    oryginal.current = "";
    toast.error(SEJF_ZABLOKOWANY);
  }, [vault.status]);

  // Odmontowanie: tekst z chwili otwarcia też znika
  React.useEffect(() => {
    const o = oryginal;
    return () => {
      o.current = "";
    };
  }, []);

  // Oczko: odszyfrowanie lokalne do stanu komórki
  React.useEffect(() => {
    if (!revealed || !odblokowany || !isSecretValue(v)) return;
    let anulowano = false;
    void decrypt(v).then((t) => {
      if (!anulowano && statusRef.current === "odblokowany") setJawny(t ?? false);
    });
    return () => {
      anulowano = true;
    };
  }, [revealed, odblokowany, v, decrypt]);

  // Koniec edycji z zapisem: szyfrogram (albo null dla pustego tekstu) idzie do onSave, tekst jawny znika
  async function zapisz() {
    if (!edycjaRef.current) return;
    edycjaRef.current = false;
    const t = tekst;
    const bylo = oryginal.current;
    oryginal.current = "";
    setEdycja(false);
    setTekst("");
    if (t === bylo) return;
    if (t === "") {
      onSave(null);
      return;
    }
    let nowa: SecretValue;
    try {
      nowa = await vault.encrypt(t);
    } catch {
      // Sejf zablokował się przed szyfrowaniem: nic nie zapisujemy
      toast.error(SEJF_ZABLOKOWANY);
      return;
    }
    onSave(nowa);
  }

  if (pusta && !(odblokowany && !readOnly)) return <span className="block px-3 text-faint-foreground">—</span>;
  if (!odblokowany) return <span className="block px-3 text-faint-foreground italic">zablokowane</span>;

  if (edycja) {
    // Gdzie przeglądarka umie maskować pole tekstowe (-webkit-text-security), używamy type="text" — menedżery
    // haseł go nie przechwytują. Gdzie nie umie, wracamy do type="password", żeby hasło nie było widać bez oczka.
    const maskaCss =
      typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("-webkit-text-security", "disc");
    return (
      // Bez atrybutu name; atrybuty data-* wyłączają 1Password, LastPass, Bitwarden i inne menedżery
      <input
        type={maskaCss || revealed ? "text" : "password"}
        autoFocus
        autoComplete={maskaCss ? "off" : "new-password"}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        data-1p-ignore=""
        data-lpignore="true"
        data-bwignore=""
        data-form-type="other"
        translate="no"
        aria-label={field.name}
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        onBlur={() => void zapisz()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            void zapisz();
          }
          if (e.key === "Escape") {
            // Koniec bez zapisu: blur po zniknięciu pola nic już nie zrobi
            e.preventDefault();
            edycjaRef.current = false;
            oryginal.current = "";
            setEdycja(false);
            setTekst("");
          }
        }}
        className={cn(
          "notranslate block h-11 w-full min-w-0 rounded-none border-0 bg-transparent px-3 py-0 font-[inherit] text-inherit tabular-nums shadow-none outline-none focus:shadow-none focus-visible:shadow-none",
          !revealed && "[-webkit-text-security:disc]",
        )}
      />
    );
  }

  const tresc =
    pusta ? (
      <span className="text-faint-foreground">—</span>
    ) : !isSecretValue(v) || jawny === false ? (
      <span className="text-destructive-foreground">nie da się odczytać</span>
    ) : revealed && jawny !== null ? (
      // Odsłonięte hasło nie trafia do tłumacza przeglądarki
      <span translate="no" className="notranslate truncate text-foreground">
        {jawny}
      </span>
    ) : (
      <span className="truncate tracking-[.12em] text-soft-foreground">{MASKA}</span>
    );

  if (readOnly) return <span className="flex h-11 items-center px-3 tabular-nums">{tresc}</span>;

  return (
    <button
      type="button"
      aria-label={`${field.name}: ${pusta ? "puste" : "zaszyfrowane"}`}
      onClick={async () => {
        // Wartość początkowa pola: odszyfrowana lokalnie (uszkodzony szyfrogram da się nadpisać od zera)
        let t = "";
        if (isSecretValue(v)) {
          t = (await decrypt(v)) ?? "";
          if (statusRef.current !== "odblokowany") return;
        }
        oryginal.current = t;
        edycjaRef.current = true;
        setTekst(t);
        setEdycja(true);
      }}
      className="flex h-11 w-full min-w-0 cursor-text items-center border-0 bg-transparent px-3 text-left font-[inherit] tabular-nums outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(59,130,246,.55)]"
    >
      {tresc}
    </button>
  );
}
