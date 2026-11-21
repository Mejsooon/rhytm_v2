"use client";

import * as React from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import { Button, FIELD } from "@/components/controls";
import { cn } from "@/lib/utils";
import { isSecretValue } from "./crypto";
import { useVault } from "./vault-provider";

const MASKA = "••••••••••••";
// Po tylu ms od skopiowania hasła czyścimy schowek
const SCHOWEK_MS = 30_000;

// Komórka Sekret w tabeli (CPasswords.dc.html): maska, „Pokaż” i „Kopiuj”. Tekst jawny żyje tylko
// w lokalnym stanie tej komórki po kliknięciu „Pokaż” i znika po blokadzie, zmianie wartości lub ukryciu.
// `value` to surowa wartość z wiersza (nie sprawdzona), `serviceName` trafia do toastu po skopiowaniu.
export function SecretCell({ value, serviceName }: { value: unknown; serviceName: string }) {
  const vault = useVault();
  const decrypt = vault.decrypt;
  const odblokowany = vault.status === "odblokowany";
  const [tekst, setTekst] = React.useState<string | null>(null);
  // null = jeszcze sprawdzamy, czy szyfrogram da się odczytać (sam wynik, bez tekstu)
  const [czytelny, setCzytelny] = React.useState<boolean | null>(null);
  const [poprzedniStatus, setPoprzedniStatus] = React.useState(vault.status);
  const [poprzedniaWartosc, setPoprzedniaWartosc] = React.useState(value);
  // Status widziany przez wolne operacje async (po blokadzie nie wolno ustawić tekstu)
  const statusRef = React.useRef(vault.status);
  React.useEffect(() => {
    statusRef.current = vault.status;
  }, [vault.status]);
  // Zaplanowane czyszczenie schowka (bez skopiowanego tekstu): licznik 30 s i funkcja „wyczyść teraz”
  const schowekRef = React.useRef<{ timer: ReturnType<typeof setTimeout>; wyczysc: () => void } | null>(null);
  // Blokada sejfu przed upływem 30 s: czyścimy od razu (albo przy powrocie fokusu)
  React.useEffect(() => {
    if (!odblokowany) schowekRef.current?.wyczysc();
  }, [odblokowany]);
  // Odmontowanie komórki z zaplanowanym czyszczeniem: tak samo
  React.useEffect(() => {
    const plan = schowekRef;
    return () => plan.current?.wyczysc();
  }, []);

  // Blokada albo nowa wartość (np. po edycji) zrzuca tekst jawny i wynik sprawdzenia
  if (poprzedniStatus !== vault.status || poprzedniaWartosc !== value) {
    setPoprzedniStatus(vault.status);
    setPoprzedniaWartosc(value);
    setTekst(null);
    setCzytelny(null);
  }

  // Uszkodzony szyfrogram wykrywamy od razu po odblokowaniu; zapamiętujemy tylko wynik, nie tekst
  React.useEffect(() => {
    if (!odblokowany || !isSecretValue(value)) return;
    let anulowano = false;
    void decrypt(value).then((t) => {
      if (!anulowano) setCzytelny(t !== null);
    });
    return () => {
      anulowano = true;
    };
  }, [odblokowany, value, decrypt]);

  if (vault.status === "brak") return <span className="text-faint-foreground italic">— nieustawiony sejf</span>;
  if (value === null || value === undefined || (vault.status !== "zablokowany" && !odblokowany)) {
    return <span className="text-faint-foreground">—</span>;
  }
  if (!odblokowany) return <span className="text-faint-foreground italic">zablokowane</span>;
  if (!isSecretValue(value) || czytelny === false) {
    return <span className="text-destructive-foreground">nie da się odczytać</span>;
  }

  const pokazane = tekst !== null;

  return (
    <div className="flex items-center gap-0.5">
      <span
        // Odsłonięte hasło nie trafia do tłumacza przeglądarki
        translate="no"
        className={cn(
          "notranslate min-w-0 flex-1 truncate tabular-nums",
          pokazane ? "text-foreground" : "tracking-[.12em] text-soft-foreground",
        )}
      >
        {pokazane ? tekst : MASKA}
      </span>
      <Button
        variant="ghost"
        size="xs"
        icon
        aria-label="Pokaż hasło"
        aria-pressed={pokazane}
        onClick={async (e) => {
          // Klik w komórkę nie otwiera edycji wiersza
          e.stopPropagation();
          if (pokazane) {
            setTekst(null);
            return;
          }
          const t = await decrypt(value);
          if (statusRef.current !== "odblokowany") return;
          if (t === null) setCzytelny(false);
          else setTekst(t);
        }}
        className="max-[799px]:size-11"
      >
        {pokazane ? <EyeOff aria-hidden="true" className="size-[15px]" /> : <Eye aria-hidden="true" className="size-[15px]" />}
      </Button>
      <Button
        variant="ghost"
        size="xs"
        icon
        aria-label="Kopiuj hasło"
        onClick={async (e) => {
          e.stopPropagation();
          const t = await decrypt(value);
          // Blokada w trakcie odszyfrowywania: nic nie trafia do schowka
          if (statusRef.current !== "odblokowany") return;
          if (t === null) {
            toast.error("Nie udało się skopiować.");
            return;
          }
          try {
            await navigator.clipboard.writeText(t);
          } catch {
            toast.error("Nie udało się skopiować.");
            return;
          }
          toast(`Skopiowano hasło ${serviceName}`, { description: "Schowek wyczyści się za 30 s." });
          // Czyszczenie po 30 s; plan nie trzyma skopiowanego tekstu. Schowek da się zapisać tylko z fokusem,
          // więc bez fokusu czekamy jednorazowo na powrót do karty. Nowe kopiowanie zastępuje stary plan.
          if (schowekRef.current) clearTimeout(schowekRef.current.timer);
          const plan = {
            timer: setTimeout(() => plan.wyczysc(), SCHOWEK_MS),
            wyczysc: () => {
              clearTimeout(plan.timer);
              if (schowekRef.current === plan) schowekRef.current = null;
              const pusty = () => {
                try {
                  void navigator.clipboard.writeText("").catch(() => {});
                } catch {
                  // Schowek niedostępny: nic więcej nie zrobimy
                }
              };
              if (document.hasFocus()) pusty();
              else window.addEventListener("focus", pusty, { once: true });
            },
          };
          schowekRef.current = plan;
        }}
        className="max-[799px]:size-11"
      >
        <Copy aria-hidden="true" className="size-[15px]" />
      </Button>
    </div>
  );
}

