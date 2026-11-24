"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Copy, Eye, EyeOff, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  Button,
  Card,
  Chip,
  FormDialog,
  Segment,
  Switch,
  TextField,
  type IsoDate,
} from "@/components/controls";
import { buildMonthGrid, MIESIACE } from "@/components/controls/calendar-math";
import { isSecretValue, type SecretValue } from "@/features/vault/crypto";
import { useVault } from "@/features/vault/vault-provider";
import { cn } from "@/lib/utils";
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

// Arkusz wiersza na telefonie (CMRowEdit.dc.html; FormDialog poniżej 800 px, wysokość 90%): nagłówek
// „Anuluj” · tytuł wiersza · „Zapisz”, pola według typu (tekst, liczba i link jako pole 44 px, Wybór jako chipy,
// Data jako kalendarz miesiąca z podpisem, Ocena jako gwiazdki 44 px, Checkboxy zebrane w jednej karcie
// z przełącznikami), „Usuń wiersz” (tylko istniejący wiersz).
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
  // Miesiąc pokazany w kalendarzu pola daty (id pola → rok i miesiąc 0–11); bez wpisu miesiąc wartości albo dzisiejszy
  const [miesiace, setMiesiace] = React.useState<Record<string, { rok: number; miesiac: number }>>({});
  // „Zapisz” w trakcie szyfrowania nie zapisuje drugi raz
  const [szyfrowanie, setSzyfrowanie] = React.useState(false);
  const [poprzednie, setPoprzednie] = React.useState({ open, status: vault.status });
  if (poprzednie.open !== open || poprzednie.status !== vault.status) {
    setPoprzednie({ open, status: vault.status });
    // Zamknięcie arkusza: szkice kwot znikają (następny wiersz zaczyna od swoich wartości)
    if (!open) {
      setKwoty({});
      setCykle({});
      setMiesiace({});
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

  // „Zapisz”: zmienione sekrety szyfrujemy tutaj; do store idą tylko szyfrogramy (pusty tekst → null)
  async function zapisz() {
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
  }

  // Checkboxy idą na koniec, razem w jednej karcie (m-row z przełącznikiem)
  const pola = fields.filter((f) => f.type !== "checkbox");
  const checkboxy = fields.filter((f) => f.type === "checkbox");

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onCancel();
      }}
      title={title}
      phoneHeader="actions"
      phoneCancel={{ label: "Anuluj", onClick: onCancel }}
      phoneSubmit={
        <Button variant="primary" disabled={szyfrowanie} onClick={() => void zapisz()}>
          Zapisz
        </Button>
      }
      titleClassName="max-[799px]:text-base"
      contentClassName="max-[799px]:h-[90%] max-[799px]:max-h-[90%]"
    >
      {pola.map((f) => {
        const surowa = values[f.id];

        // Sekret: pole zamaskowane (.igroup z oczkiem i kopiowaniem); tekst tylko w stanie arkusza
        if (f.type === "secret") {
          const pokazany = pokazane.includes(f.id);
          const tekst = teksty[f.id] ?? "";
          return (
            <div key={f.id} className="flex flex-col gap-1.5 text-[13px] font-medium">
              <span>{f.name}</span>
              <div className="flex h-11 items-center rounded-md border border-input bg-white shadow-xs transition-[box-shadow,border-color] duration-150 focus-within:border-ring focus-within:shadow-halo">
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
                  className={cn(
                    "notranslate h-full min-w-0 flex-1 border-0 bg-transparent px-[11px] text-base font-normal text-foreground tabular-nums outline-none placeholder:text-faint-foreground disabled:opacity-[.64]",
                    !pokazany && "[-webkit-text-security:disc]",
                  )}
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

        // Wybór / Status: .lbl i chipy z aria-pressed; stuknięcie zaznaczonej opcji czyści wartość
        if (f.type === "status" || f.type === "select") {
          const v = normalizeValue(f, surowa);
          return (
            <div key={f.id} role="group" aria-label={f.name} className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-muted-foreground">{f.name}</span>
              <div className="flex flex-wrap gap-2">
                {(f.config.options ?? []).map((o) => (
                  <Chip
                    key={o.id}
                    selected={v === o.id}
                    dotColor={f.type === "status" && o.color !== "" ? o.color : undefined}
                    onClick={() => onChange(f.id, v === o.id ? null : o.id)}
                  >
                    {o.label}
                  </Chip>
                ))}
              </div>
            </div>
          );
        }

        // Data: karta z kalendarzem miesiąca (strzałki 44 px, dni 40 px) i podpis „dd.mm.rrrr · za N dni”
        if (f.type === "date" || f.type === "renewal") {
          const v = normalizeValue(f, surowa);
          let wybrana: string | null = null;
          const czyscDate = (): void => onChange(f.id, null);
          let wybierz = (d: string): void => onChange(f.id, d);
          if (f.type === "date") {
            wybrana = typeof v === "string" ? v : null;
          } else {
            // Data odnowienia: kalendarz pokazuje następne odnowienie, a wybrana data zapisuje się jako nowa kotwica serii
            const kotwica = typeof v === "string" ? v : null;
            const cykl = rowCycle(f, allFields ?? fields, values);
            wybrana = kotwica === null ? null : nextRenewal(kotwica, cykl, today);
            wybierz = (d) => {
              // Data już należąca do serii nie zmienia kotwicy (inaczej seria dryfuje)
              if (kotwica !== null && renewalDates(kotwica, cykl, d, d).length > 0) return;
              onChange(f.id, d);
            };
          }
          // Miesiąc: wybrany w kalendarzu, inaczej miesiąc wartości, inaczej dzisiejszy
          const baza = wybrana ?? today;
          const widok = miesiace[f.id] ?? { rok: Number(baza.slice(0, 4)), miesiac: Number(baza.slice(5, 7)) - 1 };
          const przesun = (o: number) => {
            const n = widok.rok * 12 + widok.miesiac + o;
            setMiesiace((m) => ({ ...m, [f.id]: { rok: Math.floor(n / 12), miesiac: n % 12 } }));
          };
          const komorki = buildMonthGrid(widok.rok, widok.miesiac, "mon");
          // Bez pustego ostatniego tygodnia: tniemy za ostatnim dniem miesiąca
          const ostatni = komorki.map((c) => c.inMonth).lastIndexOf(true);
          const dniMiesiaca = komorki.slice(0, Math.ceil((ostatni + 1) / 7) * 7);
          const roznica =
            wybrana === null
              ? null
              : Math.round((Date.UTC(+wybrana.slice(0, 4), +wybrana.slice(5, 7) - 1, +wybrana.slice(8, 10)) - Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10))) / 86400000);
          return (
            <div key={f.id} role="group" aria-label={f.name} className="flex flex-col gap-1.5 text-[13px] font-medium">
              <span>{f.name}</span>
              <Card className="px-2.5 pt-2.5 pb-2 font-normal">
                <div className="flex items-center pb-1.5">
                  <Button variant="ghost" icon aria-label="Poprzedni miesiąc" onClick={() => przesun(-1)}>
                    <ChevronLeft size={18} aria-hidden="true" />
                  </Button>
                  <span className="flex-1 text-center text-sm font-semibold">
                    {MIESIACE[widok.miesiac]} {widok.rok}
                  </span>
                  <Button variant="ghost" icon aria-label="Następny miesiąc" onClick={() => przesun(1)}>
                    <ChevronRight size={18} aria-hidden="true" />
                  </Button>
                </div>
                <div className="grid grid-cols-7 pb-1 text-center text-xs font-medium text-muted-foreground">
                  {["pn", "wt", "śr", "cz", "pt", "sb", "nd"].map((d) => (
                    <span key={d}>{d}</span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-0.5">
                  {dniMiesiaca.map((c) => {
                    if (!c.inMonth) return <span key={c.date} aria-hidden="true" />;
                    const dzis = c.date === today;
                    const zaznaczona = c.date === wybrana;
                    return (
                      <button
                        key={c.date}
                        type="button"
                        aria-label={`${Number(c.date.slice(8, 10))} ${MIESIACE[widok.miesiac]} ${widok.rok}`}
                        aria-pressed={zaznaczona}
                        onClick={() => wybierz(c.date)}
                        // date-cell 40 px; dziś = czerwone koło 32 px (#dc2626), wybrana = primary, wybrana i dziś = koło z pierścieniem
                        className={cn(
                          "flex h-10 cursor-pointer items-center justify-center justify-self-stretch rounded-md border-0 bg-transparent p-0 font-[inherit] text-sm tabular-nums",
                          zaznaczona && !dzis && "bg-primary font-semibold text-primary-foreground",
                          dzis &&
                            "size-8 self-center justify-self-center rounded-full bg-[#dc2626] font-semibold text-white",
                          dzis && zaznaczona && "shadow-[0_0_0_2px_#fff,0_0_0_4px_#262626]",
                        )}
                      >
                        {Number(c.date.slice(8, 10))}
                      </button>
                    );
                  })}
                </div>
              </Card>
              <div className="flex items-center justify-between">
                <span className="text-xs font-normal text-muted-foreground tabular-nums">
                  {wybrana === null || roznica === null
                    ? "Nie wybrano daty"
                    : `${wybrana.slice(8, 10)}.${wybrana.slice(5, 7)}.${wybrana.slice(0, 4)} · ${roznica < 0 ? "minęło" : roznica === 0 ? "dziś" : `za ${roznica} dni`}`}
                </span>
                {wybrana !== null && (
                  <Button variant="ghost" size="sm" onClick={czyscDate} className="text-muted-foreground">
                    Wyczyść
                  </Button>
                )}
              </div>
            </div>
          );
        }

        // Kwota cykliczna: kwota w .igroup z „zł” i segment „mies. | rok”
        if (f.type === "recurring") {
          const kwota = normalizeValue(f, surowa);
          const cykl: Cycle = isRecurringValue(kwota)
            ? kwota.cycle
            : (cykle[f.id] ?? f.config.default_cycle ?? "month");
          return (
            <div key={f.id} className="grid grid-cols-[minmax(0,1fr)_150px] items-end gap-2.5">
              <label className="flex flex-col gap-2 text-sm font-medium text-foreground">
                {f.name}
                <span className="flex h-11 items-center gap-2 rounded-md border border-input bg-white px-[11px] text-muted-foreground shadow-xs transition-[box-shadow,border-color] duration-150 focus-within:border-ring focus-within:shadow-halo">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    aria-label={f.name}
                    value={kwoty[f.id] ?? (isRecurringValue(kwota) ? formatMoney(kwota.amount) : "")}
                    onChange={(e) => {
                      const t = e.target.value;
                      setKwoty((m) => ({ ...m, [f.id]: t }));
                      const czysty = t.replace(/[\s ]/g, "");
                      const n = normalizeValue(f, czysty);
                      // Pusty tekst czyści kwotę; niepoprawny zostawia ostatnią poprawną
                      if (czysty === "") onChange(f.id, null);
                      else if (isRecurringValue(n)) onChange(f.id, { amount: n.amount, cycle: cykl });
                    }}
                    className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-base font-normal text-foreground tabular-nums outline-none placeholder:text-faint-foreground"
                  />
                  <span className="text-sm font-normal">zł</span>
                </span>
              </label>
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

      {/* Checkboxy w jednej karcie: wiersz m-row z przełącznikiem (m-hit) */}
      {checkboxy.length > 0 && (
        <Card className="overflow-hidden">
          {checkboxy.map((f) => (
            <div key={f.id} className="m-row">
              <span className="flex-1">{f.name}</span>
              <Switch checked={values[f.id] === true} ariaLabel={f.name} onChange={(c) => onChange(f.id, c)} />
            </div>
          ))}
        </Card>
      )}

      {onDelete && (
        <Button variant="destructive-outline" onClick={onDelete} className="w-full">
          <Trash2 aria-hidden="true" size={18} />
          Usuń wiersz
        </Button>
      )}
    </FormDialog>
  );
}
