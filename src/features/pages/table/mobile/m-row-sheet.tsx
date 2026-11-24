"use client";

import * as React from "react";
import { Copy, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Checkbox,
  DatePicker,
  Dropdown,
  FormDialog,
  Segment,
  TextField,
  FIELD,
  type IsoDate,
} from "@/components/controls";
import { isSecretValue, type SecretValue } from "@/features/vault/crypto";
import { useVault } from "@/features/vault/vault-provider";
import { cn } from "@/lib/utils";
import { OptionBadge } from "../option-badge";
import {
  formatMoney,
  isRecurringValue,
  nextRenewal,
  renewalDates,
  normalizeValue,
  rowCycle,
  type Cycle,
  type PageField,
} from "../../fields";
import { SEJF_ZABLOKOWANY } from "../../messages";

// Po tylu ms od skopiowania sekretu czyścimy schowek
const SCHOWEK_MS = 30_000;

// Arkusz wiersza na telefonie (FormDialog poniżej 800 px): te same kontrolki co tryb edycji,
// „Usuń wiersz” (tylko istniejący wiersz) i „Anuluj” / „Zapisz” (MRowEdit.dc.html).
// Sekret: pole zamaskowane z oczkiem i kopiowaniem, bez autouzupełniania menedżerów haseł. Tekst jawny żyje
// tylko w stanie arkusza (nigdy w onChange / store); „Zapisz” szyfruje zmienione sekrety i oddaje szyfrogramy
// w onSave. Zamknięcie arkusza albo blokada sejfu czyści tekst jawny.
export function MRowSheet({
  open,
  title,
  fields,
  allFields,
  values,
  today,
  onChange,
  onSave,
  onCancel,
  onDelete,
}: {
  open: boolean;
  title: string;
  fields: PageField[];
  // Wszystkie pola tabeli (także ukryte): Data odnowienia bierze z nich cykl wiersza; brak = `fields`
  allFields?: PageField[];
  values: Record<string, unknown>;
  today: IsoDate;
  onChange: (fieldId: string, value: unknown) => void;
  // Zaszyfrowane sekrety zmienione w arkuszu (id pola → SecretValue albo null)
  onSave: (secrets: Record<string, SecretValue | null>) => void;
  onCancel: () => void;
  // Brak dla nowego wiersza
  onDelete?: () => void;
}) {
  const vault = useVault();
  const decrypt = vault.decrypt;
  const odblokowany = vault.status === "odblokowany";
  // Tekst jawny sekretów w arkuszu i ten sam tekst z chwili otwarcia (do sprawdzenia zmian); oczko na pole
  const [teksty, setTeksty] = React.useState<Record<string, string>>({});
  const [oryginaly, setOryginaly] = React.useState<Record<string, string>>({});
  const [pokazane, setPokazane] = React.useState<string[]>([]);
  // Kwota cykliczna: tekst kwoty w trakcie pisania i cykl wybrany przy pustej kwocie (id pola → wartość)
  const [kwoty, setKwoty] = React.useState<Record<string, string>>({});
  const [cykle, setCykle] = React.useState<Record<string, Cycle>>({});
  // „Zapisz” w trakcie szyfrowania nie zapisuje drugi raz
  const [szyfrowanie, setSzyfrowanie] = React.useState(false);
  const [poprzednie, setPoprzednie] = React.useState({ open, status: vault.status });
  if (poprzednie.open !== open || poprzednie.status !== vault.status) {
    setPoprzednie({ open, status: vault.status });
    // Zamknięcie arkusza: szkice kwot znikają (następny wiersz zaczyna od swoich wartości)
    if (!open) {
      setKwoty({});
      setCykle({});
    }
    // Zamknięcie arkusza albo blokada sejfu: tekst jawny znika
    if (!open || vault.status !== "odblokowany") {
      setTeksty({});
      setOryginaly({});
      setPokazane([]);
    }
  }

  // Wartości z chwili otwarcia arkusza (efekt odszyfrowania nie zależy od każdej zmiany w arkuszu)
  const wartosciRef = React.useRef(values);
  const polaRef = React.useRef(fields);
  React.useEffect(() => {
    wartosciRef.current = values;
    polaRef.current = fields;
  });
  // Po otwarciu (i odblokowaniu): sekrety wiersza odszyfrowane lokalnie do stanu arkusza
  React.useEffect(() => {
    if (!open || !odblokowany) return;
    let anulowano = false;
    for (const f of polaRef.current) {
      const v = wartosciRef.current[f.id];
      if (f.type !== "secret" || !isSecretValue(v)) continue;
      void decrypt(v).then((t) => {
        if (anulowano || t === null) return;
        // Wpisany już tekst wygrywa z wartością początkową
        setTeksty((m) => (f.id in m ? m : { ...m, [f.id]: t }));
        setOryginaly((m) => ({ ...m, [f.id]: t }));
      });
    }
    return () => {
      anulowano = true;
    };
  }, [open, odblokowany, decrypt]);

  // Zaplanowane czyszczenie schowka (bez skopiowanego tekstu)
  const schowekRef = React.useRef<{ timer: ReturnType<typeof setTimeout>; wyczysc: () => void } | null>(null);
  React.useEffect(() => {
    if (!odblokowany) schowekRef.current?.wyczysc();
  }, [odblokowany]);
  React.useEffect(() => {
    const plan = schowekRef;
    return () => plan.current?.wyczysc();
  }, []);

  // Gdzie przeglądarka umie maskować pole tekstowe, używamy type="text" (menedżery haseł go nie przechwytują)
  const maskaCss =
    typeof CSS !== "undefined" && typeof CSS.supports === "function" && CSS.supports("-webkit-text-security", "disc");

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>Anuluj</Button>
          <Button
            variant="primary"
            disabled={szyfrowanie}
            onClick={async () => {
              // Zmienione sekrety szyfrujemy tutaj; do store idą tylko szyfrogramy (pusty tekst → null)
              const zaszyfrowane: Record<string, SecretValue | null> = {};
              setSzyfrowanie(true);
              try {
                for (const f of fields) {
                  if (f.type !== "secret" || !(f.id in teksty)) continue;
                  const t = teksty[f.id];
                  if (t === (oryginaly[f.id] ?? "")) continue;
                  zaszyfrowane[f.id] = t === "" ? null : await vault.encrypt(t);
                }
              } catch {
                // Sejf zablokował się przed szyfrowaniem: nic nie zapisujemy, arkusz zostaje
                toast.error(SEJF_ZABLOKOWANY);
                return;
              } finally {
                setSzyfrowanie(false);
              }
              // Tekst jawny znika z zamknięciem arkusza po udanym zapisie; po błędzie arkusz zostaje z tekstem
              onSave(zaszyfrowane);
            }}
          >
            Zapisz
          </Button>
        </>
      }
    >
      {fields.map((f) => {
        const surowa = values[f.id];

        // Sekret: pole zamaskowane, oczko i kopiowanie; tekst tylko w stanie arkusza
        if (f.type === "secret") {
          const pokazany = pokazane.includes(f.id);
          const tekst = teksty[f.id] ?? "";
          return (
            <div key={f.id} className="flex flex-col gap-1.5 text-[13px] font-medium">
              <span>{f.name}</span>
              <div className="flex items-center gap-1">
                {/* Bez atrybutu name; atrybuty data-* wyłączają 1Password, LastPass, Bitwarden i inne menedżery */}
                <input
                  type={maskaCss || pokazany ? "text" : "password"}
                  disabled={!odblokowany}
                  autoComplete={maskaCss ? "off" : "new-password"}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                  data-1p-ignore=""
                  data-lpignore="true"
                  data-bwignore=""
                  data-form-type="other"
                  translate="no"
                  aria-label={f.name}
                  placeholder={odblokowany ? "—" : isSecretValue(surowa) ? "zablokowane" : "—"}
                  value={odblokowany ? tekst : ""}
                  onChange={(e) => {
                    const t = e.target.value;
                    setTeksty((m) => ({ ...m, [f.id]: t }));
                  }}
                  // Zamaskowanego tekstu nie da się skopiować ani wyciąć (jak w zwykłym polu hasła)
                  onCopy={(e) => {
                    if (!pokazany) e.preventDefault();
                  }}
                  onCut={(e) => {
                    if (!pokazany) e.preventDefault();
                  }}
                  className={cn(FIELD, "notranslate h-11 flex-1 tabular-nums", !pokazany && "[-webkit-text-security:disc]")}
                />
                {odblokowany && (
                  <>
                    <Button
                      variant="ghost"
                      icon
                      aria-label={pokazany ? `Ukryj: ${f.name}` : `Pokaż: ${f.name}`}
                      aria-pressed={pokazany}
                      onClick={() =>
                        setPokazane((l) => (l.includes(f.id) ? l.filter((id) => id !== f.id) : [...l, f.id]))
                      }
                      className="size-11"
                    >
                      {pokazany ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      icon
                      aria-label={`Kopiuj: ${f.name}`}
                      disabled={tekst === ""}
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(tekst);
                        } catch {
                          toast.error("Nie udało się skopiować.");
                          return;
                        }
                        toast(`Skopiowano: ${f.name}`, { description: "Schowek wyczyści się za 30 s." });
                        // Czyszczenie po 30 s; plan nie trzyma skopiowanego tekstu. Bez fokusu czekamy na powrót do karty.
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
                      className="size-11"
                    >
                      <Copy aria-hidden="true" className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        }

        if (f.type === "status" || f.type === "select") {
          const v = normalizeValue(f, surowa);
          return (
            <div key={f.id} className="flex flex-col gap-1.5 text-[13px] font-medium">
              <span>{f.name}</span>
              <Dropdown
                ariaLabel={f.name}
                placeholder="—"
                value={typeof v === "string" ? v : null}
                onChange={(id) => onChange(f.id, id)}
                options={(f.config.options ?? []).map((o) => ({
                  value: o.id,
                  label: o.label,
                  node:
                    f.type === "status" ? (
                      <OptionBadge option={o} />
                    ) : (
                      <span className="rounded-[4px] border border-input px-[7px] py-0.5 font-mono text-[11px] whitespace-nowrap text-soft-foreground">
                        {o.label}
                      </span>
                    ),
                }))}
              />
            </div>
          );
        }

        if (f.type === "date") {
          const v = normalizeValue(f, surowa);
          return (
            <div key={f.id} className="flex flex-col items-start gap-1.5 text-[13px] font-medium">
              <span>{f.name}</span>
              <DatePicker
                ariaLabel={f.name}
                today={today}
                value={typeof v === "string" ? (v as IsoDate) : null}
                onChange={(d) => onChange(f.id, d)}
              />
            </div>
          );
        }

        // Kwota cykliczna (minimum na telefon, Etap 3): pole kwoty i segment „mies. | rok”
        if (f.type === "recurring") {
          const kwota = normalizeValue(f, surowa);
          const cykl: Cycle = isRecurringValue(kwota)
            ? kwota.cycle
            : (cykle[f.id] ?? f.config.default_cycle ?? "month");
          return (
            <div key={f.id} className="flex flex-col gap-1.5">
              <TextField
                label={f.name}
                value={kwoty[f.id] ?? (isRecurringValue(kwota) ? formatMoney(kwota.amount) : "")}
                inputMode="decimal"
                placeholder="0,00"
                onChange={(e) => {
                  const t = e.target.value;
                  setKwoty((m) => ({ ...m, [f.id]: t }));
                  const czysty = t.replace(/[\s\u00a0]/g, "");
                  const n = normalizeValue(f, czysty);
                  // Pusty tekst czyści kwotę; niepoprawny zostawia ostatnią poprawną
                  if (czysty === "") onChange(f.id, null);
                  else if (isRecurringValue(n)) onChange(f.id, { amount: n.amount, cycle: cykl });
                }}
                className="font-mono"
              />
              <Segment
                ariaLabel={`${f.name}: cykl`}
                value={cykl}
                options={[
                  { value: "month", label: "mies." },
                  { value: "year", label: "rok" },
                ]}
                onChange={(c) => {
                  setCykle((m) => ({ ...m, [f.id]: c }));
                  if (isRecurringValue(kwota)) onChange(f.id, { amount: kwota.amount, cycle: c });
                }}
              />
            </div>
          );
        }

        // Data odnowienia (minimum na telefon): pole daty pokazuje następne odnowienie (jak tabela),
        // a wybrana data zapisuje się jako nowa kotwica serii
        if (f.type === "renewal") {
          const v = normalizeValue(f, surowa);
          const kotwica = typeof v === "string" ? v : null;
          const cykl = rowCycle(f, allFields ?? fields, values);
          const nastepne = kotwica === null ? null : nextRenewal(kotwica, cykl, today);
          return (
            <div key={f.id} className="flex flex-col items-start gap-1.5 text-[13px] font-medium">
              <span>{f.name}</span>
              <DatePicker
                ariaLabel={f.name}
                today={today}
                value={nastepne as IsoDate | null}
                onChange={(d) => {
                  // Data już należąca do serii nie zmienia kotwicy (inaczej seria dryfuje)
                  if (d !== null && kotwica !== null && renewalDates(kotwica, cykl, d, d).length > 0) return;
                  onChange(f.id, d);
                }}
              />
            </div>
          );
        }

        if (f.type === "rating") {
          const n = normalizeValue(f, surowa);
          const ocena = typeof n === "number" ? n : 0;
          return (
            <div key={f.id} className="flex flex-col gap-1.5 text-[13px] font-medium">
              <span>{f.name}</span>
              <span role="group" aria-label={f.name} className="inline-flex">
                {[1, 2, 3, 4, 5].map((k) => (
                  <button
                    key={k}
                    type="button"
                    aria-label={`Ocena ${k} na 5`}
                    aria-pressed={k <= ocena}
                    onClick={() => onChange(f.id, ocena === k ? null : k)}
                    className={`size-11 cursor-pointer border-0 bg-transparent p-0 text-[22px] leading-none ${
                      k <= ocena ? "text-foreground" : "text-faint-foreground"
                    }`}
                  >
                    ★
                  </button>
                ))}
              </span>
            </div>
          );
        }

        if (f.type === "checkbox") {
          return (
            <div key={f.id} className="flex min-h-11 items-center">
              <Checkbox
                checked={surowa === true}
                label={f.name}
                onChange={(c) => onChange(f.id, c)}
              />
            </div>
          );
        }

        const tekst =
          typeof surowa === "string"
            ? surowa
            : typeof surowa === "number"
              ? String(surowa).replace(".", ",")
              : "";
        return (
          <TextField
            key={f.id}
            label={f.name}
            value={tekst}
            inputMode={f.type === "number" ? "decimal" : undefined}
            placeholder={f.isTitle ? (f.config.empty_label ?? "Bez tytułu") : ""}
            onChange={(e) => onChange(f.id, e.target.value)}
            className={f.type === "url" || f.type === "number" ? "font-mono" : undefined}
          />
        );
      })}

      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="mt-1 flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-destructive-border bg-white font-[inherit] font-medium text-destructive-foreground hover:bg-panel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
          </svg>
          Usuń wiersz
        </button>
      )}
    </FormDialog>
  );
}