// Pole Sekret w wierszu w trybie edycji: type="text" maskowane CSS (menedżery haseł nie traktują go jak
// hasła do konta i go nie zapisują), „Pokaż” zdejmuje maskę. Tekst jest sterowany z góry (stan
// RowEdit), więc nie trafia do stanu tabeli; wartość początkowa jest odszyfrowywana lokalnie po odblokowaniu.
export function SecretEdit({
  fieldId,
  label,
  source,
  text,
  onText,
  onPrefill,
  onSubmit,
  onCancel,
}: {
  fieldId: string;
  label: string;
  // Szyfrogram z wiersza (albo nic dla nowego wiersza), z którego powstaje wartość początkowa
  source: unknown;
  text: string;
  onText: (text: string) => void;
  // Stabilna funkcja (useCallback) — wchodzi do zależności efektu odszyfrowania
  onPrefill: (fieldId: string, text: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const vault = useVault();
  const decrypt = vault.decrypt;
  const odblokowany = vault.status === "odblokowany";
  const [pokaz, setPokaz] = React.useState(false);
  const [poprzedniStatus, setPoprzedniStatus] = React.useState(vault.status);
  if (poprzedniStatus !== vault.status) {
    setPoprzedniStatus(vault.status);
    setPokaz(false);
  }

  // Wartość początkowa: odszyfrowanie istniejącego sekretu (tylko lokalnie, do stanu pola)
  React.useEffect(() => {
    if (!odblokowany || !isSecretValue(source)) return;
    let anulowano = false;
    void decrypt(source).then((t) => {
      if (!anulowano && t !== null) onPrefill(fieldId, t);
    });
    return () => {
      anulowano = true;
    };
  }, [odblokowany, source, decrypt, onPrefill, fieldId]);

  return (
    <div className="flex items-center gap-0.5">
      {/* Bez atrybutu name; atrybuty data-* wyłączają 1Password, LastPass, Bitwarden i inne menedżery */}
      <input
        type="text"
        disabled={!odblokowany}
        autoComplete="off"
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        data-1p-ignore=""
        data-lpignore="true"
        data-bwignore=""
        data-form-type="other"
        translate="no"
        aria-label={label}
        placeholder={odblokowany ? label : "Odblokuj sejf, żeby edytować"}
        value={odblokowany ? text : ""}
        onChange={(e) => onText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
          if (e.key === "Escape") onCancel();
        }}
        className={cn(FIELD, "h-[30px] tabular-nums", !(odblokowany && pokaz) && "[-webkit-text-security:disc]")}
      />
      {odblokowany && (
        <Button
          variant="ghost"
          size="xs"
          icon
          aria-label="Pokaż hasło"
          aria-pressed={pokaz}
          onClick={() => setPokaz(!pokaz)}
          className="max-[799px]:size-11"
        >
          {pokaz ? <EyeOff aria-hidden="true" className="size-[15px]" /> : <Eye aria-hidden="true" className="size-[15px]" />}
        </Button>
      )}
    </div>
  );
}
